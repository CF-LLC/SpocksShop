/**
 * Bookmarklet Cooper runs in HIS OWN browser on his own Depop shop page (depop.com/spock13).
 * It scrolls until no new items load, collects unique /products/ links, copies them to the
 * then reads each listing page in Cooper's own browser (Depop blocks the shop server with a Cloudflare
 * 403) and copies a JSON payload of the JSON-LD/meta snippets to the clipboard (fallback: a textarea).
 * Nothing is sent anywhere; Cooper pastes it into SpockShop himself.
 * Kept as plain ES2017 source so the build can't rewrite it.
 */
export const BOOKMARKLET_SOURCE = String.raw`(async function(){
var W=window,D=document;
if(!/(^|\.)depop\.com$/i.test(location.hostname)){alert("Open your Depop shop page (depop.com/spock13) first, then click this bookmark.");return;}
var seen={},list=[];
function grab(){var as=D.querySelectorAll('a[href*="/products/"]');for(var i=0;i<as.length;i++){try{var u=new URL(as[i].getAttribute("href"),location.href);var m=/^\/products\/([a-z0-9][a-z0-9-]{0,199})\/?$/i.exec(u.pathname);if(m){var k="https://www.depop.com/products/"+m[1].toLowerCase()+"/";if(!seen[k]){seen[k]=1;list.push(k);}}}catch(e){}}}
var box=D.createElement("div");box.setAttribute("style","position:fixed;z-index:2147483647;top:12px;right:12px;width:340px;max-width:90vw;background:#fff;color:#111;border:2px solid #111;border-radius:12px;padding:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)");
var msg=D.createElement("div");box.appendChild(msg);D.body.appendChild(box);
function say(t){msg.textContent=t;}
var still=0,lastN=-1,lastH=-1,rounds=0;
while(still<4&&rounds<400){rounds++;grab();say("SpockShop: scrolling\u2026 "+list.length+" listings found");W.scrollTo(0,D.documentElement.scrollHeight);await new Promise(function(r){setTimeout(r,1200);});grab();var h=D.documentElement.scrollHeight;if(list.length===lastN&&h===lastH){still++;}else{still=0;lastN=list.length;lastH=h;}}
var items=[];
for(var j=0;j<list.length;j++){say("SpockShop: reading listing "+(j+1)+" of "+list.length+"\u2026");var it={url:list[j]};try{var r=await fetch(list[j],{credentials:"include"});if(!r.ok){it.error="HTTP "+r.status;}else{var doc=new DOMParser().parseFromString(await r.text(),"text/html");var parts=[];var ss=doc.querySelectorAll('script[type="application/ld+json"]');for(var k=0;k<ss.length;k++){parts.push('<script type="application/ld+json">'+ss[k].textContent+'<\/script>');}var ms=doc.querySelectorAll("meta[property],meta[name]");for(var k2=0;k2<ms.length;k2++){var nm=ms[k2].getAttribute("property")||ms[k2].getAttribute("name")||"";if(/^(og:|product:|description$)/i.test(nm)){var e1=D.createElement("meta");e1.setAttribute("property",nm);e1.setAttribute("content",ms[k2].getAttribute("content")||"");parts.push(e1.outerHTML);}}var tt=doc.querySelector("title");if(tt){parts.push("<title>"+tt.textContent.replace(/[<>&]/g," ")+"</title>");}it.html="<html><head>"+parts.join("")+"</head></html>";}}catch(e){it.error="could not load";}items.push(it);if(j<list.length-1){await new Promise(function(r){setTimeout(r,900);});}}
var text=JSON.stringify({kind:"spockshop-depop",v:2,items:items}),copied=false;
try{await navigator.clipboard.writeText(text);copied=true;}catch(e){}
say(list.length+" listing link"+(list.length===1?"":"s")+(copied?" read and copied. Paste into SpockShop's Depop import page.":" found. Copy them from the box below (clipboard access was blocked)."));
var ta=D.createElement("textarea");ta.value=text;ta.readOnly=true;ta.setAttribute("style","display:block;width:100%;height:140px;margin-top:8px;font:12px monospace");box.appendChild(ta);
if(!copied){ta.focus();ta.select();}
var x=D.createElement("button");x.textContent="Close";x.setAttribute("style","margin-top:8px;padding:6px 12px");x.onclick=function(){box.remove();};box.appendChild(x);
return list.length;
})()`;

export const bookmarkletHref = () => "javascript:" + encodeURIComponent(BOOKMARKLET_SOURCE.replace(/\n/g, ""));
