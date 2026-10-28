import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const verificationSettings=Object.freeze({
  CI:'true',VITE_FRONTEND_ONLY:'false',VITE_API_URL:'http://api.e2e.test',
  VITE_FIREBASE_API_KEY:'e2e-firebase-key',VITE_FIREBASE_AUTH_DOMAIN:'resqnow-e2e.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'resqnow-e2e',VITE_FIREBASE_STORAGE_BUCKET:'',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'100000000000',VITE_FIREBASE_APP_ID:'1:100000000000:web:e2e',
  VITE_FIREBASE_VAPID_KEY:'',VITE_NATIVE_BACKGROUND_TRACKING:'',VITE_APP_UPDATES_ENABLED:'false',
});

// Pass OS/tool locations, not application credentials, tokens, Node preload
// options or a developer's production VITE_* values, to verification children.
export function createVerificationEnvironment(host={}){
  const allowed=new Set(['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','HOME','USERPROFILE','HOMEDRIVE','HOMEPATH','TEMP','TMP','TMPDIR','LOCALAPPDATA','APPDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','PLAYWRIGHT_BROWSERS_PATH','NPM_CONFIG_CACHE','LANG','LC_ALL']);
  const env=Object.fromEntries(Object.entries(host).filter(([name,value])=>allowed.has(name.toUpperCase())&&typeof value==='string'));
  return {...env,...verificationSettings,NODE_ENV:'test'};
}

async function testInventory(root,pattern){
  const found=[];
  async function visit(dir){
    let entries;
    try{entries=await fs.readdir(dir,{withFileTypes:true});}
    catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries){
      if(entry.name==='node_modules'||entry.name==='.git')continue;
      const file=path.join(dir,entry.name);
      if(entry.isDirectory())await visit(file);
      else if(entry.isFile()&&pattern.test(entry.name))found.push(file);
    }
  }
  await visit(root);return found.sort();
}
const fail=(label,message)=>{throw Error(label+': '+message);};
const positive=n=>Number.isSafeInteger(n)&&n>0;
const zero=n=>n===0;
const slash=value=>value.replaceAll('\\','/');

function assertCompleteTap(text){
  const counts={};
  for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
    const matches=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];
    if(matches.length!==1)fail('Node test report','missing or duplicate '+key+' summary');
    counts[key]=Number(matches[0][1]);
  }
  if(!positive(counts.tests)||counts.pass!==counts.tests||['fail','cancelled','skipped','todo'].some(k=>!zero(counts[k])))fail('Node test report','all discovered tests must execute and pass');
  return counts;
}

async function readReport(file,label){
  try{
    const info=await fs.stat(file);
    if(!info.isFile()||info.size>64*1024*1024)throw Error('invalid report size');
    return JSON.parse(await fs.readFile(file,'utf8'));
  }catch{fail(label,'missing or invalid fresh JSON report');}
}
function assertUnitReport(report,files,cwd){
  const label='Unit report';
  if(report.success!==true||!positive(report.numTotalTests)||report.numPassedTests!==report.numTotalTests||
    ['numFailedTests','numFailedTestSuites','numPendingTests','numPendingTestSuites','numTodoTests'].some(k=>!zero(report[k])))fail(label,'failed, skipped, todo or missing tests');
  if(!Array.isArray(report.testResults)||!report.testResults.length)fail(label,'no test files reported');
  const seen=new Set();let count=0;
  for(const file of report.testResults){
    if(file.status!=='passed'||!Array.isArray(file.assertionResults)||!file.assertionResults.length||file.assertionResults.some(t=>t.status!=='passed'))fail(label,'every assertion must pass');
    const name=path.resolve(cwd,file.name);if(seen.has(name))fail(label,'duplicate test file');
    seen.add(name);count+=file.assertionResults.length;
  }
  if(count!==report.numTotalTests||files.some(file=>!seen.has(file)))fail(label,'test inventory does not match executed assertions');
  return {files:seen.size,passed:count};
}

