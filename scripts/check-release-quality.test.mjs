import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const api=await import('./check-release-quality.mjs').catch(()=>({}));
const script=fileURLToPath(new URL('./check-release-quality.mjs',import.meta.url));
const settings={
  CI:'true',VITE_FRONTEND_ONLY:'false',VITE_API_URL:'http://api.e2e.test',
  VITE_FIREBASE_API_KEY:'e2e-firebase-key',VITE_FIREBASE_AUTH_DOMAIN:'resqnow-e2e.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'resqnow-e2e',VITE_FIREBASE_STORAGE_BUCKET:'',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'100000000000',VITE_FIREBASE_APP_ID:'1:100000000000:web:e2e',
  VITE_FIREBASE_VAPID_KEY:'',VITE_NATIVE_BACKGROUND_TRACKING:'',VITE_APP_UPDATES_ENABLED:'false',
};
const tap='# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
function runChecks(options){
  assert.equal(typeof api.runReleaseChecks,'function','release-quality runner must exist');
  return api.runReleaseChecks(options);
}
async function fixture(body){
  const base=await fs.realpath(os.tmpdir());
  const cwd=await fs.mkdtemp(path.join(base,'resqnow-quality-'));
  const put=async(name,data='')=>{const file=path.join(cwd,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);};
  for(const file of ['src/contract.test.ts','e2e/contract.spec.ts','scripts/check-release-quality.test.mjs','node_modules/typescript/bin/tsc','node_modules/vitest/vitest.mjs','node_modules/@playwright/test/cli.js','node_modules/vite/bin/vite.js','tsconfig.app.json','playwright.config.ts','vitest.config.ts'])await put(file);
  const calls=[];
  let unitChange=x=>x,browserChange=x=>x;
  const adapter=async(command,args,env)=>{
    calls.push({command,args,env});
    if(args.includes('--test'))return {code:0,stdout:tap,stderr:''};
    if(args.some(arg=>arg.endsWith('/vitest.mjs')||arg.endsWith('\\vitest.mjs'))){
      const name=path.join(cwd,'src/contract.test.ts');
      const report={success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,numTotalTestSuites:1,numPassedTestSuites:1,numFailedTestSuites:0,numPendingTestSuites:0,testResults:[{name,status:'passed',assertionResults:[{title:'keeps contract',fullName:'keeps contract',status:'passed'}]}]};
      await fs.writeFile(args[args.indexOf('--outputFile')+1],JSON.stringify(unitChange(report)));
    }
    if(args.some(arg=>arg.endsWith('/@playwright/test/cli.js')||arg.endsWith('\\@playwright\\test\\cli.js'))){
      const result={status:'passed',retry:0,errors:[],annotations:[]};
      const tests=['phone','desktop'].map(projectName=>({projectName,expectedStatus:'passed',status:'expected',annotations:[],results:[{...result}]}));
      const report={config:{projects:[{name:'phone'},{name:'desktop'}]},errors:[],stats:{expected:2,unexpected:0,flaky:0,skipped:0},suites:[{title:'contract.spec.ts',file:'contract.spec.ts',specs:[{title:'keeps contract',file:'contract.spec.ts',ok:true,tests}],suites:[]}]};
      await fs.writeFile(env.PLAYWRIGHT_JSON_OUTPUT_FILE,JSON.stringify(browserChange(report)));
    }
    return {code:0,stdout:'',stderr:''};
  };
  try{await body({cwd,put,calls,adapter,setUnit:f=>unitChange=f,setBrowser:f=>browserChange=f});}
  finally{
    const target=await fs.realpath(cwd);
    assert.equal(path.dirname(target),base);
    assert.ok(path.basename(target).startsWith('resqnow-quality-'));
    await fs.rm(target,{recursive:true,force:true});
  }
}

