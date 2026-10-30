import { expect, test } from '@playwright/test';
test('website/PWA never exposes native APK installation or calls update discovery',async({page})=>{
  const discoveries:string[]=[];
  await page.route('**/api/**',route=>{if(route.request().url().includes('/android-app/update'))discoveries.push(route.request().url());return route.fulfill({json:{}});});
  await page.goto('/about');await expect(page.getByRole('region',{name:'App updates'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Update now'})).toHaveCount(0);expect(discoveries).toEqual([]);
});
