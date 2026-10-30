import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./android-release-github.mjs').catch(()=>({}));
function client(fetcher){assert.equal(typeof api.createReleaseGithubClient,'function');return api.createReleaseGithubClient({token:'synthetic-ci-token',fetch:fetcher});}
test('draft asset redirects never forward the GitHub token to the CDN',async()=>{
  const calls=[];const github=client(async(url,options)=>{calls.push({url,authorization:options.headers.Authorization});if(calls.length===1)return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/allowed.apk?signature=synthetic'}});return new Response('apk bytes');});
  assert.equal((await github.readAsset(123)).toString(),'apk bytes');assert.equal(calls[0].authorization,'Bearer synthetic-ci-token');assert.equal(calls[1].authorization,undefined);assert.equal(calls[1].url,'https://release-assets.githubusercontent.com/allowed.apk?signature=synthetic');
});
test('foreign/HTTP asset redirects and oversized bodies are rejected before publication',async()=>{
  for(const location of ['http://release-assets.githubusercontent.com/a','https://evil.test/a','https://release-assets.githubusercontent.com.evil.test/a','https://user:password@release-assets.githubusercontent.com/a'])await assert.rejects(()=>client(async()=>new Response(null,{status:302,headers:{location}})).readAsset(123));
  await assert.rejects(()=>client(async()=>new Response('x',{headers:{'content-length':String(201*1024*1024)}})).readAsset(123));
});
test('release pagination, atomic tag reservation and draft creation use pinned API paths',async()=>{
  const calls=[];const github=client(async(url,options)=>{calls.push({url,options});if(url.includes('/releases?'))return Response.json([{tag_name:'android-v110'}]);if(url.endsWith('/git/refs'))return Response.json({ref:'refs/tags/android-v112',object:{sha:'c'.repeat(40)}});if(url.endsWith('/releases'))return Response.json({id:1,tag_name:'android-v112',target_commitish:'c'.repeat(40),draft:true,prerelease:false});return new Response(null,{status:404});});
  assert.equal((await github.listReleases()).length,1);assert.equal(await github.tagExists('android-v112'),false);await github.reserveTag('android-v112','c'.repeat(40));await github.createDraft({tag:'android-v112',sha:'c'.repeat(40),versionName:'1.4.112'});
  assert.equal(calls[0].url,'https://api.github.com/repos/janeshkrish/resqnowfrontend/releases?per_page=100&page=1');assert.equal(JSON.parse(calls[2].options.body).ref,'refs/tags/android-v112');assert.equal(JSON.parse(calls[3].options.body).draft,true);
});
test('uploads only exact asset names to the pinned upload host and refuses malformed publication',async()=>{
  let touched=false;const github=client(async(url)=>{touched=true;assert.equal(url,'https://uploads.github.com/repos/janeshkrish/resqnowfrontend/releases/1/assets?name=resqnow.apk');return Response.json({id:2,name:'resqnow.apk',size:3,state:'uploaded'});});
  await assert.rejects(()=>github.upload(1,'../key.jks',Buffer.from('key'),'application/octet-stream'));assert.equal(touched,false);await github.upload(1,'resqnow.apk',Buffer.from('apk'),'application/vnd.android.package-archive');
  await assert.rejects(()=>client(async()=>Response.json({draft:true})).publish(1));
});
test('tag reservation must confirm the exact reviewed source commit',async()=>{
  const github=client(async()=>Response.json({ref:'refs/tags/android-v112',object:{sha:'a'.repeat(40)}}));await assert.rejects(()=>github.reserveTag('android-v112','c'.repeat(40)));
});