test('runs every required gate with synthetic settings and no test-name/project filters',async()=>{
  await fixture(async({cwd,calls,adapter})=>{
    await runChecks({cwd,env:{...settings},run:adapter});
    assert.equal(calls.length,5);
    assert.ok(calls[0].args.includes('--noEmit'));
    assert.ok(calls[1].args.includes('--test'));
    assert.ok(calls[2].args.includes('run'));
    assert.ok(calls[3].args.includes('test'));
    assert.ok(calls[3].args.includes('--forbid-only'),'browser gate must reject exclusive tests');
    assert.ok(calls[3].args.includes('--workers=1'),'real-time audio cases use one browser worker, with all inventory and zero-retry checks retained');
    assert.ok(calls[4].args.includes('build'));
    assert.equal(calls[3].env.CI,'true');
    assert.equal(calls[4].env.VITE_FRONTEND_ONLY,'false');
    assert.equal(calls[4].env.VITE_API_URL,'https://resqnowbackend-production-c392.up.railway.app');
    assert.ok(!calls.some(x=>x.args.some(a=>/^--(?:grep|project|passWithNoTests|update)/.test(a))));
  });
});
test('keeps executable tests synthetic and uses the approved origin only for the static production bundle',async()=>{
  await fixture(async({cwd,calls,adapter})=>{
    await runChecks({cwd,env:{...settings},run:adapter});
    assert.equal(calls.length,5);
    for(const call of calls.slice(0,4))assert.equal(call.env.VITE_API_URL,'http://api.e2e.test');
    assert.equal(calls[4].env.VITE_API_URL,'https://resqnowbackend-production-c392.up.railway.app');
    assert.equal(calls[4].env.VITE_FIREBASE_API_KEY,'e2e-firebase-key');
    assert.equal(calls[4].env.VITE_APP_UPDATES_ENABLED,'false');
    assert.equal(calls[4].env.NODE_ENV,'production');
  });
});
for(const failedIndex of [0,2,4])test('a failing child gate '+failedIndex+' prevents all later gates',async()=>{
  await fixture(async({cwd,calls,adapter})=>{
    const run=async(...args)=>{if(calls.length===failedIndex){calls.push({args});return {code:9,stdout:'',stderr:'deliberate failure'};}return adapter(...args);};
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run}),/exit 9/);
    assert.equal(calls.length,failedIndex+1);
  });
});
test('missing verification configuration fails before any child starts',async()=>{
  await fixture(async({cwd,calls,adapter})=>{
    const env={...settings};delete env.VITE_API_URL;
    await assert.rejects(()=>runChecks({cwd,env,run:adapter}),/verification setting/i);
    assert.equal(calls.length,0);
  });
});
test('production endpoints or enabled updater settings cannot enter verification',async()=>{
  for(const bad of [{VITE_API_URL:'https://production.example.test'},{VITE_APP_UPDATES_ENABLED:'true'}]){
    await fixture(async({cwd,calls,adapter})=>{
      await assert.rejects(()=>runChecks({cwd,env:{...settings,...bad},run:adapter}),/verification setting/i);
      assert.equal(calls.length,0);
    });
  }
});
test('refuses non-example env files without exposing their contents',async()=>{
  await fixture(async({cwd,put,calls,adapter})=>{
    await put('.env.production.local','PRIVATE_SENTINEL_DO_NOT_PRINT');
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),e=>/env file/i.test(e.message)&&!e.message.includes('PRIVATE_SENTINEL'));
    assert.equal(calls.length,0);
  });
});
test('an example env file is permitted but never supplies missing verification settings',async()=>{
  await fixture(async({cwd,put,calls,adapter})=>{
    await put('.env.example','VITE_API_URL=https://not-used.example.test');
    await runChecks({cwd,env:{...settings},run:adapter});
    for(const call of calls.slice(0,4))assert.equal(call.env.VITE_API_URL,'http://api.e2e.test');
    assert.equal(calls[4].env.VITE_API_URL,'https://resqnowbackend-production-c392.up.railway.app');
  });
});
for(const directory of ['src','e2e','scripts'])test('an empty '+directory+' test inventory fails before execution',async()=>{
  await fixture(async({cwd,calls,adapter})=>{
    const target=path.resolve(cwd,directory);assert.equal(path.dirname(target),cwd);
    await fs.rm(target,{recursive:true,force:true});
    await fs.mkdir(target);
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/test inventory/i);
    assert.equal(calls.length,0);
  });
});
test('a child spawn failure is not converted into a green gate',async()=>{
  await fixture(async({cwd})=>{await assert.rejects(()=>runChecks({cwd,env:{...settings},run:async()=>{throw Error('spawn denied');}}),/spawn denied/);});
});
test('zero-test or skipped Node script checks cannot pass on exit zero alone',async()=>{
  for(const output of [tap.replace('# tests 2','# tests 0'),tap.replace('# skipped 0','# skipped 1'),'not a TAP summary']){
    await fixture(async({cwd,adapter,calls})=>{
      await assert.rejects(()=>runChecks({cwd,env:{...settings},run:async(...args)=>{const result=await adapter(...args);return args[1].includes('--test')?{...result,stdout:output}:result;}}),/Node test report/i);
      assert.equal(calls.length,2);
    });
  }
});
test('missing or skipped unit cases block the browser/build stages',async()=>{
  for(const change of [r=>({...r,numPendingTests:1}),r=>({...r,testResults:[]})]){
    await fixture(async({cwd,setUnit,adapter,calls})=>{
      setUnit(change);
      await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/unit report/i);
      assert.equal(calls.length,3);
    });
  }
});
test('a missing unit report cannot reuse a previous run report',async()=>{
  await fixture(async({cwd,adapter,calls})=>{
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:async(...args)=>{
      const result=await adapter(...args);
      const output=args[1].indexOf('--outputFile');if(output>=0)await fs.unlink(args[1][output+1]);
      return result;
    }}),/unit report/i);
    assert.equal(calls.length,3);
  });
});
test('flaky browser outcomes, global errors and missing desktop coverage block the build',async()=>{
  for(const change of [
    r=>({...r,stats:{...r.stats,flaky:1}}),
    r=>({...r,errors:[{message:'worker failed'}]}),
    r=>{r.suites[0].specs[0].tests.pop();return r;},
    r=>{r.suites[0].specs[0].tests[0].expectedStatus='failed';return r;},
  ]){
    await fixture(async({cwd,setBrowser,adapter,calls})=>{
      setBrowser(change);
      await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/browser report/i);
      assert.equal(calls.length,4);
    });
  }
});
test('unexpected browser skips are rejected even if Playwright exits zero',async()=>{
  await fixture(async({cwd,setBrowser,adapter})=>{
    setBrowser(r=>{const t=r.suites[0].specs[0].tests[1];t.status='skipped';t.expectedStatus='skipped';t.results[0].status='skipped';t.annotations=[{type:'skip',description:'temporary workaround'}];r.stats.expected=1;r.stats.skipped=1;return r;});
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/browser report/i);
  });
});

