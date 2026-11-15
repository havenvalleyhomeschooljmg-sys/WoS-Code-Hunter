import fs from 'node:fs/promises';
const sources = [
'https://www.pockettactics.com/whiteout-survival/codes',
'https://www.pcgamesn.com/whiteout-survival/codes',
'https://www.gamesradar.com/games/survival/whiteout-survival-codes-gift/',
'https://www.pocketgamer.com/whiteout-survival/codes/',
'https://www.ldplayer.net/codes/whiteout-survival-latest-codes.html',
'https://www.whiteoutsurvival-community.com/gift-codes.html',
'https://wiki.wosforge.org/wiki/Gift_Codes',
'https://www.clashhaven.com/whiteout-survival/codes',
'https://www.genzgamecode.com/games/whiteout-survival/',
'https://www.reddit.com/r/whiteoutsurvival/new.json?limit=30'
];
const file = new URL('../data/discovered.json', import.meta.url);
const now = new Date().toISOString();
let previous = {codes:[],lastScan:null};
try { previous = JSON.parse(await fs.readFile(file,'utf8')); } catch {}
const records = new Map((previous.codes||[]).map(x=>[x.code.toLowerCase(),x]));
const failures=[];let checked=0;
const reject = /^(?:whiteout|survival|gift|codes?|redeem|working|active|expired|updated|november|october|september|january|february|march|april|june|july|august|december|check|these|below|click|copy|today|free|reward|rewards|new|latest|here|button|please|enter|claim|valid|codehere)$/i;
const plausible = s=> /^[a-z0-9_-]{5,24}$/i.test(s) && /\d/.test(s) && !reject.test(s) && !/^\d{4,}$/.test(s);
function candidates(text){
 const found=new Set();
 // Only capture tokens near explicit gift-code language or in clearly labeled code blocks.
 const patterns=[/(?:gift|redeem|promo|working|active)\s*codes?\s*(?:is|are|:|[-–])?\s*["'`]?([a-z0-9_-]{5,24})/gi, /(?:code\s*[:=-]\s*|<code[^>]*>|<kbd[^>]*>)([a-z0-9_-]{5,24})/gi];
 for(const re of patterns){let m;let n=0;while((m=re.exec(text)) && n++<200){if(plausible(m[1]))found.add(m[1]);}}
 return [...found].slice(0,30);
}
function plain(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|#39|#x27);/gi,' ').replace(/\s+/g,' ')}
for(const url of sources){
 try{
  const response=await fetch(url,{headers:{'User-Agent':'WoSCodeHunter/1.1 (public gift-code monitoring; contact via repository)','Accept':'text/html, application/json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  let content=(await response.text()).slice(0,1000000);
  if(url.includes('reddit.com')){
   const json=JSON.parse(content);content=(json.data?.children||[]).map(x=>x.data?.title+' '+x.data?.selftext).join('\n');
   // Community mentions are discovery hints, never game-verified.
  }else content=plain(content);
  checked++;
  for(const code of candidates(content)){
   const key=code.toLowerCase();const old=records.get(key);
   if(old){old.sources=[...new Set([...(old.sources||[]),url])];old.lastSeen=now;}
   else records.set(key,{code,source:url,sources:[url],added:now,lastSeen:now,yes:0,no:0,community:false,status:'unverified'});
  }
 }catch(e){failures.push({source:url,error:String(e.message).slice(0,150)});}
}
const codes=[...records.values()].sort((a,b)=>b.added.localeCompare(a.added)).slice(0,500);
await fs.mkdir(new URL('../data/',import.meta.url),{recursive:true});
await fs.writeFile(file,JSON.stringify({codes,lastScan:now,scanNote:`Checked ${checked}/${sources.length} public sources. Candidates are unverified; no game redemption validation performed.`,failures},null,2)+'\n');
console.log(`Checked ${checked}/${sources.length}, ${codes.length} candidates, ${failures.length} errors`);
