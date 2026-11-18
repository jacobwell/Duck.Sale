// Static program: user/model input arrives as data in a JSON file, never as shell code.
export const workerSource = String.raw`
import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const { query } = JSON.parse(await readFile('/home/user/boatduck-input.json', 'utf8'));
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
async function context(path, body) {
 for(let attempt=0;attempt<4;attempt++) {
  const call={id:crypto.randomUUID(),service:'Context.dev',operation:path,status:'running',startedAt:new Date().toISOString(),target:body.url?new URL(body.url).hostname:'web discovery'};
  console.log(JSON.stringify({type:'api',call}));
  try {
   const r=await fetch('https://api.context.dev/v1/web/'+path,{
    method:'POST',headers:{Authorization:'Bearer '+process.env.CONTEXT_DEV_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(42000)
   });
   const result=r.ok?await r.json():null;
   console.log(JSON.stringify({type:'api',call:{...call,status:r.ok?'complete':'failed',statusCode:r.status,finishedAt:new Date().toISOString()}}));
   if(r.status===429 && attempt<3) {await pause(Math.min(Number(r.headers.get('retry-after'))*1000||5000*(attempt+1),15000));continue;}
   if(!r.ok)throw new Error('Context '+path+' returned HTTP '+r.status);
   return result;
  } catch(error) {
   console.log(JSON.stringify({type:'api',call:{...call,status:'failed',finishedAt:new Date().toISOString()}}));
   throw error;
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
try {
  const search = await context('search',{query,numResults:8,descriptionMaxCharacters:1200,timeoutOpts:{milliseconds:30000,behavior:'return-partial'}});
  const results=(search.results||[]).sort((a,b)=>Number(itemPath.test(b.url))-Number(itemPath.test(a.url))).slice(0,3);
  const first=[];
  for(const r of results) { first.push(await scrape(r.url,r.title||'',r.description||'')); await pause(400); }
  const pages=first.filter(Boolean);
  // Category pages can lead to real ads. Follow at most two explicit item links;
  // never invent a URL or let page text become executable instructions.
  const links=[];
  for(const p of pages) {
    if(itemPath.test(p.url))continue;
    for(const m of p.markdown.matchAll(/\[([^\]]{3,180})\]\((https?:\/\/[^\s)]+)\)/g)) {
      const url=m[2];
      if(itemPath.test(url) && !pages.some(p=>p.url===url) && !links.some(p=>p.url===url)) links.push({url,title:m[1]});
      if(links.length>=2)break;
    }
    if(links.length>=2)break;
  }
  const followed=[];
  for(const l of links) followed.push(await scrape(l.url,l.title));
  console.log(JSON.stringify({type:"evidence",pages:[...pages,...followed.filter(Boolean)],partial:!!search.partial}));
} catch(e) { console.error(e.message); process.exitCode=1; }
`;
