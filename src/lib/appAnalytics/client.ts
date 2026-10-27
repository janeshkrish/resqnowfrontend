import type {AnalyticsAccounts,AnalyticsTransport,NativeInstallation} from './types';
export function createAppAnalyticsClient({native,transport,enabled,isOnline=()=>true,isVisible=()=>true,now=Date.now}:{native:NativeInstallation|null;transport:AnalyticsTransport;enabled:boolean;isOnline?:()=>boolean;isVisible?:()=>boolean;now?:()=>number}){
 let running=false,busy=false,again=false,generation=0,attempt=0;
 let timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
 let accounts:AnalyticsAccounts={customer:null,technician:null};
 let lastReportAt=-Infinity,lastReportKey='',lastAccountsKey='';
 function schedule(ms:number){clearTimeout(timer);if(running)timer=setTimeout(()=>void cycle(),ms);}
 async function send(path:string,body:Record<string,unknown>,token?:string|null){
  controller=new AbortController();const signal=controller.signal;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([transport(path,body,token,signal),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{controller?.abort();reject(Error('Analytics deadline'));},3000);})]);
   if(result.status!==204&&(result.status<200||result.status>=300))throw Error('Analytics unavailable');
   return result.status;
  }finally{clearTimeout(timeout);controller=undefined;}
 }
 async function cycle(){
  if(!running||!native)return;
  if(busy){again=true;return;}
  clearTimeout(timer);busy=true;const epoch=generation;
  try{
   if(!isOnline()||!isVisible())throw Error('Wait for foreground connectivity');
   const id=await native.getIdentity();if(!running||epoch!==generation)return;
   const proof={installationId:id.installationId,installationSecret:id.installationSecret,consentRevision:id.consentRevision};
   if(!id.consentGranted){
    if(id.everConsented&&id.consentRevision>id.acknowledgedRevision){const status=await send('/installations/withdraw',proof);if(status!==204&&running&&epoch===generation)await native.acknowledge({revision:id.consentRevision});}
    attempt=0;return;
   }
   if(!enabled)return;
   const reportKey=`${id.installationId}:${id.consentRevision}:${id.versionName}:${id.versionCode}`;
   const accountsKey=`${accounts.customer?.id??''}:${accounts.technician?.id??''}`;
   const due=reportKey!==lastReportKey||now()-lastReportAt>=300000;
   if(due){
    const path=id.acknowledgedRevision>=id.consentRevision?'/installations/heartbeat':'/installations/register';
    const status=await send(path,{...proof,consentPolicyVersion:id.consentPolicyVersion,appId:id.appId,versionName:id.versionName,versionCode:id.versionCode});
    if(!running||epoch!==generation)return;
    if(status===204){schedule(300000);return;}
    await native.acknowledge({revision:id.consentRevision});lastReportKey=reportKey;lastReportAt=now();
   }
   if(due||accountsKey!==lastAccountsKey){
   for(const [kind,account] of [['customer',accounts.customer],['technician',accounts.technician]] as const){
    if(!running||epoch!==generation)return;
    const token=account?.getToken();if(token)await send(`/accounts/${kind}/link`,proof,token);
   }
   lastAccountsKey=accountsKey;
   }
   attempt=0;schedule(Math.max(1,300000-(now()-lastReportAt)));
  }catch{
   if(running&&epoch===generation){const delay=[5000,30000,120000][attempt++];if(delay!==undefined)schedule(delay);}
  }finally{busy=false;if(again&&running){again=false;void cycle();}}
 }
 return {
  start(){if(running)return;running=true;void cycle();},
  resume(){generation++;controller?.abort();attempt=0;void cycle();},
  setAccounts(next:AnalyticsAccounts){const changed=next.customer?.id!==accounts.customer?.id||next.technician?.id!==accounts.technician?.id;accounts=next;if(changed&&running){generation++;controller?.abort();void cycle();}},
  stop(){running=false;generation++;again=false;clearTimeout(timer);controller?.abort();},
 };
}
