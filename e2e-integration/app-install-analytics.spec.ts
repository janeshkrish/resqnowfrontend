import {test,expect} from '@playwright/test';
const api='http://127.0.0.1:5192';
test.beforeEach(async({request,context})=>{await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return host==='127.0.0.1'||host==='localhost'?route.continue():route.abort();});expect((await request.post(api+'/__test/reset')).ok()).toBeTruthy();});
async function session(request:any){return (await request.get(api+'/__test/session')).json();}
async function totals(request:any,adminToken:string){const r=await request.get(api+'/api/admin/portal/app-installs/summary?days=30',{headers:{Authorization:`Bearer ${adminToken}`}});expect(r.status()).toBe(200);return r.json();}

test('offline withdrawal survives re-consent and collector restart, removing historical account links',async({page,context,request})=>{
 const auth=await session(request);await page.goto('/e2e-integration/collector.html');await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();await page.getByRole('button',{name:'Sign in customer',exact:true}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.customers).toBe(1);
 await context.setOffline(true);await page.getByRole('button',{name:'Withdraw consent',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();await page.getByRole('button',{name:'Restart collector',exact:true}).click();await context.setOffline(false);
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.customers).toBe(0);
 await expect.poll(async()=>(await totals(request,auth.adminToken)).period.active).toBe(1);
 expect((await totals(request,auth.adminToken)).totals.installations).toBe(1);
});
test('mobile-web APK action persists one real download session; HEAD and ranges do not inflate it',async({page,request})=>{
 // The existing download control belongs to the mobile customer layout, not the desktop marketing landing page.
 const auth=await session(request);await page.setViewportSize({width:390,height:844});await page.goto('/');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/^download$/i}).click();await download;
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.downloads).toBe(1);
 const id=crypto.randomUUID(),url=api+'/api/public/android-app/download?download_id='+id;
 expect((await request.head(url)).status()).toBe(200);
 expect((await request.get(url,{headers:{Range:'bytes=0-9'}})).status()).toBe(206);
 await request.get(url,{headers:{Range:'bytes=10-19'}});
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.downloads).toBe(2);
 expect((await request.get(api+'/__test/counts')).ok()).toBeTruthy();
});
test('real collector/API: retry/update/withdraw/re-consent do not create duplicate installations',async({page,request,context})=>{
 const auth=await session(request);await page.goto('/e2e-integration/collector.html');
 expect((await totals(request,auth.adminToken)).totals.installations).toBe(0);
 await context.setOffline(true);await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();await context.setOffline(false);
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.installations).toBe(1);
 await page.getByRole('button',{name:'Sign in customer',exact:true}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.customers).toBe(1);
 await page.getByRole('button',{name:'Sign in technician',exact:true}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.technicians).toBe(1);
 await page.getByRole('button',{name:'Restart collector'}).click();await page.getByRole('button',{name:'Report updated version'}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).versions[0]?.version).toBe('1.4');
 await page.getByRole('button',{name:'Withdraw consent'}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).period.active).toBe(0);
 expect((await totals(request,auth.adminToken)).totals.installations).toBe(1);
 await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).period.active).toBe(1);
 expect((await request.get(api+'/__test/counts').then(r=>r.json())).installations).toBe(1);
});
test('two simulated phones with one authenticated customer count as two installations and one account',async({page,context,request})=>{
 const auth=await session(request);await page.goto('/e2e-integration/collector.html');await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();await page.getByRole('button',{name:'Sign in customer',exact:true}).click();
 const second=await context.newPage();await second.goto('/e2e-integration/collector.html');await second.getByRole('button',{name:'Allow app analytics',exact:true}).click();await second.getByRole('button',{name:'Sign in customer',exact:true}).click();
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.installations).toBe(2);
 await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.customers).toBe(1);
 await expect.poll(async()=>(await request.get(api+'/__test/counts').then(r=>r.json())).links).toBe(2);
 await second.close();
});
test('actual admin page shows persisted counts and filters; disabled means disabled, not zero',async({page,request})=>{
 await page.goto('/e2e-integration/collector.html');await page.getByRole('button',{name:'Allow app analytics',exact:true}).click();
 const auth=await session(request);await expect.poll(async()=>(await totals(request,auth.adminToken)).totals.installations).toBe(1);
 await page.getByRole('button',{name:'Open admin'}).click();await expect(page.getByTestId('analytics-installations')).toContainText('1');
 await page.getByRole('radio',{name:'7 days'}).click();await expect(page.getByRole('radio',{name:'7 days'})).toHaveAttribute('aria-checked','true');
 await page.screenshot({path:`output/playwright/analytics/admin-${test.info().project.name}.png`,fullPage:true});
 await request.post(api+'/__test/availability',{data:{enabled:false}});await page.reload();await expect(page.getByText('App analytics is disabled')).toBeVisible();await expect(page.getByTestId('analytics-installations')).toHaveCount(0);
});
test('admin auth, spoofed accounts, invalid proofs and analytics outage are isolated',async({request})=>{
 const auth=await session(request);expect((await request.get(api+'/api/admin/portal/app-installs/summary')).status()).toBe(401);
 expect((await request.get(api+'/api/admin/portal/app-installs/summary',{headers:{Authorization:`Bearer ${auth.customerToken}`}})).status()).toBe(403);
 const body={installationId:crypto.randomUUID(),installationSecret:'a'.repeat(64),consentRevision:1,consentPolicyVersion:'2026-10-27',appId:'com.resqnow1.app',versionName:'1.3',versionCode:4};
 expect((await request.post(api+'/api/app-analytics/installations/register',{data:body})).status()).toBe(201);
 expect((await request.post(api+'/api/app-analytics/installations/register',{data:{...body,installationSecret:'b'.repeat(64)}})).status()).toBe(403);
 expect((await request.post(api+'/api/app-analytics/accounts/customer/link',{headers:{Authorization:`Bearer ${auth.customerToken}`},data:{installationId:body.installationId,installationSecret:body.installationSecret,consentRevision:1,accountId:auth.technicianId}})).status()).toBe(400);
 await request.post(api+'/__test/availability',{data:{unavailable:true}});
 expect((await request.get(api+'/api/admin/portal/app-installs/summary',{headers:{Authorization:`Bearer ${auth.adminToken}`}})).status()).toBe(503);
 expect((await request.get(api+'/__test/business')).status()).toBe(200);
 expect((await request.get(api+'/api/public/android-app/download')).status()).toBe(200);
});