// These existing tests cover responsive behaviors that deliberately do not
// exist on the other viewport. A skipped case must pass on its counterpart
// project too; arbitrary skips, fixme and expected-failure annotations fail.
const viewportRules=[
  {project:'desktop',file:'account.spec.ts',title:'with the bottom bar switched off, phones keep the top bar as the way home',reason:'The bottom bar is only on phones'},
  {project:'desktop',file:'customer-tracking.spec.ts',suite:'the card changes size on a phone',reason:'On a wide screen the card sits beside the map and does not move.'},
  {project:'desktop',file:'customer-tracking.spec.ts',suite:'on a phone',reason:'The map beside the card on a wide screen is not moved by the card.'},
  {project:'desktop',file:'finding-technician.spec.ts',title:'on a phone the strip over the map says the same thing',reason:'The card only shrinks to a strip on a phone'},
  {project:'desktop',file:'home-active-request.spec.ts',reason:'The active request card is part of the phone home screen only.'},
  {project:'desktop',file:'live-radar.spec.ts',suite:'Live radar on a phone',reason:'The draggable sheet is phone-only'},
  {project:'phone',file:'live-radar.spec.ts',suite:'Live radar on a large screen',reason:'Side panel is for tablets and desktops'},
];
function assertBrowserReport(report,files,cwd){
  const label='Browser report';
  const projects=report.config?.projects?.map(p=>p.name).sort();
  if(JSON.stringify(projects)!==JSON.stringify(['desktop','phone'])||!Array.isArray(report.errors)||report.errors.length||
    !report.stats||!zero(report.stats.unexpected)||!zero(report.stats.flaky))fail(label,'missing projects, worker errors or flaky/failed tests');
  // Current Playwright JSON emits one spec entry per project, even for the
  // same source test. Normalize by source identity before checking coverage.
  const cases=new Map();
  function visit(suites,parents=[]){
    if(!Array.isArray(suites))fail(label,'invalid suites');
    for(const suite of suites){
      const titles=[...parents,suite.title];
      for(const spec of suite.specs||[]){
        if(!spec.ok||!Array.isArray(spec.tests))fail(label,'invalid or failing source case');
        const key=JSON.stringify([slash(spec.file),spec.line,spec.column,titles,spec.title]);
        if(!cases.has(key))cases.set(key,{spec:{...spec,tests:[]},titles});
        cases.get(key).spec.tests.push(...spec.tests);
      }
      visit(suite.suites||[],titles);
    }
  }
  visit(report.suites);
  if(!cases.size)fail(label,'no test cases reported');
  let passed=0,skipped=0;const seen=new Set();
  for(const {spec,titles} of cases.values()){
    const file=slash(spec.file).replace(/^e2e\//,'');
    seen.add(path.resolve(cwd,'e2e',file));
    if(!spec.ok||!Array.isArray(spec.tests)||spec.tests.length!==2||
      new Set(spec.tests.map(t=>t.projectName)).size!==2||spec.tests.some(t=>!['phone','desktop'].includes(t.projectName)))fail(label,'each case must cover both projects');
    for(const t of spec.tests){
      if(!Array.isArray(t.results)||t.results.length!==1)fail(label,'missing or retried case');
      const result=t.results[0];
      if(result.retry!==0||(result.errors||[]).length)fail(label,'failed or retried result');
      if(t.status==='expected'&&t.expectedStatus==='passed'&&result.status==='passed'){passed++;continue;}
      if(t.status!=='skipped'||t.expectedStatus!=='skipped'||result.status!=='skipped')fail(label,'unexpected test result');
      const annotations=[...(t.annotations||[]),...(result.annotations||[])];
      const rule=viewportRules.find(r=>r.project===t.projectName&&r.file===file&&(!r.title||r.title===spec.title)&&(!r.suite||titles.includes(r.suite))&&annotations.some(a=>a.type==='skip'&&a.description===r.reason));
      const other=spec.tests.find(x=>x.projectName!==t.projectName);
      if(!rule||other?.status!=='expected'||other.expectedStatus!=='passed'||other.results?.[0]?.status!=='passed')fail(label,'unexpected skip or no passing counterpart');
      skipped++;
    }
  }
  if(!positive(passed)||report.stats.expected!==passed||report.stats.skipped!==skipped||files.some(file=>!seen.has(file)))fail(label,'reported results do not cover the full test inventory');
  return {passed,viewportSkips:skipped,cases:cases.size};
}

async function runCommand(command,args,env,cwd){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;process.stdout.write(chunk);});
    child.stderr.on('data',chunk=>{stderr+=chunk;process.stderr.write(chunk);});
    child.once('error',reject);
    child.once('close',code=>resolve({code:code??1,stdout,stderr}));
  });
}

