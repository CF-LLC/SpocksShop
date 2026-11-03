// Generates Printful mockup photos for public Daily Drop designs (no orders, no spend). Run inside the app container:
//   OUT=/tmp/mk node scripts/drop-mockups.mjs v4-07-blame-the-tequila[,...] [tee,hoodie,mug]
// then copy the jpgs to drop-art/mockups/ and add the design file to MOCKUP_FILES in lib/drop/mockups.ts.
import fs from "fs";
import { createHmac } from "crypto";
// Held designs: the print PNG is fetched through a 1-hour signed link (lib/drop/art-token.ts); public ones ignore it.
const signed=(f)=>{const exp=Date.now()+3600_000;return `?exp=${exp}&sig=${createHmac("sha256",process.env.SESSION_SECRET||"").update(`drop-art:${f}:${exp}`).digest("hex").slice(0,32)}`;};
const h={Authorization:`Bearer ${process.env.PRINTFUL_API_KEY}`,"Content-Type":"application/json"};
if(process.env.PRINTFUL_STORE_ID)h["X-PF-Store-Id"]=process.env.PRINTFUL_STORE_ID;
const api=async(u,o={})=>{for(;;){const r=await fetch("https://api.printful.com"+u,{headers:h,...o});const j=await r.json().catch(()=>({}));if(r.status===429){await new Promise(s=>setTimeout(s,30000));continue;}return [r.status,j];}};
const pf=async(id)=>(await api(`/mockup-generator/printfiles/${id}`))[1].result;
const designs=process.argv[2].split(",");
const T={tee:[71,4017,"front"],hoodie:[146,5595,"front"],mug:[19,1320,"default"]};
fs.mkdirSync((process.env.OUT||"/tmp/mockups"),{recursive:true});
for(const [type,[pid,vid,pl]] of Object.entries(T).filter(([k])=>!process.argv[3]||process.argv[3].split(",").includes(k))){
  const r=await pf(pid);const pfid=r.variant_printfiles.find(v=>v.variant_id===vid)?.placements[pl];const f=r.printfiles.find(p=>p.printfile_id===pfid);
  const W=f.width,H=f.height;let w=W,hh=Math.round(W*5400/4500);if(hh>H){hh=H;w=Math.round(H*4500/5400);}
  for(const file of designs){
    const out=`${process.env.OUT||"/tmp/mockups"}/${file}-${type}.jpg`; if(fs.existsSync(out))continue;
    const [s,j]=await api(`/mockup-generator/create-task/${pid}`,{method:"POST",body:JSON.stringify({variant_ids:[vid],format:"jpg",files:[{placement:pl,image_url:`https://spockshop.com/drop/art/${file}.png${signed(`${file}.png`)}`,position:{area_width:W,area_height:H,width:w,height:hh,top:0,left:type==="mug"?W-w-120:Math.round((W-w)/2)}}]})});
    const key=j.result?.task_key; if(!key){console.log("ERR",file,type,s,JSON.stringify(j.error||j).slice(0,200));continue;}
    let res;for(let i=0;i<40;i++){await new Promise(x=>setTimeout(x,4000));const [,t]=await api(`/mockup-generator/task?task_key=${key}`);if(t.result?.status==="completed"){res=t.result;break;}if(t.result?.status==="failed"){console.log("FAIL",file,type,t.result.error);break;}}
    const url=res?.mockups?.[0]?.mockup_url; if(!url){console.log("NOURL",file,type);continue;}
    fs.writeFileSync(out,Buffer.from(await (await fetch(url)).arrayBuffer()));console.log("ok",file,type,fs.statSync(out).size);
  }
}
