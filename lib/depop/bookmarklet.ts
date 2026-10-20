/**
 * Bookmarklet Cooper runs in HIS OWN browser on his own Depop shop page (depop.com/spock13).
 * It scrolls until no new items load, collects unique /products/ links, copies them to the
 * clipboard (fallback: a textarea to copy by hand) and shows a count. Nothing is sent anywhere;
 * the server never crawls the shop, it only fetches the individual links Cooper pastes.
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
var text=list.join("\n"),copied=false;
try{await navigator.clipboard.writeText(text);copied=true;}catch(e){}
say(list.length+" listing link"+(list.length===1?"":"s")+(copied?" copied. Paste them into SpockShop's Depop import page.":" found. Copy them from the box below (clipboard access was blocked)."));
var ta=D.createElement("textarea");ta.value=text;ta.readOnly=true;ta.setAttribute("style","display:block;width:100%;height:140px;margin-top:8px;font:12px monospace");box.appendChild(ta);
if(!copied){ta.focus();ta.select();}
var x=D.createElement("button");x.textContent="Close";x.setAttribute("style","margin-top:8px;padding:6px 12px");x.onclick=function(){box.remove();};box.appendChild(x);
return list.length;
})()`;

export const bookmarkletHref = () => "javascript:" + encodeURIComponent(BOOKMARKLET_SOURCE.replace(/\n/g, ""));
