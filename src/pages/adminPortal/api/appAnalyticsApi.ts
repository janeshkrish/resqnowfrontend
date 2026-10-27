import {adminApi} from '@/pages/adminExtended/api/adminExtendedApi';
type Counts={installations:number;downloads:number;unattributedDownloads:number;customers:number;technicians:number};
export type InstallSummary={state:'ready';days:number;totals:Counts;period:Counts&{active:number};perDay:{date:string;installations:number;downloads:number}[];versions:{version:string;build:number;installations:number}[];health?:{dropped:number;timeouts:number;circuitOpen:boolean}};
export type InstallList={state:'ready';rows:{id:string;firstSeenDay:string;lastActiveAt:string;version:string;build:number;everLinked:boolean;customerLinks:number;technicianLinks:number}[];total:number;page:number;limit:number};
export type Disabled={state:'disabled'};
export const getAppInstallSummary=async({days}:{days:number}):Promise<InstallSummary|Disabled>=>(await adminApi.get('/portal/app-installs/summary',{params:{days}})).data;
export const listAppInstallations=async(params:{days:number;role:string;version:string;page:number;limit:number}):Promise<InstallList|Disabled>=>(await adminApi.get('/portal/app-installs',{params})).data;
