import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';

const api=await import('./e2e-server.mjs').catch(()=>({}));
async function fixture(body){
  const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'resqnow-server-'));
  try{
    await fs.writeFile(path.join(root,'index.html'),'<p>synthetic server</p>');
    await body(root);
  }finally{
    const target=await fs.realpath(root);
    assert.equal(path.dirname(target),parent);
    assert.ok(path.basename(target).startsWith('resqnow-server-'));
    await fs.rm(target,{recursive:true,force:true});
  }
}
function start(options){
  assert.equal(typeof api.startE2eServer,'function','owned Vite lifecycle must exist');
  return api.startE2eServer({...options,host:'127.0.0.1',configFile:false});
}
test('serves the real Vite app and releases its own port on close',async()=>{
  await fixture(async root=>{
    const server=await start({root,port:0});
    const port=Number(new URL(server.url).port);
    try{
      assert.match(await (await fetch(server.url)).text(),/synthetic server/);
    }finally{await server.close();}
    await server.close(); // idempotent ownership cleanup
    await assert.rejects(()=>fetch(server.url));
    const next=await start({root,port});
    await next.close();
  });
});
test('an occupied port fails instead of reusing or stopping an unrelated server',async()=>{
  await fixture(async root=>{
    const existing=net.createServer();
    await new Promise(resolve=>existing.listen(0,'127.0.0.1',resolve));
    try{
      await assert.rejects(()=>start({root,port:existing.address().port}),/already in use/);
      assert.equal(existing.listening,true);
    }finally{await new Promise(resolve=>existing.close(resolve));}
  });
});
test('non-example env files are refused before Vite can read them',async()=>{
  await fixture(async root=>{
    await fs.writeFile(path.join(root,'.env.local'),'PRIVATE_SENTINEL');
    await assert.rejects(()=>start({root,port:0}),error=>{
      assert.match(error.message,/non-example env file/i);
      assert.ok(!error.message.includes('PRIVATE_SENTINEL'));
      return true;
    });
  });
});
test('Vite uses synthetic public settings and restores the caller environment',async()=>{
  await fixture(async root=>{
    const previous=process.env.VITE_API_URL;
    process.env.VITE_API_URL='https://production.example.test';
    await fs.writeFile(path.join(root,'main.js'),'export default import.meta.env.VITE_API_URL');
    try{
      const server=await start({root,port:0});
      try{
        const source=await (await fetch(server.url+'/main.js')).text();
        assert.ok(source.includes('http://api.e2e.test'));
        assert.ok(!source.includes('https://production.example.test'));
      }finally{await server.close();}
      assert.equal(process.env.VITE_API_URL,'https://production.example.test');
    }finally{
      if(previous===undefined)delete process.env.VITE_API_URL;else process.env.VITE_API_URL=previous;
    }
  });
});
