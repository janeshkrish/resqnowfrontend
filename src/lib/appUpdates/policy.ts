type Safety={path:string;authenticated:boolean;visible:boolean;dialog:boolean;technicianBusy:boolean};
const SAFE=new Set(['/','/settings','/profile','/technician/dashboard','/technician/profile','/technician/settings']);
export function canInstallHere(s:Safety):boolean {
  return SAFE.has(s.path)&&s.authenticated&&s.visible&&!s.dialog&&!s.technicianBusy;
}
/** Unknown/malformed or completed-but-unpaid work is not safe to interrupt. */
export function hasUnfinishedWork(rows:unknown):boolean {
  if(!Array.isArray(rows))return true;
  return rows.some(row=>{
    if(!row||typeof row!=='object')return true;
    const status=String(row.serviceStatus??row.status??'').toLowerCase();
    if(['cancelled','canceled','rejected','paid'].includes(status))return false;
    return status!=='completed'||!['completed','paid'].includes(String(row.payment_status??row.paymentStatus??'').toLowerCase());
  });
}
