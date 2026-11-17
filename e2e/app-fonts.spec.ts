import {expect, test} from '@playwright/test';

test('the packaged app provides its existing text and symbol fonts without Google font hosts', async ({page}) => {
  await page.goto('/login');
  for(const family of ['Inter','Plus Jakarta Sans','Manrope','Material Symbols Rounded']) {
    await expect.poll(() => page.evaluate(name => Array.from(document.fonts).some(face => face.family.replaceAll('"','').replaceAll("'",'') === name), family)).toBe(true);
    const loaded = await page.evaluate(async name => (await document.fonts.load(`400 24px "${name}"`, name === 'Material Symbols Rounded' ? 'home' : 'ResQNow')).length, family);
    expect(loaded, `${family} is included in the app, not a fallback`).toBeGreaterThan(0);
  }
});
