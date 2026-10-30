const BASE='https://api.github.com/repos/janeshkrish/resqnowfrontend';
const UPLOAD='https://uploads.github.com/repos/janeshkrish/resqnowfrontend';
const CDN=new Set(['release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com']);
const identifier=id=>{if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid GitHub release asset identifier');return String(id);};
const tagName=tag=>{if(!/^android-v[1-9][0-9]*$/.test(tag)||Number(tag.slice(9))>2147483647)throw Error('Invalid Android release tag');return tag;};
async function bytes(response,limit){
  const announced=Number(response.headers.get('content-length'));if(announced>limit)throw Error('GitHub response exceeds the release limit');
  const chunks=[];let size=0;if(!response.body)return Buffer.alloc(0);
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>limit)throw Error('GitHub response exceeds the release limit');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks,size);
}
export function createReleaseGithubClient({token,fetch:fetcher=fetch}){
  if(typeof token!=='string'||!token||/[\s\u0000]/.test(token))throw Error('A scoped GitHub Actions token is required');
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function request(url,{method='GET',body,contentType='application/json',allow404=false,timeoutMs=15000}={}){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(url,{method,body,headers:{...headers,...(body?{'Content-Type':contentType}:{})},redirect:'error',signal:controller.signal,credentials:'omit'});
      if(allow404&&response.status===404)return null;
      if(!response.ok)throw Error('GitHub release API request failed ('+response.status+')');
      const raw=await bytes(response,4*1024*1024);try{return JSON.parse(raw.toString('utf8'));}catch{throw Error('Invalid GitHub release API response');}
    }finally{controller.abort();clearTimeout(timer);}
  }
  return {
    async listReleases(){
      const releases=[];const started=Date.now();
      for(let page=1;page<=100;page++){
        const value=await request(`${BASE}/releases?per_page=100&page=${page}`);if(!Array.isArray(value))throw Error('Invalid GitHub release history');
        releases.push(...value);if(value.length<100)return releases;if(Date.now()-started>60000)throw Error('GitHub release history deadline exceeded');
      }
      throw Error('GitHub release history could not be completely enumerated');
    },
    async tagExists(tag){return await request(`${BASE}/git/ref/tags/${tagName(tag)}`,{allow404:true})!==null;},
    async reserveTag(tag,sha){if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid source commit');const ref=`refs/tags/${tagName(tag)}`;const result=await request(`${BASE}/git/refs`,{method:'POST',body:JSON.stringify({ref,sha})});if(result.ref!==ref||result.object?.sha!==sha)throw Error('GitHub tag reservation failed');},
    async createDraft({tag,sha,versionName}){
      tagName(tag);const result=await request(`${BASE}/releases`,{method:'POST',body:JSON.stringify({tag_name:tag,target_commitish:sha,name:`ResQNow Android ${versionName}`,body:`Source commit: ${sha}`,draft:true,prerelease:false,generate_release_notes:false})});
      identifier(result.id);if(result.tag_name!==tag||result.target_commitish!==sha||result.draft!==true||result.prerelease!==false)throw Error('GitHub draft identity mismatch');return result;
    },
    async upload(releaseId,name,body,contentType){
      if(!['resqnow.apk','android-release.json'].includes(name)||!Buffer.isBuffer(body)||body.length<1||body.length>(name==='resqnow.apk'?200*1024*1024:16384))throw Error('Invalid Android release upload');
      const result=await request(`${UPLOAD}/releases/${identifier(releaseId)}/assets?name=${name}`,{method:'POST',body,contentType,timeoutMs:120000});identifier(result.id);return result;
    },
    async readAsset(assetId){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120000);
      let url=`${BASE}/releases/assets/${identifier(assetId)}`;
      try{for(let redirects=0;redirects<=3;redirects++){
        const api=url.startsWith(BASE+'/');const response=await fetcher(url,{headers:api?{...headers,Accept:'application/octet-stream'}:{Accept:'application/octet-stream'},redirect:'manual',signal:controller.signal,credentials:'omit'});
        if([301,302,303,307,308].includes(response.status)){
          const location=response.headers.get('location');await response.body?.cancel();if(!location||redirects===3)throw Error('Invalid GitHub asset redirect');
          const next=new URL(location,url);if(next.protocol!=='https:'||!CDN.has(next.hostname)||next.username||next.password||next.hash||next.port)throw Error('Blocked GitHub asset redirect');url=next.href;continue;
        }
        if(!response.ok)throw Error('GitHub asset read-back failed');return await bytes(response,200*1024*1024);
      }}finally{controller.abort();clearTimeout(timer);}
      throw Error('GitHub asset redirect limit exceeded');
    },
    async publish(releaseId){
      const result=await request(`${BASE}/releases/${identifier(releaseId)}`,{method:'PATCH',body:JSON.stringify({draft:false,prerelease:false,make_latest:'true'})});
      if(result.id!==releaseId||result.draft!==false||result.prerelease!==false||result.html_url!==`https://github.com/janeshkrish/resqnowfrontend/releases/tag/${tagName(result.tag_name)}`)throw Error('GitHub did not confirm stable publication');return result;
    },
  };
}
