import { z } from 'zod';
import type { AndroidRelease, ReleaseOffer } from './types';
const integer=z.number().int().min(1).max(2147483647);
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const releaseSchema=z.object({
  schemaVersion:z.literal(1),channel:z.literal('stable'),applicationId:z.literal('com.resqnow1.app'),
  versionCode:integer,versionName:z.string().min(1).max(60).refine(v=>Boolean(v.trim())&&!/[\u0000-\u001f\u007f]/.test(v)),
  minSdk:z.number().int().min(24).max(100),targetSdk:z.number().int().min(24).max(100),
  sizeBytes:z.number().int().min(1).max(200*1024*1024),sha256:digest,signingCertificateSha256:digest,
  apkUrl:z.string(),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),
  publishedAt:z.string().refine(v=>/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,19)===v.slice(0,19)),
}).strict().refine(v=>v.targetSdk>=v.minSdk&&v.apkUrl===`https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v${v.versionCode}/resqnow.apk`);
export function parseRelease(value:unknown):AndroidRelease{
  const r=releaseSchema.parse(value);
  return {schemaVersion:r.schemaVersion,channel:r.channel,applicationId:r.applicationId,versionCode:r.versionCode,versionName:r.versionName,minSdk:r.minSdk,targetSdk:r.targetSdk,sizeBytes:r.sizeBytes,sha256:r.sha256,signingCertificateSha256:r.signingCertificateSha256,apkUrl:r.apkUrl,sourceCommit:r.sourceCommit,publishedAt:r.publishedAt};
}
export async function fetchUpdateOffer(origin:string,fetcher:typeof fetch=fetch):Promise<ReleaseOffer>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetcher(`${origin}/api/public/android-app/update`,{credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok||!response.body)throw new Error('Update information is unavailable');
    const reader=response.body.getReader();let text='';let size=0;const decoder=new TextDecoder();
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)throw new Error('Invalid update response');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
    finally{await reader.cancel().catch(()=>{});}
    const data=JSON.parse(text);
    if(data?.state==='disabled'&&Object.keys(data).length===1)return {state:'disabled'};
    if(data?.state!=='ready'||Object.keys(data).length!==2)throw new Error('Invalid update response');
    return {state:'ready',release:parseRelease(data.release)};
  }finally{clearTimeout(timer);}
}
