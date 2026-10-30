import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const REPOSITORY='janeshkrish/resqnowfrontend';const APPLICATION='com.resqnow1.app';const MAX=2147483647;const APK_LIMIT=200*1024*1024;
const whole=(value,min=0)=>Number.isSafeInteger(value)&&value>=min&&value<=MAX;
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const label=value=>typeof value==='string'&&Boolean(value.trim())&&value.length<=60&&!/[\u0000-\u001f\u007f]/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);

export function prepareAndroidVersion({floor,runNumber,latestVersionCode}){
  if(!whole(floor,4)||!whole(runNumber,1)||!whole(latestVersionCode))throw Error('Explicit reviewed version floor, sequence and history are required');
  const versionCode=floor+runNumber;
  if(!whole(versionCode,1)||versionCode<=latestVersionCode)throw Error('Android version must increase without overflow or tag reuse');
  return {versionCode,versionName:`1.4.${versionCode}`,tag:`android-v${versionCode}`};
}
const REQUIRED=['VITE_API_URL','VITE_FRONTEND_ONLY','VITE_APP_UPDATES_ENABLED','VITE_NATIVE_BUILD','VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_APP_ID','VITE_MAPPLS_MAP_SDK_KEY','VITE_RAZORPAY_KEY_ID'];
const OPTIONAL=['VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_VAPID_KEY','VITE_GOOGLE_MAPS_API_KEY'];
export function validateProductionSettings(settings){
  for(const name of REQUIRED){const v=settings?.[name];if(typeof v!=='string'||!v.trim()||v!==v.trim()||/[\r\n\u0000]/.test(v)||/e2e|synthetic|placeholder|example\.(?:test|com)|localhost|(?:^|[._-])demo(?:$|[._-])|rzp_test_/i.test(v))throw Error('Missing or non-production public setting: '+name);}
  if(settings.VITE_API_URL!=='https://resqnowbackend-production-c392.up.railway.app'||settings.VITE_FRONTEND_ONLY!=='false'||settings.VITE_NATIVE_BUILD!=='true'||settings.VITE_APP_UPDATES_ENABLED!=='true')throw Error('Production Android build flags/origin are not approved');
  if(!/^\d{6,20}$/.test(settings.VITE_FIREBASE_MESSAGING_SENDER_ID)||!settings.VITE_FIREBASE_APP_ID.startsWith(`1:${settings.VITE_FIREBASE_MESSAGING_SENDER_ID}:web:`)||!settings.VITE_FIREBASE_AUTH_DOMAIN.endsWith('.firebaseapp.com')||!settings.VITE_RAZORPAY_KEY_ID.startsWith('rzp_live_'))throw Error('Public production provider configuration is inconsistent');
  return Object.fromEntries([...REQUIRED,...OPTIONAL].map(name=>[name,settings[name]??'']));
}
export function validateGoogleServices(value,settings){
  if(!value||typeof value!=='object'||JSON.stringify(value).includes('"private_key"')||value.project_info?.project_id!==settings.VITE_FIREBASE_PROJECT_ID||String(value.project_info?.project_number)!==settings.VITE_FIREBASE_MESSAGING_SENDER_ID||!(value.client??[]).some(c=>c.client_info?.android_client_info?.package_name===APPLICATION&&c.api_key?.some(k=>typeof k.current_key==='string'&&k.current_key.startsWith('AIza'))))throw Error('Android Firebase public configuration does not match the approved project/package');
}
function requireMetadata(m){
  if(!m||m.applicationId!==APPLICATION||!whole(m.versionCode,1)||!label(m.versionName)||m.minSdk!==24||m.targetSdk!==36||!digest(m.signingCertificateSha256)||!/^[a-f0-9]{40}$/.test(m.sourceCommit??'')||!date(m.publishedAt)||m.apkUrl!==`https://github.com/${REPOSITORY}/releases/download/android-v${m.versionCode}/resqnow.apk`)throw Error('Invalid expected Android artifact identity');
}
export function createAndroidTools({sdk=process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT,javaHome=process.env.JAVA_HOME}={}){
  if(!sdk||!javaHome)throw Error('Android SDK36 and JDK21 are required');
  const dir=path.join(sdk,'build-tools','36.0.0');const java=path.join(javaHome,'bin',process.platform==='win32'?'java.exe':'java');
  const run=(exe,args)=>{try{return execFileSync(exe,args,{encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});}catch{throw Error('Android tool verification failed');}};
  return {badging:async apk=>run(path.join(dir,process.platform==='win32'?'aapt2.exe':'aapt2'),['dump','badging',apk]),signature:async apk=>run(java,['-jar',path.join(dir,'lib','apksigner.jar'),'verify','--verbose','--print-certs',apk])};
}
export async function verifyAndroidArtifact({apk,expectedManifest:m,tools=createAndroidTools()}){
  requireMetadata(m);const stat=await fs.stat(apk);if(!stat.isFile()||stat.size<1||stat.size>APK_LIMIT)throw Error('Invalid APK size');
  const before=createHash('sha256').update(await fs.readFile(apk)).digest('hex');
  const badging=await tools.badging(apk);const signature=await tools.signature(apk);
  const pkg=/^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'/m.exec(badging);
  const min=/^sdkVersion:'([0-9]+)'/m.exec(badging);const target=/^targetSdkVersion:'([0-9]+)'/m.exec(badging);
  if(!pkg||pkg[1]!==m.applicationId||Number(pkg[2])!==m.versionCode||pkg[3]!==m.versionName||Number(min?.[1])!==m.minSdk||Number(target?.[1])!==m.targetSdk||/^application-debuggable(?:\s|$)/m.test(badging))throw Error('APK package/version/SDK/debug policy mismatch');
  const signers=[...signature.matchAll(/^Signer #(\d+) certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gm)];
  if(!/^Verifies\s*$/m.test(signature)||/DOES NOT VERIFY|Android Debug/i.test(signature)||signers.length!==1||signers[0][1]!=='1'||signers[0][2]!==m.signingCertificateSha256)throw Error('APK production signature mismatch');
  // Re-stat after tool inspection to reject a replaced/truncated build output.
  const bytes=await fs.readFile(apk);if(bytes.length!==stat.size||createHash('sha256').update(bytes).digest('hex')!==before)throw Error('APK changed during verification');
  return {schemaVersion:1,channel:'stable',applicationId:APPLICATION,versionCode:m.versionCode,versionName:m.versionName,minSdk:m.minSdk,targetSdk:m.targetSdk,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signingCertificateSha256:m.signingCertificateSha256,apkUrl:m.apkUrl,sourceCommit:m.sourceCommit,publishedAt:m.publishedAt};
}
export function requireTrustedContext(context,{dryRun=false,enabled=false}={}){
  if(context?.actions!==true||context.repository!==REPOSITORY||context.ref!=='refs/heads/main'||!['push','workflow_dispatch'].includes(context.event)||!/^[a-f0-9]{40}$/.test(context.sha??'')||context.checksPassed!==true||context.attempt!==1)throw Error('A verified trusted GitHub main release context is required; retries cannot reuse versions');
  if(!dryRun&&!enabled)throw Error('Automatic Android publication is disabled');
}
function releaseHistory(releases){
  if(!Array.isArray(releases)||releases.length>10000)throw Error('Android release history could not be verified');
  let latest=0;const seen=new Set();
  for(const item of releases){
    if(typeof item?.tag_name!=='string')throw Error('Malformed release history');
    const tag=item.tag_name;if(!tag.startsWith('android-'))continue;
    const match=/^android-v([1-9][0-9]*)$/.exec(tag);const code=Number(match?.[1]);
    if(!match||!whole(code,1)||seen.has(tag))throw Error('Ambiguous Android release history');seen.add(tag);latest=Math.max(latest,code);
  }
  return latest;
}
export async function runAndroidRelease({context,settings,runner,github,dryRun=false,enabled=false,now=()=>new Date()}){
  requireTrustedContext(context,{dryRun,enabled});const publicSettings=validateProductionSettings(settings?.public);
  if(settings.distributionConfirmed!==true||!digest(settings.certificateSha256)||!whole(settings.reviewedMaxVersionCode,4)||!whole(settings.floor,settings.reviewedMaxVersionCode))throw Error('Owner-reviewed distribution version/certificate continuity is required');
  validateGoogleServices(settings.googleServices,publicSettings);
  const latestVersionCode=Math.max(settings.reviewedMaxVersionCode,releaseHistory(await github.listReleases()));
  const version=prepareAndroidVersion({floor:settings.floor,runNumber:settings.runNumber,latestVersionCode});
  if(await github.tagExists(version.tag))throw Error('Android release tag already exists; never overwrite a release');
  const apk=await runner.build({version,publicSettings,googleServices:settings.googleServices});
  const expectedManifest={applicationId:APPLICATION,...version,minSdk:24,targetSdk:36,sourceCommit:context.sha,signingCertificateSha256:settings.certificateSha256,publishedAt:now().toISOString(),apkUrl:`https://github.com/${REPOSITORY}/releases/download/${version.tag}/resqnow.apk`};
  const manifest=await verifyAndroidArtifact({apk,expectedManifest,tools:runner.tools});
  if(dryRun)return {dryRun:true,apk,manifest,tag:version.tag};
  throw Error('Publication orchestration has not been activated');
}
async function main(){
  const dryRun=process.argv.includes('--dry-run');requireTrustedContext({actions:process.env.GITHUB_ACTIONS==='true',repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME,sha:process.env.GITHUB_SHA,checksPassed:process.env.ANDROID_RELEASE_CHECKS_PASSED==='true',attempt:Number(process.env.GITHUB_RUN_ATTEMPT)},{dryRun,enabled:process.env.ANDROID_AUTO_RELEASE_ENABLED==='true'});
  throw Error('Release orchestration is not enabled until its publication checks are configured');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