export async function runReleaseChecks({run,env,cwd=process.cwd()}){
  cwd=path.resolve(cwd);
  const privateEnv=(await fs.readdir(cwd)).find(name=>/^\.env(?:\.|$)/i.test(name)&&!/^\.env(?:\..+)?\.example$/i.test(name));
  if(privateEnv)fail('Verification','non-example env file present: '+privateEnv);
  for(const [key,value] of Object.entries(verificationSettings))if(env?.[key]!==value)fail('Verification setting',key+' must use the isolated synthetic value');
  const childEnv=createVerificationEnvironment(env);
  const unitFiles=await testInventory(path.join(cwd,'src'),/\.(?:test|spec)\.[cm]?[jt]sx?$/);
  const browserFiles=await testInventory(path.join(cwd,'e2e'),/\.spec\.ts$/);
  const scriptFiles=await testInventory(path.join(cwd,'scripts'),/\.test\.mjs$/);
  if(!unitFiles.length||!browserFiles.length||!scriptFiles.length)fail('Test inventory','unit, browser and Node-script cases are all required');
  for(const file of ['node_modules/typescript/bin/tsc','node_modules/vitest/vitest.mjs','node_modules/@playwright/test/cli.js','node_modules/vite/bin/vite.js','tsconfig.app.json','playwright.config.ts','vitest.config.ts']){
    try{if(!(await fs.stat(path.join(cwd,file))).isFile())throw Error();}
    catch{fail('Verification','required local dependency/config missing: '+file);}
  }
  const reports=path.join(cwd,'output/quality/runs',randomUUID());
  await fs.mkdir(reports,{recursive:true});
  const execute=run||((command,args,env)=>runCommand(command,args,env,cwd));
  async function gate(name,args,extra={}){
    console.log('[release-quality] '+name);
    const result=await execute(process.execPath,args,{...childEnv,...extra});
    if(result?.code!==0)fail('Release check '+name,'exit '+String(result?.code));
    return result;
  }
  await gate('typecheck',[path.join(cwd,'node_modules/typescript/bin/tsc'),'--noEmit','-p','tsconfig.app.json']);
  const scripts=await gate('Node scripts',['--test','--test-reporter=tap',...scriptFiles]);
  await fs.writeFile(path.join(reports,'scripts.tap'),scripts.stdout);
  const node=assertCompleteTap(scripts.stdout);
  const unitPath=path.join(reports,'unit.json');
  await gate('unit',[path.join(cwd,'node_modules/vitest/vitest.mjs'),'run','--pool=threads','--maxWorkers=1','--reporter=default','--reporter=json','--outputFile',unitPath]);
  const unit=assertUnitReport(await readReport(unitPath,'Unit report'),unitFiles,cwd);
  const browserPath=path.join(reports,'browser.json');
  await gate('browser',[path.join(cwd,'node_modules/@playwright/test/cli.js'),'test','--forbid-only','--trace=off','--retries=0','--workers=2','--reporter=line,json'],{PLAYWRIGHT_JSON_OUTPUT_FILE:browserPath});
  const browser=assertBrowserReport(await readReport(browserPath,'Browser report'),browserFiles,cwd);
  await gate('production build',[path.join(cwd,'node_modules/vite/bin/vite.js'),'build'],{NODE_ENV:'production'});
  await fs.writeFile(path.join(reports,'summary.json'),JSON.stringify({completedAt:new Date().toISOString(),node,unit,browser,stages:['typecheck','Node scripts','unit','browser','production build']},null,2));
  console.log('[release-quality] All checks passed. Evidence: '+path.relative(cwd,reports));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  runReleaseChecks({env:createVerificationEnvironment(process.env)}).catch(error=>{
    console.error('[release-quality] '+error.message);
    process.exitCode=1;
  });
}
