export type NativeIdentity={installationId:string;installationSecret:string;appId:string;versionName:string;versionCode:number;consentRevision:number;consentPolicyVersion:string;consentGranted:boolean;consentDecided:boolean;everConsented:boolean;acknowledgedRevision:number;pendingWithdrawalRevision:number};
export interface NativeInstallation {getIdentity():Promise<NativeIdentity>;acknowledge(options:{revision:number;withdrawal?:boolean}):Promise<unknown>}
export type AnalyticsAccount={id:string;getToken:()=>string|null};
export type AnalyticsAccounts={customer:AnalyticsAccount|null;technician:AnalyticsAccount|null};
export type AnalyticsTransport=(path:string,body:Record<string,unknown>,token?:string|null,signal?:AbortSignal)=>Promise<{status:number}>;
