import { expect, test } from '@playwright/test';
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:5196/__test/reset');});
test('both roles download on Wi-Fi and explicitly choose system installation',async({page})=>{
  for(const role of ['customer','technician']){
    await page.goto(`/e2e-integration/updates/index.html?role=${role}`);
    await expect(page.getByText('will download on Wi-Fi.',{exact:false})).toBeVisible();
    await expect(page.getByRole('button',{name:'Download using mobile data'})).toBeVisible();
    expect(await page.evaluate(()=>window.__updateTest.calls)).toEqual(['schedule:false']);
    await page.getByRole('button',{name:'Simulate verified download'}).click();
    await page.getByRole('button',{name:'Update now',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__updateTest.calls)).toContain('install');
    await expect(page.getByText('is awaiting Android confirmation.',{exact:false})).toBeVisible();
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
declare global {interface Window {__updateTest:{calls:string[];state:any;emit:()=>void}}}
