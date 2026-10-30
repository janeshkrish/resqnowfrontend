import { parseRelease } from './client';
import type { AndroidRelease, AppUpdater, ReleaseOffer, UpdateSnapshot } from './types';
export type UpdateView={snapshot:UpdateSnapshot|null;offer:AndroidRelease|null;checking:boolean;message:string};
interface Dependencies {bridge:AppUpdater;offer:()=>Promise<ReleaseOffer>;now:()=>number;isSafe:()=>boolean;confirmSafe:()=>Promise<boolean>;changed:(state:UpdateView)=>void}
export class UpdateController {
  private view:UpdateView={snapshot:null,offer:null,checking:false,message:''};
  private disposed=false;private checking:Promise<void>|null=null;private lastSuccess:number|null=null;private lastFailure:number|null=null;private safetyEpoch=0;private actionBusy=false;
  constructor(private readonly d:Dependencies){}
  private emit(patch:Partial<UpdateView>){if(this.disposed)return;this.view={...this.view,...patch};this.d.changed(this.view);}
  receive=(snapshot:UpdateSnapshot)=>{this.emit({snapshot});};
  private async sync(){const s=await this.d.bridge.getState();if(!this.disposed)this.receive(s);return s;}
  check(force=false):Promise<void>{
    if(this.disposed)return Promise.resolve();if(this.checking)return this.checking;
    this.checking=this.performCheck(force).finally(()=>{this.checking=null;});return this.checking;
  }
  private async performCheck(force:boolean){
    this.emit({checking:true});
    try{
      const s=await this.sync();if(this.disposed||!s.enabled)return;
      const now=this.d.now();
      if(this.lastFailure!==null&&now>=this.lastFailure&&now-this.lastFailure<30000)return;
      if(!force&&this.lastSuccess!==null&&now>=this.lastSuccess&&now-this.lastSuccess<21600000)return;
      const response=await this.d.offer();if(this.disposed)return;
      this.lastSuccess=this.d.now();this.lastFailure=null;
      const release=response.state==='ready'?parseRelease(response.release):null;
      const eligible=release&&release.versionCode>s.installedVersionCode&&release.minSdk<=s.sdkVersion;
      this.emit({offer:eligible?release:null,message:''});
      if(eligible&&(!s.release||s.release.versionCode<release.versionCode)&&!['installing','downloading','verifying','queued'].includes(s.phase)){
        const next=await this.d.bridge.scheduleDownload({release,allowMetered:false});this.receive(next);
      }
    }catch{this.lastSuccess=null;this.lastFailure=this.d.now();this.emit({message:'Could not check for updates. Please try again later.'});}
    finally{this.emit({checking:false});}
  }
  private async action(task:()=>Promise<void>){if(this.disposed||this.actionBusy)return;this.actionBusy=true;try{await task();}catch{this.emit({message:'The update action could not finish. Please try again.'});}finally{this.actionBusy=false;}}
  download(allowMetered=false){return this.action(async()=>{
    const s=await this.sync();if(this.disposed||!s.enabled)return;
    const candidate=[s.release,this.view.offer].filter((r):r is AndroidRelease=>Boolean(r)).sort((a,b)=>b.versionCode-a.versionCode)[0];
    if(candidate&&candidate.versionCode>s.installedVersionCode){this.receive(await this.d.bridge.scheduleDownload({release:parseRelease(candidate),allowMetered}));this.emit({message:''});}
  });}
  cancel(){this.invalidateSafety();return this.action(async()=>{this.receive(await this.d.bridge.cancelDownload());this.emit({message:''});});}
  invalidateSafety(){this.safetyEpoch++;void this.d.bridge.cancelInstallPreparation().catch(()=>{});}
  private async permitted(epoch:number){return !this.disposed&&epoch===this.safetyEpoch&&this.d.isSafe();}
  install(){const epoch=this.safetyEpoch;return this.action(async()=>{
    if(!await this.permitted(epoch)||!await this.d.confirmSafe()||!await this.permitted(epoch)){this.emit({message:'Finish your current request or job before installing an update.'});return;}
    const s=await this.sync();if(!await this.permitted(epoch)||!s.enabled||!['ready','permission-required'].includes(s.phase))return;
    this.receive(await this.d.bridge.requestInstall());
  });}
  openPermissionSettings(){const epoch=this.safetyEpoch;return this.action(async()=>{
    if(await this.permitted(epoch)&&await this.d.confirmSafe()&&await this.permitted(epoch))await this.d.bridge.openInstallPermissionSettings();
  });}
  dispose(){this.invalidateSafety();this.disposed=true;}
}