async function viewportCase(body,bothSkipped=false,splitProjects=false){
  await fixture(async({cwd,setBrowser,adapter,calls})=>{
    await fs.rename(path.join(cwd,'e2e/contract.spec.ts'),path.join(cwd,'e2e/account.spec.ts'));
    setBrowser(r=>{
      const suite=r.suites[0],spec=suite.specs[0];
      suite.title=suite.file=spec.file='account.spec.ts';
      spec.title='with the bottom bar switched off, phones keep the top bar as the way home';
      for(const t of spec.tests.filter(t=>bothSkipped||t.projectName==='desktop')){
        t.status=t.expectedStatus=t.results[0].status='skipped';
        t.annotations=[{type:'skip',description:'The bottom bar is only on phones'}];
      }
      r.stats.expected=bothSkipped?0:1;r.stats.skipped=bothSkipped?2:1;
      if(splitProjects)suite.specs=spec.tests.map(t=>({...spec,line:1,column:1,tests:[t]}));
      return r;
    });
    await body({cwd,adapter,calls});
  });
}
test('a documented viewport-only case requires and accepts a passing counterpart',async()=>{
  await viewportCase(async({cwd,adapter,calls})=>{
    await runChecks({cwd,env:{...settings},run:adapter});
    assert.equal(calls.length,5);
  });
});
test('a viewport case skipped on both projects still blocks the build',async()=>{
  await viewportCase(async({cwd,adapter,calls})=>{
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/browser report/i);
    assert.equal(calls.length,4);
  },true);
});

test('separate project spec entries in real Playwright JSON are grouped by source case',async()=>{
  await fixture(async({cwd,setBrowser,adapter,calls})=>{
    setBrowser(r=>{
      const suite=r.suites[0],spec=suite.specs[0];
      suite.specs=spec.tests.map(t=>({...spec,line:1,column:1,tests:[t]}));
      return r;
    });
    await runChecks({cwd,env:{...settings},run:adapter});
    assert.equal(calls.length,5);
  });
});
test('separate project spec entries preserve audited viewport counterparts',async()=>{
  await viewportCase(async({cwd,adapter,calls})=>{
    await runChecks({cwd,env:{...settings},run:adapter});
    assert.equal(calls.length,5);
  },false,true);
});
test('same titles at different source lines cannot masquerade as counterparts',async()=>{
  await fixture(async({cwd,setBrowser,adapter})=>{
    setBrowser(r=>{
      const suite=r.suites[0],spec=suite.specs[0];
      suite.specs=spec.tests.map((t,index)=>({...spec,line:index+1,column:1,tests:[t]}));
      return r;
    });
    await assert.rejects(()=>runChecks({cwd,env:{...settings},run:adapter}),/browser report/i);
  });
});
test('sanitized child environment drops inherited secrets and dangerous Node options',()=>{
  assert.equal(typeof api.createVerificationEnvironment,'function');
  const result=api.createVerificationEnvironment({PATH:'safe-path',TEMP:'owned-temp',API_KEY:'PRIVATE',GITHUB_TOKEN:'PRIVATE',NODE_OPTIONS:'--require private-loader',VITE_API_URL:'https://production.example.test'});
  assert.equal(result.PATH,'safe-path');assert.equal(result.TEMP,'owned-temp');
  assert.equal(result.VITE_API_URL,'http://api.e2e.test');
  for(const key of ['API_KEY','GITHUB_TOKEN','NODE_OPTIONS'])assert.equal(key in result,false);
});
test('the CLI exits nonzero for a private env file before executing any gates',async()=>{
  await fixture(async({cwd,put})=>{
    await put('.env','PRIVATE_SENTINEL_DO_NOT_PRINT');
    const result=spawnSync(process.execPath,[script],{cwd,encoding:'utf8',env:{...process.env}});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/env file/i);
    assert.ok(!result.stderr.includes('PRIVATE_SENTINEL'));
  });
});
