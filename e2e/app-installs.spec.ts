import {test,expect} from '@playwright/test';import {openPortal,noSideScroll} from './fixtures/adminPortal';
// Simulated-backend UI coverage only. Real persistence is in e2e-integration/.
test('app analytics filters, safe text and responsive layout',async({page})=>{
 let requestedDays='30';
 const {errors}=await openPortal(page,'/admin/app-installs',{extra:async({path,url,reply})=>{
  if(path==='/api/admin/portal/app-installs/summary'){requestedDays=url.searchParams.get('days')||'30';await reply(200,{state:'ready',days:Number(requestedDays),totals:{installations:123,downloads:300,customers:80,technicians:40,unattributedDownloads:4},period:{installations:12,downloads:20,customers:8,technicians:3,active:12},perDay:[{date:'2026-10-27',installations:12}],versions:[{version:'<script>test</script>',build:5,installations:12}]});return true;}
  if(path==='/api/admin/portal/app-installs'){await reply(200,{state:'ready',rows:[],total:0,page:1,limit:25});return true;}
 }});
 await expect(page.getByTestId('analytics-installations')).toContainText('123');await page.getByRole('radio',{name:'7 days'}).click();await expect.poll(()=>requestedDays).toBe('7');
 expect(await noSideScroll(page)).toBe(true);expect(errors).toEqual([]);
});
test('app analytics API failure is not presented as zero counts',async({page})=>{
 await openPortal(page,'/admin/app-installs',{extra:async({path,reply})=>{if(path.startsWith('/api/admin/portal/app-installs')){await reply(503,{error:'App analytics temporarily unavailable'});return true;}}});
 await expect(page.getByText('App analytics temporarily unavailable',{exact:true})).toBeVisible();await expect(page.getByTestId('analytics-installations')).toHaveCount(0);
});
