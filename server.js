const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const PORT=process.env.PORT||3000;
const file=path.join(__dirname,'codes.json');
let db={codes:[],lastScan:null,scanNote:'Not scanned yet'};
try{db={...db,...JSON.parse(fs.readFileSync(file,'utf8'))}}catch{}
const save=()=>{try{fs.writeFileSync(file,JSON.stringify(db,null,2))}catch{}};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data))};
const validCode=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{4,32}$/.test(s);
const clean=s=>String(s||'').slice(0,100);
const sources=[
 'https://www.pockettactics.com/whiteout-survival/codes',
 'https://www.pcgamesn.com/whiteout-survival/codes'
];
let scanning=false;
async function scan(){if(scanning)return;scanning=true;let added=0,checked=0;const errors=[];
 for(const url of sources){try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);let response;try{response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; WoSCodeHunter/1.0)'},signal:controller.signal})}finally{clearTimeout(timer)}if(!response.ok)throw Error('HTTP '+response.status);const html=(await response.text()).slice(0,700000);checked++;
 // Extract only candidates explicitly appearing near code labels in public pages.
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|#39);/g,' ');
 const re=/(?:gift\s*code|redeem\s*code|working\s*codes?)\s*[:\-–]?\s*([A-Za-z0-9_-]{5,24})/gi;let match,count=0;
 while((match=re.exec(text))&&count<30){const code=match[1];if(/^(?:whiteout|survival|codes?|redeem|active|updated|november|october|check|these|below)$/i.test(code))continue;count++;if(!db.codes.some(x=>x.code.toLowerCase()===code.toLowerCase())){db.codes.unshift({code,source:url,added:new Date().toISOString(),yes:0,no:0,community:false});added++}}
 }catch(e){errors.push(new URL(url).hostname+': '+e.message)}}
 db.lastScan=new Date().toISOString();db.scanNote=`Checked ${checked}/${sources.length} public pages; ${added} new unverified candidates.`+(errors.length?' Some sources were unavailable.':'');db.codes=db.codes.slice(0,300);save();scanning=false;
}
const rate=new Map();function limited(ip){const now=Date.now();const arr=(rate.get(ip)||[]).filter(t=>now-t<3600000);if(arr.length>=20)return true;arr.push(now);rate.set(ip,arr);return false}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const ip=req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress;
 if(req.method==='GET'&&u.pathname==='/api/codes')return send(res,200,{codes:db.codes,lastScan:db.lastScan,scanNote:db.scanNote});
 if(req.method==='GET'&&u.pathname==='/api/status')return send(res,200,{lastScan:db.lastScan,scanNote:db.scanNote,records:db.codes.length,storage:'temporary on free hosting'});
 if(req.method==='POST'&&['/api/submit','/api/vote'].includes(u.pathname)){
 if(limited(ip))return send(res,429,{error:'Please try again later.'});let body='';req.on('data',chunk=>{body+=chunk;if(body.length>2048)req.destroy()});req.on('end',()=>{let data;try{data=JSON.parse(body)}catch{return send(res,400,{error:'Invalid request'})}
 if(u.pathname==='/api/submit'){const code=clean(data.code).trim();if(!validCode(code))return send(res,400,{error:'Enter a 4–32 character code (letters, numbers, - or _).'});if(db.codes.some(x=>x.code.toLowerCase()===code.toLowerCase()))return send(res,409,{error:'This code is already listed.'});db.codes.unshift({code,source:'Community submission',added:new Date().toISOString(),yes:0,no:0,community:true});save();return send(res,200,{ok:true})}
 const item=db.codes.find(x=>x.code===data.code);if(!item||!['yes','no'].includes(data.vote))return send(res,400,{error:'Invalid vote'});item[data.vote]++;save();send(res,200,{ok:true})});return}
 if(req.method==='POST'&&u.pathname==='/api/admin/scan'){if(!process.env.ADMIN_KEY||req.headers.authorization!=='Bearer '+process.env.ADMIN_KEY)return send(res,403,{error:'Forbidden'});scan();return send(res,202,{ok:true})}
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 let p=path.join(__dirname,'public',u.pathname==='/'?'index.html':u.pathname);if(!p.startsWith(path.join(__dirname,'public')+path.sep))return send(res,404,{error:'Not found'});fs.readFile(p,(err,buf)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(buf)})
}).listen(PORT,()=>{console.log('WoS Code Hunter listening on '+PORT);scan();setInterval(scan,6*60*60*1000).unref()});
