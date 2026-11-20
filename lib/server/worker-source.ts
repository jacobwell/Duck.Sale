// Static program: user/model input arrives as data in a JSON file, never as shell code.
export const workerSource = String.raw`
import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const { query, permitUrl, permitToken, excludeUrls=[] } = JSON.parse(await readFile('/home/user/boatduck-input.json', 'utf8'));
const canonical=u=>{try{const x=new URL(u);x.hash='';for(const k of [...x.searchParams.keys()])if(k.startsWith('utm_')||k==='fbclid')x.searchParams.delete(k);return x.toString().replace(/\/$/,'')}catch{return u}};
const excluded=new Set(excludeUrls.map(canonical));
function privateIP(ip) {
  if (ip.includes(':')) return !/^[23][0-9a-f]{3}:/i.test(ip);
  const [a,b] = ip.split('.').map(Number);
  return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19));
}
async function safeUrl(s) {
  try {
    const u = new URL(s);
    if(u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443')) return false;
    const h=u.hostname.replace(/^\[|\]$/g,'');
    if(h==='localhost' || !h.includes('.') || /\.(local|internal|localhost)$/.test(h)) return false;
    const addresses=isIP(h)?[{address:h}]:await lookup(h,{all:true});
    return addresses.length>0 && addresses.every(x=>!privateIP(x.address));
  } catch { return false; }
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const deadline=Date.now()+120000;
async function permit(requestId,release=false,cooldownMs=0) {
 const r=await fetch(permitUrl,{method:'POST',headers:{Authorization:'Bearer '+permitToken,'Content-Type':'application/json'},body:JSON.stringify({requestId,release,cooldownMs}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('Context request queue unavailable');
 return r.json();
}
function waiting(message) {console.log(JSON.stringify({type:'throttle',message}));}
async function acquire(requestId) {
 let announced=false;
 for(;;) {
  if(Date.now()+8000>=deadline)throw new Error('Context queue exceeded this worker’s time budget');
  const slot=await permit(requestId);
  if(slot.granted)return;
  if(!announced){waiting('Waiting for the shared Context queue / provider cooldown.');announced=true;}
  const wait=Math.max(250,Number(slot.waitMs)||1000);
  await pause(Math.min(wait,3000)+Math.random()*500);
 }
}
function retryDelay(value,attempt) {
 let supplied=0;
 if(value) supplied=/^\d+(?:\.\d+)?$/.test(value.trim())?Number(value)*1000:Date.parse(value)-Date.now();
 return Math.min(86400000,Math.ceil(Math.max(Number.isFinite(supplied)?supplied:0,10000*2**attempt)+Math.random()*2000));
}
async function context(path, body) {
 for(let attempt=0;attempt<3;attempt++) {
  const requestId=crypto.randomUUID();
  await acquire(requestId);
  const call={id:requestId,service:'Context.dev',operation:path,status:'running',startedAt:new Date().toISOString(),target:body.url?new URL(body.url).hostname:'web discovery'};
  let cooldownMs=0,reported=false,started=false;
  try {
   const remaining=deadline-Date.now()-1500;
   if(remaining<5000)throw new Error('Context request time budget exhausted');
   waiting('Inspecting sources at a gentle pace.');
   started=true;
   console.log(JSON.stringify({type:'api',call}));
   const r=await fetch('https://api.context.dev/v1/web/'+path,{
    method:'POST',headers:{Authorization:'Bearer '+process.env.CONTEXT_DEV_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(Math.min(42000,remaining))
   });
   if(r.status===429)cooldownMs=retryDelay(r.headers.get('retry-after'),attempt);
   const result=r.ok?await r.json():null;
   console.log(JSON.stringify({type:'api',call:{...call,status:r.ok?'complete':'failed',statusCode:r.status,finishedAt:new Date().toISOString()}}));
   reported=true;
   if(r.status===429 && attempt<2) {waiting('Context rate limit: fleet cooling down for at least '+Math.ceil(cooldownMs/1000)+' seconds.');continue;}
   if(!r.ok)throw new Error('Context '+path+' returned HTTP '+r.status);
   return result;
  } catch(error) {
   if(started&&!reported)console.log(JSON.stringify({type:'api',call:{...call,status:'failed',finishedAt:new Date().toISOString()}}));
   throw error;
  } finally {
   // Failure to release keeps the shared lease locked until its 55s expiry.
   await permit(requestId,true,cooldownMs).catch(()=>waiting('Context queue will resume after the request lease expires.'));
  }
 }
}
const itemPath=/(\/boat\/|\/yacht\/|\/itm\/|\/item\/|\/listing\/|\/listings\/[^/?]+\/[^/?]+|\/details\/|\/boa\/d\/|\/cto\/d\/|\/rvs\/d\/|view\/\d+|\.html(?:\?|$))/i;
async function scrape(url,title='',description='') {
  if(!await safeUrl(url)) return null;
  let markdown='',images=[],error=null;
  try {
    const page=await context('scrape',{url,formats:{markdown:true,images:true},sharedParams:{mainContentOnly:true},maxAgeMs:0,timeoutOpts:{milliseconds:35000,behavior:'return-partial'}});
    if(page.markdown?.success) markdown=page.markdown.data||'';
    else error='Page text unavailable';
    if(page.images?.success) images=(page.images.data||[]).filter(i=>i.url?.startsWith('https://')).slice(0,12).map(i=>({url:i.url,alt:i.alt||''}));
  } catch(e) { error=e.message; }
  return {url,title,description,markdown:markdown.slice(0,22000),images,retrievedAt:new Date().toISOString(),error};
}
const pages=[];
let searchPartial=false;
function snapshot(forcePartial=false) {
 console.log(JSON.stringify({type:'evidence',pages,partial:forcePartial||searchPartial||pages.some(p=>p.error)}));
}
try {
  const search = await context('search',{query,numResults:8,descriptionMaxCharacters:1200,timeoutOpts:{milliseconds:30000,behavior:'return-partial'}});
  searchPartial=!!search.partial;
  const results=(search.results||[]).filter(r=>!excluded.has(canonical(r.url))).sort((a,b)=>Number(itemPath.test(b.url))-Number(itemPath.test(a.url))).slice(0,3);
  // Preserve real search snippets before slower page reads begin.
  for(const r of results) if(await safeUrl(r.url))pages.push({url:r.url,title:r.title||'',description:r.description||'',markdown:'',images:[],retrievedAt:new Date().toISOString(),error:'Page not yet inspected'});
  snapshot();
  for(let i=0;i<pages.length;i++) {
    if(Date.now()+8000>=deadline)break;
    const page=await scrape(pages[i].url,pages[i].title,pages[i].description);
    if(page)pages[i]=page;
    snapshot();
  }
  const links=[];
  for(const p of pages) {
    if(itemPath.test(p.url))continue;
    for(const m of p.markdown.matchAll(/\[([^\]]{3,180})\]\((https?:\/\/[^\s)]+)\)/g)) {
      const url=m[2];
      if(itemPath.test(url) && !excluded.has(canonical(url)) && !pages.some(p=>p.url===url) && !links.some(p=>p.url===url)) links.push({url,title:m[1]});
      if(links.length>=2)break;
    }
    if(links.length>=2)break;
  }
  for(const l of links) {
    if(Date.now()+8000>=deadline){searchPartial=true;break;}
    const page=await scrape(l.url,l.title);if(page)pages.push(page);
    snapshot();
  }
  snapshot();
} catch(e) {
  if(pages.length){snapshot(true);console.error('Kept partial source evidence: '+e.message);}
  else {console.error(e.message);process.exitCode=1;}
}
`;
