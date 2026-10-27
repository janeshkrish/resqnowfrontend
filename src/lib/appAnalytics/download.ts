export function buildTrackedApkDownloadUrl(baseUrl:string,downloadId:string):string{
 const url=new URL(baseUrl,window.location.origin);url.searchParams.set('download_id',downloadId);return url.toString();
}
