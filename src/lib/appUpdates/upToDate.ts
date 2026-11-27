const KEY='resqnow_update_expected';

/** Remembers the version the customer chose to install, so the app can say so once it is running. */
export function expectUpdate(versionCode:number){try{localStorage.setItem(KEY,String(versionCode));}catch{/* private mode: no note */}}

/** Once the installed version reaches the expected one, returns its name a single time. */
export function takeUpToDate(installedVersionCode:number,installedVersionName?:string):string|null{
  try{
    const expected=Number(localStorage.getItem(KEY));
    if(!Number.isSafeInteger(expected)||expected<=0||installedVersionCode<expected)return null;
    localStorage.removeItem(KEY);
    return installedVersionName||String(installedVersionCode);
  }catch{return null;}
}
