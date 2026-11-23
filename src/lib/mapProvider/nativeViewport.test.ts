import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireMapTransparency, readNativeViewport } from './nativeViewport';

const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top,toJSON:()=>({})});
function element(box=rect(10,20,300,200)) {
  const parent=document.createElement('div'), map=document.createElement('div');
  parent.append(map); document.body.append(parent); map.dataset.nativeMapSurface='true';
  vi.spyOn(map,'getBoundingClientRect').mockReturnValue(box); return {parent,map};
}
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
describe('native viewport composition',()=>{
  it('clips against scrolling ancestors while retaining the full map frame',()=>{
    const {parent,map}=element(rect(10,-60,300,200)); parent.style.overflow='hidden';
    vi.spyOn(parent,'getBoundingClientRect').mockReturnValue(rect(0,0,400,100));
    const viewport=readNativeViewport(map);
    expect(viewport.frame).toEqual({left:10,top:-60,width:300,height:200});
    expect(viewport.clip).toEqual({left:10,top:0,width:300,height:100});
  });
  it('does not allocate native views for CSS-hidden responsive branches',()=>{
    const {parent,map}=element(); parent.style.display='none';
    expect(readNativeViewport(map).visible).toBe(false);
  });
  it('keeps display-only home maps clickable through the existing React navigation control',()=>{
    const {parent,map}=element();parent.setAttribute('data-native-map-pass-through','');
    expect(readNativeViewport(map).visible).toBe(true);expect(readNativeViewport(map).interactive).toBe(false);
  });
  it('excludes React controls and blocks a map behind a modal',()=>{
    const {parent,map}=element(); const button=document.createElement('button'); parent.append(button);
    vi.spyOn(button,'getBoundingClientRect').mockReturnValue(rect(20,30,80,40));
    expect(readNativeViewport(map).excludedRects).toContainEqual({left:20,top:30,width:80,height:40});
    const dialog=document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
    vi.spyOn(dialog,'getBoundingClientRect').mockReturnValue(rect(0,0,400,400)); document.body.append(dialog);
    expect(readNativeViewport(map).interactive).toBe(false);
  });
  it('excludes controls inside the native surface using actual browser hit-test order',()=>{
    const {map}=element();const button=document.createElement('button');map.append(button);
    vi.spyOn(button,'getBoundingClientRect').mockReturnValue(rect(20,30,40,40));
    Object.defineProperty(document,'elementsFromPoint',{configurable:true,value:()=>[button,map,document.body,document.documentElement]});
    try { expect(readNativeViewport(map).excludedRects).toContainEqual({left:20,top:30,width:40,height:40}); }
    finally { delete (document as unknown as {elementsFromPoint?:unknown}).elementsFromPoint; }
  });
  it('reference-counts shared ancestor transparency and restores original styles',()=>{
    const {parent,map}=element(); parent.style.backgroundColor='rgb(10, 20, 30)';
    const release1=acquireMapTransparency(map), release2=acquireMapTransparency(map);
    expect(parent.style.backgroundColor).toBe('transparent');
    release1(); expect(parent.style.backgroundColor).toBe('transparent');
    release2(); expect(parent.style.backgroundColor).toBe('rgb(10, 20, 30)');
    expect(parent.hasAttribute('data-native-map-ancestor')).toBe(false);
  });
});
