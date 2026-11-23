import type { NativeMapRect } from './nativeMapTypes';
import type { NativeViewport } from './NativeMapController';

const box=(r: DOMRect | NativeMapRect): NativeMapRect=>({left:r.left,top:r.top,width:r.width,height:r.height});
const intersect=(a:NativeMapRect,b:NativeMapRect):NativeMapRect=>{
  const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top);
  return {left,top,width:Math.max(0,Math.min(a.left+a.width,b.left+b.width)-left),height:Math.max(0,Math.min(a.top+a.height,b.top+b.height)-top)};
};
function displayed(element:HTMLElement) {
  const style=getComputedStyle(element);
  return style.display!=='none' && style.visibility!=='hidden' && style.visibility!=='collapse' && Number(style.opacity || 1)>0 && !element.hidden;
}
function inFront(element:HTMLElement,map:HTMLElement,rect:NativeMapRect) {
  if(typeof document.elementsFromPoint!=='function') return true;
  const stack=document.elementsFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
  const control=stack.findIndex(node=>element===node || element.contains(node));
  const surface=stack.indexOf(map);
  return control>=0 && (surface<0 || control<surface);
}
function mapStackOrder(element:HTMLElement) {
  const maps=Array.from(document.querySelectorAll<HTMLElement>('[data-native-map-surface="true"]'));
  maps.sort((a,b)=>{
    if(a===b) return 0;
    const overlap=intersect(box(a.getBoundingClientRect()),box(b.getBoundingClientRect()));
    if(overlap.width && overlap.height && typeof document.elementsFromPoint==='function') {
      const stack=document.elementsFromPoint(overlap.left+overlap.width/2,overlap.top+overlap.height/2);
      const ai=stack.indexOf(a),bi=stack.indexOf(b); if(ai>=0 && bi>=0) return bi-ai;
    }
    return a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
  return Math.max(0,maps.indexOf(element));
}
export function readNativeViewport(element:HTMLElement): NativeViewport {
  const visual=window.visualViewport;
  const visualViewport={width:visual?.width || window.innerWidth,height:visual?.height || window.innerHeight,
    offsetLeft:visual?.offsetLeft || 0,offsetTop:visual?.offsetTop || 0,scale:visual?.scale || 1};
  const frame=box(element.getBoundingClientRect());
  let clip=intersect(frame,{left:visualViewport.offsetLeft,top:visualViewport.offsetTop,width:visualViewport.width,height:visualViewport.height});
  let visible=element.isConnected && frame.width>0 && frame.height>0;
  let cornerRadius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
  for(let node:HTMLElement|null=element;node;node=node.parentElement) {
    visible &&= displayed(node);
    const style=getComputedStyle(node);
    if(node!==element && [style.overflow,style.overflowX,style.overflowY].some(v=>['auto','scroll','hidden','clip'].includes(v))) {
      const r=box(node.getBoundingClientRect()); clip=intersect(clip,r);
      if(Math.abs(r.left-frame.left)<2 && Math.abs(r.top-frame.top)<2 && Math.abs(r.width-frame.width)<4 && Math.abs(r.height-frame.height)<4) {
        cornerRadius=Math.max(cornerRadius,parseFloat(style.borderTopLeftRadius)||0);
      }
    }
  }
  visible &&=clip.width>0 && clip.height>0;
  const excludedRects:NativeMapRect[]=[];
  for(const overlay of document.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select,[role="button"],[role="radio"],[data-native-map-overlay],[data-radix-popper-content-wrapper]')) {
    if(overlay.contains(element)) continue;
    const rect=intersect(clip,box(overlay.getBoundingClientRect()));
    if(rect.width && rect.height && displayed(overlay) && inFront(overlay,element,rect)) excludedRects.push(rect);
  }
  const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"],[data-native-map-modal="true"]'))
    .filter(node=>displayed(node) && node.getBoundingClientRect().width>0);
  const dialog=dialogs.at(-1);
  const passThrough=element.closest('[data-native-map-pass-through]')!=null || getComputedStyle(element).pointerEvents==='none';
  const interactive=visible && !passThrough && (!dialog || dialog.contains(element));
  if(!interactive && visible) excludedRects.push(clip);
  // Native validates the declared bounds. Never silently truncate controls or large payloads.
  return {frame,clip,visualViewport,excludedRects,cornerRadius,visible,interactive,stackOrder:mapStackOrder(element)};
}

type SavedProperty={value:string;priority:string};
type Entry={owners:Map<HTMLElement,number>;saved:Map<string,SavedProperty>;attribute:string|null;color:string;image:string;key:string};
const entries=new WeakMap<HTMLElement,Entry>();
const backgroundProperties=['background-color','background-image','background-size','background-repeat','background-origin'];
export type TransparencyLease=(()=>void)&{update:()=>void};

/** Scope transparency to live map paths and restore exact inline styles on the last lease. */
export function acquireMapTransparency(map:HTMLElement):TransparencyLease {
  const path:HTMLElement[]=[];
  for(let node:HTMLElement|null=map;node;node=node.parentElement) {
    path.push(node); let entry=entries.get(node);
    if(!entry) {
      const computed=getComputedStyle(node);
      entry={owners:new Map(),saved:new Map(backgroundProperties.map(name=>[name,{value:node!.style.getPropertyValue(name),priority:node!.style.getPropertyPriority(name)}])),
        attribute:node.getAttribute('data-native-map-ancestor'),color:computed.backgroundColor,image:computed.backgroundImage,key:''};
      entries.set(node,entry); node.setAttribute('data-native-map-ancestor','true');
      node.style.setProperty('background-color','transparent','important');
    }
    entry.owners.set(map,(entry.owners.get(map)||0)+1);
  }
  const updateNode=(node:HTMLElement)=>{
    const entry=entries.get(node); if(!entry) return;
    const bounds=node.getBoundingClientRect();
    const holes=Array.from(entry.owners.keys()).map(owner=>box(owner.getBoundingClientRect()));
    const key=JSON.stringify([bounds.left,bounds.top,bounds.width,bounds.height,holes]); if(key===entry.key) return; entry.key=key;
    // Retain flat panel backgrounds outside map holes rather than erasing the whole ancestor.
    if(bounds.width>0 && bounds.height>0 && entry.color && entry.color!=='transparent' && entry.color!=='rgba(0, 0, 0, 0)') {
      const holeRects=holes.map(h=>`<rect x="${h.left-bounds.left}" y="${h.top-bounds.top}" width="${h.width}" height="${h.height}" fill="black"/>`).join('');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><mask id="holes"><rect width="100%" height="100%" fill="white"/>${holeRects}</mask><rect width="100%" height="100%" fill="${entry.color}" mask="url(#holes)"/></svg>`;
      node.style.setProperty('background-image',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`,'important');
      node.style.setProperty('background-size','100% 100%','important'); node.style.setProperty('background-repeat','no-repeat','important'); node.style.setProperty('background-origin','border-box','important');
    } else node.style.setProperty('background-image','none','important');
  };
  let released=false;
  const release=(()=>{
    if(released) return; released=true;
    for(const node of path) {
      const entry=entries.get(node); if(!entry) continue;
      const count=(entry.owners.get(map)||1)-1; if(count) entry.owners.set(map,count); else entry.owners.delete(map);
      if(entry.owners.size) { entry.key=''; updateNode(node); continue; }
      for(const [name,saved] of entry.saved) {
        if(saved.value) node.style.setProperty(name,saved.value,saved.priority); else node.style.removeProperty(name);
      }
      if(entry.attribute==null) node.removeAttribute('data-native-map-ancestor'); else node.setAttribute('data-native-map-ancestor',entry.attribute);
      entries.delete(node);
    }
  }) as TransparencyLease;
  release.update=()=>{if(!released) path.forEach(updateNode);}; release.update(); return release;
}

/** rAF catches scroll transforms and sheet animations that ResizeObserver does not report. */
export function observeNativeViewport(element:HTMLElement,onChange:(viewport:NativeViewport)=>void,onResume?:()=>void) {
  let disposed=false,frame=0,last='';
  const measure=()=>{
    if(disposed) return;
    const viewport=readNativeViewport(element),key=JSON.stringify(viewport);
    if(key!==last) {last=key;onChange(viewport);}
  };
  const tick=()=>{measure();if(!disposed && !document.hidden) frame=requestAnimationFrame(tick);};
  const resume=()=>{if(disposed) return;last='';measure();onResume?.();cancelAnimationFrame(frame);if(!document.hidden) frame=requestAnimationFrame(tick);};
  const resize=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(measure); resize?.observe(element);
  window.addEventListener('resize',measure); window.addEventListener('scroll',measure,true); window.addEventListener('pageshow',resume);
  document.addEventListener('visibilitychange',resume); window.visualViewport?.addEventListener('resize',measure); window.visualViewport?.addEventListener('scroll',measure);
  measure(); if(!document.hidden) frame=requestAnimationFrame(tick);
  let appListener:{remove:()=>Promise<void>}|undefined;
  // This module is loaded only for native surfaces. Use the existing App plugin for actual Activity resume.
  void import('@capacitor/app').then(({App})=>App.addListener('appStateChange',state=>{if(state.isActive) resume();}))
    .then(listener=>{if(disposed) void listener.remove();else appListener=listener;}).catch(()=>{});
  return ()=>{
    disposed=true;cancelAnimationFrame(frame);resize?.disconnect();void appListener?.remove();
    window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);window.removeEventListener('pageshow',resume);
    document.removeEventListener('visibilitychange',resume);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);
  };
}
