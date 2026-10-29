// Optional real-browser layout check. No browser or package is downloaded.
// CHROME=/path/to/chrome PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/materials-browser.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = mkdtempSync(join(tmpdir(), 'materials-browser-'));
const root = new URL('../', import.meta.url);
const script = new URL('skills/creator-toy-intro/engine/scripts/materials.mjs', root);
const { mkdirSync } = await import('node:fs');
mkdirSync(join(dir, 'research'));
const f = JSON.parse(readFileSync(new URL('tests/fixtures/story-comparison.json', root)))[1];
const original = f.directions[0];
f.directions = Array.from({length:3}, (_, i) => ({...structuredClone(original), id: `d${i}`, hookAlternatives: [{question:'What should editors check?',visual:'Show the original demo',text:'Before export',why:'A concrete task'}]}));
f.recommendedDirection='d0';
f.selectionNotes=['A viral but unrelated post does not explain the tool.'];
writeFileSync(join(dir,'research/facts.json'),JSON.stringify(f));
const browser = await chromium.launch({executablePath:process.env.CHROME || undefined});
try {
  for (const lang of ['en','zh-Hant','zh-Hans']) {
    const result=spawnSync(process.execPath,[script.pathname,dir,'--html-only','--lang',lang],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    for (const width of [390,700,1200]) {
      const page=await browser.newPage({viewport:{width,height:844}});
      await page.goto(pathToFileURL(join(dir,'research/materials.html')).href);
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.stories')).gridTemplateColumns.split(' ').length}));
      assert.ok(layout.scroll<=layout.width,`${lang} ${width}: horizontal overflow ${layout.scroll}`);
      assert.equal(layout.columns,width<=700?1:2);
      await page.locator('.ask').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.ask').isVisible());
      await page.screenshot({path:join(dir,`${lang}-${width}.png`),fullPage:true});
      await page.close();
      console.log(`${lang} ${width}px: fits viewport; choice prompt reachable; full-page capture passed`);
    }
  }
} finally {await browser.close();rmSync(dir,{recursive:true,force:true});}
