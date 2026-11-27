import { expect, test } from '@playwright/test';
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:5196/__test/reset');});
test('both roles download on Wi-Fi and explicitly choose system installation',async({page})=>{
  for(const role of ['customer','technician']){
    await page.goto(`/e2e-integration/updates/index.html?role=${role}`);
    await expect(page.getByText('will download on Wi-Fi',{exact:false})).toBeVisible();
    await expect(page.getByRole('button',{name:'Use mobile data now'})).toBeVisible();
    expect(await page.evaluate(()=>window.__updateTest.calls)).toEqual(['schedule:false']);
    await page.getByRole('button',{name:'Simulate verified download'}).click();
    await page.getByRole('button',{name:'Update now',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__updateTest.calls)).toContain('install');
    await expect(page.getByText('is waiting for Android',{exact:false})).toBeVisible();
  }
});
test('permission return needs a fresh tap and critical routes defer installation',async({page})=>{
  await page.goto('/e2e-integration/updates/index.html?phase=permission-required');
  await page.getByRole('button',{name:'Allow app updates'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__updateTest.calls)).toEqual(['settings']);
  await page.getByRole('button',{name:'Simulate permission return'}).click();
  expect(await page.evaluate(()=>window.__updateTest.calls)).not.toContain('install');
  await page.getByRole('button',{name:'Enter payment flow'}).click();
  await expect(page.getByRole('button',{name:'Update now',exact:true})).toBeDisabled();
});
test('real API errors are non-blocking and no account identity reaches discovery',async({page,request})=>{
  await request.post('http://127.0.0.1:5196/__test/unavailable');
  await page.goto('/e2e-integration/updates/index.html');
  await expect(page.getByText('Could not check for updates. Please try again later.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Check for updates'})).toBeEnabled();
  const seen=await (await request.get('http://127.0.0.1:5196/__test/requests')).json();expect(seen).toEqual([{authorization:false,cookie:false}]);
});
test('a ready update shows on Home under the header; Later hides it for this version',async({page})=>{
  await page.goto('/e2e-integration/updates/index.html?home=1&phase=ready');
  const banner=page.getByRole('status',{name:'App update'});
  await expect(banner).toContainText('New version ready');
  await expect(banner).toContainText('1.4.12 · ready to install');
  await expect.poll(()=>page.evaluate(()=>window.__updateTest.quiet.at(-1))).toBe(false);
  await page.getByRole('button',{name:'Later. Hide this until tomorrow'}).click();
  await expect(banner).toHaveCount(0);
  await page.goto('/e2e-integration/updates/index.html?home=1&phase=ready');
  await expect(page.getByText('Route:')).toBeVisible();
  await expect(page.getByRole('status',{name:'App update'})).toHaveCount(0);
});
test('Update on the Home banner hands over to Android and is remembered for the up-to-date note',async({page})=>{
  await page.goto('/e2e-integration/updates/index.html?home=1&phase=ready');
  await page.getByRole('button',{name:'Update',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__updateTest.calls)).toContain('install');
  expect(await page.evaluate(()=>localStorage.getItem('resqnow_update_expected'))).toBe('12');
});
test('tapping the phone notification opens App updates',async({page})=>{
  await page.goto('/e2e-integration/updates/index.html?home=1&phase=ready');
  await expect(page.getByRole('status',{name:'App update'})).toBeVisible();
  await page.evaluate(()=>window.__updateTest.openAlert());
  await expect(page.getByLabel('Route')).toHaveText('/settings#app-updates');
  await expect(page.getByRole('heading',{name:'App updates'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Update now',exact:true})).toBeEnabled();
});
test('after updating, the app says once that it is up to date',async({page})=>{
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('resqnow_update_expected','4');}});
  await page.goto('/e2e-integration/updates/index.html?home=1');
  await expect(page.getByText("You're up to date · 1.3")).toBeVisible();
  await page.getByRole('button',{name:'OK'}).click();
  await expect(page.getByText("You're up to date · 1.3")).toHaveCount(0);
  await page.goto('/e2e-integration/updates/index.html?home=1');
  await expect(page.getByText('Route:')).toBeVisible();
  await expect(page.getByText("You're up to date · 1.3")).toHaveCount(0);
});
declare global {interface Window {__updateTest:{calls:string[];quiet:boolean[];state:any;emit:()=>void;openAlert:()=>void}}}
