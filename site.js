/* Valheim Warriors: verejny web se servery. Bezi nad card_template (chars, visible, render, LANG, esc, T) a Supabase REST. */
(function(){
const S = DATA.site; if(!S) return;
const API = S.url.replace(/\/$/,'') + '/rest/v1/';
const H = {apikey: S.key, Authorization: 'Bearer ' + S.key, 'Content-Type': 'application/json'};
const EN = () => LANG === 'en';
const LS = { get: k => { try { return localStorage.getItem(k); } catch(e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} }, del: k => { try { localStorage.removeItem(k); } catch(e) {} } };
const rpc = async (fn, args) => {
  const r = await fetch(API + 'rpc/' + fn, {method: 'POST', headers: H, body: JSON.stringify(args)});
  const t = await r.text();
  if(!r.ok){ let m = t; try { m = JSON.parse(t).message || t; } catch(e) {} throw new Error(m); }
  return t ? JSON.parse(t) : null;
};
const get = async (path) => { const r = await fetch(API + path, {headers: H}); if(!r.ok) throw new Error(path + ' ' + r.status); return r.json(); };

// routing: /s/<slug> na hostingu, ?s=<slug> lokalne
const pm = location.pathname.match(/^\/s\/([a-z0-9-]+)/);
const slug = pm ? pm[1] : new URLSearchParams(location.search).get('s');
const isAdminPage = /^\/admin\/?$/.test(location.pathname) || new URLSearchParams(location.search).has('admin');
const queryMode = location.pathname.endsWith('.html');
const LINK = s => queryMode ? location.pathname + '?s=' + s : '/s/' + s;
const HOME = queryMode ? location.pathname : '/';
const ABS = s => location.origin + LINK(s);
const tokKey = pid => 'vw-tok-' + slug + '-' + pid;
let SERVER = null, ADMIN = null;

const style = document.createElement('style');
style.textContent = `
.land{max-width:720px;margin:10px auto 30px}
.land .hero{border:2px solid var(--line);background:linear-gradient(180deg,var(--panel-2),var(--panel));box-shadow:inset 0 0 0 1px var(--panel-3),inset 0 0 0 3px var(--line-2),0 6px 18px var(--shadow);padding:26px 28px 24px;position:relative}
.land h2{font-family:"Metamorphous",serif;font-weight:400;font-size:24px;color:var(--gold);margin:0 0 8px;text-wrap:balance}
.land h2::after{display:none}
.land p{color:var(--ink-2);margin:0 0 14px;line-height:1.45}
.land form{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 6px}
.land input{flex:1;min-width:200px;font:inherit;font-size:15px;padding:9px 12px;background:var(--bar);border:1px solid var(--line);color:var(--ink)}
.land button,.sitebtn{font:inherit;font-size:13px;letter-spacing:.04em;font-weight:700;padding:9px 16px;background:var(--gold);color:#1a1208;border:0;cursor:pointer}
.land button:hover,.sitebtn:hover{background:var(--gold-2)}
.land .err{color:var(--rust);font-size:13px;min-height:18px}
.land .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.land .step{background:var(--bar);border:1px solid var(--bar-line);padding:10px 12px;font-size:13px;color:var(--ink-2);line-height:1.4}
.land .step b{display:block;font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:14px;margin-bottom:4px}
@media (max-width:560px){.land .steps{grid-template-columns:1fr}}
.land .mine{margin-top:18px;border-top:1px solid var(--line-2);padding-top:12px}
.land .mine h3{font-family:"Metamorphous",serif;font-weight:400;font-size:14px;color:var(--gold);margin:0 0 6px}
.land .mine a{color:var(--ink);text-decoration:none;border-bottom:1px dotted var(--line)}
.land .mine li{margin:3px 0;font-size:14px}
.land .mine small{color:var(--muted);margin-left:6px}
.land .priv{font-size:12px;color:var(--muted);margin-top:14px;line-height:1.4}
.sitebar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sitebar .sitebtn{padding:4px 10px;font-size:12px}
.sitebar .ghost{background:transparent;color:var(--gold);border:1px solid var(--line)}
.sitebar .ghost:hover{background:var(--panel-2)}
.sitebar .adm{font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.crumb{font-size:12.5px;color:var(--muted);margin:-8px 0 10px}
.crumb a{color:var(--gold);text-decoration:none}
.crumb a.bug{float:right;color:var(--muted);border:1px solid var(--line-2);padding:0 6px;font-size:11.5px}
.crumb a.bug:hover{color:var(--gold);border-color:var(--gold)}
.foot2 a{color:var(--gold)}
.prevhead{font-family:"Metamorphous",serif;font-size:16px;color:var(--gold);max-width:1180px;margin:22px auto 8px}
.appnote{font-size:12.5px;color:var(--muted);margin:8px 0 0;text-align:center}
.appnote a{color:var(--gold)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--gold);color:var(--ink);padding:8px 14px;font-size:13px;z-index:1000;box-shadow:0 6px 18px var(--shadow)}

.land.wide{max-width:1180px}
.hero2{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,.95fr);gap:28px;align-items:start;border:2px solid var(--line);background:linear-gradient(180deg,var(--panel-2),var(--panel) 40%,var(--panel-3));box-shadow:inset 0 0 0 1px var(--panel-3),inset 0 0 0 3px var(--line-2),0 10px 30px var(--shadow);padding:30px 32px 0 32px;position:relative;overflow:hidden}
.hero2::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 15% 0%,rgba(224,138,46,.16),transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.012) 0 2px,transparent 2px 9px);pointer-events:none}
.hero-txt{position:relative;padding:14px 0 20px}
.kicker{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ember);margin-bottom:10px}
.land .hero-txt h2{font-size:clamp(24px,3vw,34px);line-height:1.12;margin:0 0 12px}
.land .hero-txt p{font-size:15px;max-width:52ch}
.land .alt{font-size:13px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
.land .alt a{color:var(--gold);text-decoration:none;font-weight:700}
.hero-demo{position:relative;align-self:start;padding-bottom:18px}
.sheets.demo .blk:not(.b-head):not(.b-portrait):not(.b-attrs){display:none}
.sheets.demo .gear .row:nth-child(n+8){display:none}
.demo-cap{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:2px 0 8px}
.sheets.demo{display:block;overflow:visible;padding:0;zoom:.8}
.sheets.demo .sheet{display:block}
.demo-fade{display:none}
.hero2 .feats{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 24px;padding-top:18px;border-top:1px solid var(--line-2);position:relative}
.feat{background:rgba(0,0,0,.18);border:1px solid var(--line-2);padding:12px 12px 10px;display:grid;grid-template-columns:40px 1fr;gap:3px 10px;align-items:start}
.feat .fi{grid-row:1/3;width:40px;height:40px;background:var(--bar);border:1px solid var(--bar-line);display:grid;place-items:center}
.feat .fi img{width:34px;height:34px}
.feat b{font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:14px}
.feat span{font-size:12.5px;color:var(--ink-2);line-height:1.4}
.land .steps{margin-top:6px}
.secttl{font-family:"Metamorphous",serif;font-weight:400;font-size:16px;color:var(--gold);margin:18px 0 0}
.land .step code{font-size:11px;color:var(--ink)}
.land .step a{color:var(--gold)}
.land .mine ul{margin:0;padding-left:18px}
.appbox{display:grid;grid-template-columns:64px 1fr;gap:14px;margin-top:14px;border:1px solid var(--line);background:var(--panel);padding:16px 18px}
.appbox .appicon{width:64px;height:64px;background:var(--bar);border:1px solid var(--bar-line);display:grid;place-items:center}
.appbox .beta{font-family:"Averia Serif Libre",serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ember);border:1px solid var(--ember);padding:1px 5px;vertical-align:middle;margin-left:6px}
.appbox b{font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:16px}
.appbox p{margin:4px 0 8px;font-size:13.5px}
.appbox ol{margin:0 0 12px;padding-left:20px;font-size:13px;color:var(--ink-2);line-height:1.5}
.appbox code{font-size:12px;color:var(--ink)}
.appbox .sitebtn{text-decoration:none;display:inline-block}
.appbox .sha{font-size:11.5px;color:var(--muted);margin-top:8px;word-break:break-all;line-height:1.45}
.appbox .sha summary{cursor:pointer;color:var(--ink-2);list-style:none}
.appbox .sha summary::before{content:"▸ ";color:var(--gold)}
.appbox .sha[open] summary::before{content:"▾ "}
.appbox .sha code{color:var(--ink-2);font-size:11px}
.appbox .sitebtn small{font-weight:400;opacity:.8}
@media (max-width:560px){.appbox{grid-template-columns:1fr}}
.foot2{font-size:11.5px;color:var(--muted);margin-top:18px;text-align:center}
@media (max-width:900px){.hero2{grid-template-columns:1fr;padding:22px 20px 0}.hero2 .feats{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.hero2 .feats{grid-template-columns:1fr}}

.help{margin-top:16px;border:1px solid var(--line);background:var(--panel);padding:14px 18px 8px}
.help h3{font-family:"Metamorphous",serif;font-weight:400;font-size:16px;color:var(--gold);margin:0 0 6px}
.help details{border-top:1px solid var(--line-2);padding:8px 0}
.help details:first-of-type{border-top:0}
.help summary{cursor:pointer;color:var(--ink);font-size:14px;list-style:none;margin:0}
.help summary::before{content:"▸ ";color:var(--gold)}
.help details[open] summary::before{content:"▾ "}
.help p{font-size:13px;color:var(--ink-2);line-height:1.5;margin:6px 0 2px 18px}
.help code{font-size:11.5px;color:var(--ink);word-break:break-all}
.help a{color:var(--gold)}
.crumb a.bug + a.bug{margin-right:6px}

.admin .tot{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px}
.admin .tot div{background:var(--bar);border:1px solid var(--bar-line);padding:10px 12px}
.admin .tot b{display:block;font-size:22px;color:var(--gold-2);font-variant-numeric:tabular-nums}
.admin .tot span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.admin h3{font-family:"Metamorphous",serif;font-weight:400;font-size:16px;color:var(--gold);margin:16px 0 6px}
.admin h3 small{font-family:"Averia Serif Libre",serif;color:var(--muted);font-size:12px}
.admin .tw{overflow-x:auto}
.admin table.adm{width:100%;border-collapse:collapse;font-size:13px;background:var(--panel);border:1px solid var(--line)}
.admin table.adm th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
.admin table.adm td{padding:6px 8px;border-bottom:1px solid var(--line-2);vertical-align:top;color:var(--ink-2)}
.admin table.adm td a{color:var(--gold);text-decoration:none}
.admin table.adm small{color:var(--muted);font-size:11px;word-break:break-all}
.admin table.adm small.ua{opacity:.7}
.admin table.adm tr.done td{opacity:.45}
.admin table.adm code{font-size:12px;color:var(--ink)}
.admin table.adm .sitebtn{padding:2px 8px;font-size:11px}
@media (max-width:700px){.admin .tot{grid-template-columns:repeat(3,1fr)}}

.paths{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 10px}
.path{background:var(--bar);border:1px solid var(--bar-line);padding:12px 14px 10px;display:flex;flex-direction:column;gap:4px}
.path b{font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:14px}
.path span{font-size:12.5px;color:var(--ink-2);line-height:1.4;flex:1}
.path form{margin:8px 0 0;display:flex;gap:6px}
.path input{min-width:0;font-size:13px;padding:7px 9px}
.path button{padding:7px 12px;font-size:12px;white-space:nowrap}
.path form.idform{align-items:center;flex-wrap:wrap}
.path form.idform label{font-size:11.5px;color:var(--muted);white-space:nowrap}
.path form.idform input{flex:1;font-size:12px;padding:5px 8px}
.path form.idform button{padding:5px 10px;font-size:11px;background:transparent;color:var(--gold);border:1px solid var(--line)}
@media (max-width:640px){.paths{grid-template-columns:1fr}}

.cta4{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0 4px}
.cta{display:flex;flex-direction:column;gap:2px;padding:10px 12px;background:var(--bar);border:1px solid var(--line);text-decoration:none;color:var(--ink);transition:border-color .15s,background .15s}
.cta:hover{border-color:var(--gold);background:var(--panel-2)}
.cta b{font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:14px}
.cta span{font-size:11.5px;color:var(--muted)}
.cta.main{background:linear-gradient(180deg,rgba(217,164,65,.18),rgba(217,164,65,.06));border-color:var(--gold)}
.two-sec{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.sec{background:var(--panel);border:1px solid var(--line);padding:14px 18px 12px}
.sec h3{font-family:"Metamorphous",serif;font-weight:400;font-size:16px;color:var(--gold);margin:0 0 6px}
.sec p{font-size:13.5px;color:var(--ink-2);line-height:1.45;margin:0 0 8px}
.sec p.small{font-size:12px;color:var(--muted);margin:8px 0 0}
.sec p.small code{font-size:11px;color:var(--ink-2)}
.sec form{display:flex;gap:6px;margin:0}
.sec form input{flex:1;min-width:0;font:inherit;font-size:14px;padding:8px 10px;background:var(--bar);border:1px solid var(--line);color:var(--ink)}
.sec form.idform{align-items:center;flex-wrap:wrap}
.sec form.idform label{font-size:12px;color:var(--muted);white-space:nowrap}
.sec form.idform input{font-size:12.5px;padding:6px 8px}
.sec form.idform button{padding:6px 10px;font-size:11.5px;background:transparent;color:var(--gold);border:1px solid var(--line)}
.flash{animation:flash 1.6s ease-out}
@keyframes flash{0%{box-shadow:0 0 0 3px var(--gold)}100%{box-shadow:0 0 0 0 transparent}}
@media (max-width:640px){.two-sec{grid-template-columns:1fr}.cta4{grid-template-columns:1fr 1fr}}

.vwmodal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:1200;display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto}
.vwmodal .mbox{position:relative;width:min(620px,100%);background:linear-gradient(180deg,var(--panel-2),var(--panel));border:2px solid var(--line);box-shadow:inset 0 0 0 1px var(--panel-3),inset 0 0 0 3px var(--line-2),0 12px 40px rgba(0,0,0,.7);padding:22px 26px 20px;color:var(--ink)}
.vwmodal.wide .mbox{width:min(720px,100%)}
.vwmodal .mx{position:absolute;right:10px;top:8px;background:transparent;border:0;color:var(--muted);font-size:24px;line-height:1;cursor:pointer;padding:2px 8px}
.vwmodal .mx:hover{color:var(--rust)}
.vwmodal h4{font-family:"Metamorphous",serif;font-weight:400;font-size:20px;color:var(--gold);margin:0 0 10px;padding-right:28px}
.vwmodal .lead{font-size:14px;color:var(--ink-2);line-height:1.45;margin:0 0 10px}
.vwmodal .guide{margin:0 0 12px;padding-left:22px;font-size:14px;color:var(--ink);line-height:1.5}
.vwmodal .guide li{margin:0 0 8px}
.vwmodal .guide small{color:var(--muted);font-size:12px}
.vwmodal code{font-size:12px;color:var(--ink-2);word-break:break-all}
.vwmodal .mform{display:flex;gap:8px;margin:8px 0 0}
.vwmodal .mform input{flex:1;min-width:0;font:inherit;font-size:14px;padding:9px 11px;background:var(--bar);border:1px solid var(--line);color:var(--ink)}
.vwmodal .mrow{display:flex;gap:12px;align-items:center;margin-top:6px;flex-wrap:wrap}
.vwmodal .note{font-size:12.5px;color:var(--muted)}
.vwmodal .err{color:var(--rust);font-size:13px;min-height:18px;margin-top:4px}
.vwmodal .sheets.demo.full{transform:none;width:100%;zoom:1}
.vwmodal .sha{font-size:11.5px;color:var(--muted);line-height:1.45;word-break:break-all}
.vwmodal .sha summary{cursor:pointer;color:var(--ink-2);list-style:none}
.vwmodal .sha summary::before{content:"▸ ";color:var(--gold)}
.vwmodal .sha[open] summary::before{content:"▾ "}
.vwmodal .help.inmodal{margin:0;border:0;padding:0;background:transparent}
.vwmodal .sheets.demo.full .blk{display:block!important}

.mine.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.mine h3 small{font-family:"Averia Serif Libre",serif;color:var(--muted);font-size:11px;margin-left:6px}
.mine li{display:flex;align-items:center;gap:8px}
.mine li a{flex:0 1 auto}
.mine .mini{margin-left:auto;background:transparent;border:1px solid var(--line-2);color:var(--muted);font-size:13px;line-height:1;padding:1px 7px;cursor:pointer}
.mine .mini:hover{color:var(--rust);border-color:var(--rust)}
.mine .note{font-size:12.5px;color:var(--muted);margin:0}
@media (max-width:640px){.mine.two{grid-template-columns:1fr}}

.cta5{display:grid;grid-template-columns:1fr;gap:6px;margin:14px 0 4px;max-width:460px}
.cta5 .cta{flex-direction:row;align-items:baseline;gap:10px;padding:9px 12px}
.cta5 .cta b{font-size:15px;min-width:150px}
.cta5 .cta span{font-size:12px;flex:1}
.cta5 .cta .beta{font-style:normal;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ember);border:1px solid var(--ember);padding:1px 5px;margin-left:auto}
.land .mine{border:1px solid var(--line);background:var(--panel);padding:14px 18px 12px;margin-top:14px}
.land .mine h3{font-size:16px;display:flex;align-items:center;gap:8px;margin:0 0 8px}
.land .mine li{font-size:15px;margin:5px 0}
.land .mine li a{color:var(--ink);border-bottom:1px dotted var(--line)}
.land .mine .av{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--bar);border:1px solid var(--line);color:var(--gold);font-family:"Metamorphous",serif;font-size:13px;flex:none}
.land .mine .av.big{width:20px;height:20px;font-size:12px}
@media (max-width:640px){.cta5 .cta{flex-direction:column;gap:2px}.cta5 .cta b{min-width:0}}
`;
document.head.appendChild(style);

function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function mine(){ try { return JSON.parse(LS.get('vw-servers') || '[]'); } catch(e) { return []; } }
function forgetServer(sl){ LS.set('vw-servers', JSON.stringify(mine().filter(x => x.slug !== sl))); }
function localChars(){ try { return JSON.parse(LS.get('vw-local-chars') || '[]'); } catch(e) { return []; } }
function saveLocalChar(d){ const l = localChars().filter(x => x.player_id !== d.player_id && x.name !== d.name); l.unshift(d); try{ LS.set('vw-local-chars', JSON.stringify(l.slice(0, 6))); }catch(e){ toast(EN() ? 'Browser storage is full, the character is shown but not remembered.' : 'Úložiště prohlížeče je plné, postava se ukáže, ale nezapamatuje.'); } }
function forgetLocalChar(pid){ LS.set('vw-local-chars', JSON.stringify(localChars().filter(x => String(x.player_id) !== String(pid)))); }
function rememberServer(s, name, admin){ const l = mine().filter(x => x.slug !== s); l.unshift({slug: s, name, admin: !!admin}); LS.set('vw-servers', JSON.stringify(l.slice(0, 20))); }

/* ---------- uvodni stranka ---------- */
const FEAT = [
  ['SwordIron', 'Výbava a poškození', 'Gear and damage', 'Co má na sobě, celková zbroj, útok zbraně přepočtený na skill: za hit i DPS.', 'What they wear, total armor, weapon damage adjusted for skill: per hit and DPS.'],
  ['TrophyTheElder', 'Trofeje a velké kusy', 'Trophies and big prey', 'Trolly, medvědi, zrůdy, bossové. Kdo kolik zabil a co z toho padá.', 'Trolls, bears, abominations, bosses. Who killed how many and what they drop.'],
  ['ArrowFire', 'Boj a smrti', 'Combat and deaths', 'Rozdané a přijaté hity, šípy, smrti podle příčiny, hroby a jak se do nich vešel.', 'Hits dealt and taken, arrows, deaths by cause, tombstones and whether it all fit.'],
  ['Hammer', 'Cesta a práce', 'Travel and work', 'Kilometry pěšky, během, lodí. Postaveno, vytěženo, sebráno, snědeno, prozkoumaná mapa.', 'Kilometres walked, run and sailed. Built, mined, picked, eaten, explored map.']
];
async function landing(){
  const land = document.getElementById('landing'); land.hidden = false;
  document.getElementById('drop').hidden = false; document.getElementById('sheets').hidden = true;
  document.getElementById('h1').textContent = 'Valheim Warriors'; document.title = 'Valheim Warriors';
  const en = EN(); const my = mine(); const lc = localChars(); landingLang = LANG;
  const dropEl = document.getElementById('drop'); if(dropEl) setTimeout(() => { const anchor = land.querySelector('.foot2'); if(anchor) anchor.before(dropEl); }, 0);
  land.innerHTML = `<section class="land wide">
    <div class="hero2">
      <div class="hero-txt">
        <div class="kicker">${en ? 'Viking sheets for your Valheim party' : 'Listy vikingů pro vaši valheimskou partu'}</div>
        <h2>${en ? 'See your whole crew side by side. Straight from the save file.' : 'Celá parta vedle sebe. Přímo ze save souboru.'}</h2>
        <p>${en ? 'Everyone drops in their character file once, the page turns it into a sheet and your whole party sits side by side. The Sync app keeps it fresh after every game save.' : 'Každý jednou nahraje soubor své postavy, stránka z něj udělá list a celá parta je vedle sebe. Sync appka to pak drží aktuální po každém uložení hry.'}</p>
        <div class="cta5">
          <a class="cta" href="#" data-modal="demo"><b>${en ? 'Example' : 'Ukázka'}</b><span>${en ? 'a full character sheet' : 'celý list jedné postavy'}</span></a>
          <a class="cta" href="#" data-modal="own"><b>${en ? 'Try your own' : 'Nahrát vlastní'}</b><span>${en ? 'see your own character sheet, nothing is sent' : 'zobraz si list své postavy, nic se neposílá'}</span></a>
          <a class="cta main" href="#" data-modal="create"><b>${en ? 'Create a Valhalla' : 'Založit Valhalu'}</b><span>${en ? 'a shared page for your party: share and compare your journeys' : 'společná stránka pro partu: sdílejte a porovnávejte své cesty'}</span></a>
          <a class="cta" href="#" data-modal="join"><b>${en ? 'Join' : 'Připojit se'}</b><span>${en ? 'your party already has a Valhalla' : 'parta už Valhalu má'}</span></a>
          <a class="cta" href="#" data-modal="app"><b>${en ? 'Sync app' : 'Sync appka'}</b><span>${en ? 'your data updates itself after every game save' : 'data se aktualizují sama po každém uložení hry'}</span><em class="beta">beta</em></a>
        </div>
      </div>
      <div class="hero-demo"><div class="demo-cap">${en ? 'A real character, rendered live' : 'Skutečná postava, vykreslená živě'}</div><div class="sheets demo" id="demo"></div><div class="demo-fade"></div></div>
    <div class="feats">${FEAT.map(([ic, cz, e, dcz, de]) => `<div class="feat"><div class="fi" data-ic="${ic}"></div><b>${en ? e : cz}</b><span>${en ? de : dcz}</span></div>`).join('')}</div>
    </div>
    <h3 class="secttl">${en ? 'How it works' : 'Jak na to'}</h3>
    <div class="steps">
      <div class="step"><b>1 · ${en ? 'One of you creates a Valhalla' : 'Jeden z party založí Valhalu'}</b>${en ? 'Takes ten seconds, no account. They get a link and send it to the rest of you.' : 'Deset sekund, bez účtu. Dostane odkaz a pošle ho ostatním.'}</div>
      <div class="step"><b>2 · ${en ? 'Everyone drops in their character' : 'Každý nahraje svoji postavu'}</b>${en ? 'Open the link, drag your .fch file onto the page. It is in' : 'Otevři odkaz a přetáhni na stránku svůj soubor .fch. Najdeš ho v'} <code>Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters</code></div>
      <div class="step"><b>3 · ${en ? 'Keep it fresh' : 'Udržuj aktuální'}</b>${en ? 'Run the <a href="#" data-modal="app">Sync app</a> once: it uploads your character by itself after every game save. No app? Then drop the file again after each session. Only you (or the admin) can replace your character.' : 'Pusť si jednou <a href="#" data-modal="app">Sync appku</a>: po každém uložení hry nahraje postavu sama. Bez appky musíš po každém hraní soubor přetáhnout znovu. Tvoji postavu může přepsat jen ty (nebo admin).'}</div>
    </div>
    </div>

    ${(my.length || lc.length) ? `<div class="mine two"><div><h3><svg viewBox="0 0 64 64" width="20" height="20"><polygon points="32,4 58,14 54,40 32,60 10,40 6,14" fill="#1f1912" stroke="#d9a441" stroke-width="4"/><polygon points="32,14 48,22 45,38 32,50 19,38 16,22" fill="#d9a441"/></svg> ${en ? 'My Valhallas' : 'Moje Valhaly'}</h3>${my.length ? `<ul>${my.map(sv => `<li><span class="av">⚔</span><a href="${LINK(sv.slug)}">${esc(sv.name)}</a>${sv.admin ? `<small>admin</small>` : ''}<button class="mini" data-forget="${esc(sv.slug)}" title="${en ? 'Remove from this list (the Valhalla itself stays)' : 'Odebrat ze seznamu (Valhala sama zůstane)'}">×</button></li>`).join('')}</ul>` : `<p class="note">${en ? 'None yet.' : 'Zatím žádná.'}</p>`}</div>
      <div><h3><span class="av big">☺</span> ${en ? 'My characters' : 'Moje postavy'} <small>${en ? 'previews saved in this browser' : 'náhledy uložené v tomto prohlížeči'}</small></h3>${lc.length ? `<ul>${lc.map(c => `<li><span class="av">${esc((c.name || '?').slice(0, 1).toUpperCase())}</span><a href="#" data-showchar="${esc(String(c.player_id))}">${esc(c.name)}</a><small>${c.meta && c.meta.saved ? new Date(c.meta.saved).toLocaleDateString(en ? 'en-GB' : 'cs-CZ') : ''}</small><button class="mini" data-delchar="${esc(String(c.player_id))}" title="${en ? 'Delete this preview' : 'Smazat náhled'}">×</button></li>`).join('')}</ul>` : `<p class="note">${en ? 'None yet. Use Try your own above.' : 'Zatím žádná. Použij Nahrát vlastní nahoře.'}</p>`}</div></div>` : ''}
    <div class="help" id="help">${helpHTML(en)}</div>
    <div class="priv"><b>${en ? 'No spoilers, no positions.' : 'Bez spoilerů, bez pozic.'}</b> ${en ? 'The file is parsed in your browser and only statistics are stored: no map pins, no coordinates, no boss altars, nothing from biomes you have not reached. Locked achievements stay hidden.' : 'Soubor se zpracuje u tebe v prohlížeči a ukládají se jen statistiky: žádné pins, žádné souřadnice, žádné oltáře bossů, nic z biomů, kam jste ještě nedošli. Neodemčené achievementy zůstávají skryté.'}</div>
    <div class="foot2">${en ? 'Fan project, not affiliated with Iron Gate AB. Valheim is a trademark of Iron Gate AB. Item data and icons via valheim.tools.' : 'Fanouškovský projekt, nesouvisí s Iron Gate AB. Valheim je ochranná známka Iron Gate AB. Data a ikony předmětů přes valheim.tools.'} · <a href="#" data-report="1">${en ? 'Report a bug or idea' : 'Nahlásit chybu nebo nápad'}</a></div>
  </section>`;
  land.querySelectorAll('[data-modal]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); openModal(a.dataset.modal); }));
  land.addEventListener('click', ev => {
    const sh = ev.target.closest('[data-showchar]'); if(sh){ ev.preventDefault(); const c = localChars().find(x => String(x.player_id) === sh.dataset.showchar); if(c) openModal('char', c); return; }
    const dl = ev.target.closest('[data-delchar]'); if(dl){ forgetLocalChar(dl.dataset.delchar); landing(); return; }
    const fg = ev.target.closest('[data-forget]'); if(fg){ forgetServer(fg.dataset.forget); landing(); return; }
  });
  const bindForms = root => {
  const go = root.querySelector('#gosrv'); if(go) go.addEventListener('submit', ev => {
    ev.preventDefault(); const v = root.querySelector('#golink').value.trim(); const m = v.match(/\/s\/([a-z0-9-]+)/) || v.match(/[?&]s=([a-z0-9-]+)/) || (/^[a-z0-9-]{3,40}$/.test(v) ? [null, v] : null);
    if(!m){ root.querySelector('#goerr').textContent = en ? 'That does not look like a Valhalla link or ID.' : 'To nevypadá jako odkaz ani ID Valhaly.'; return; }
    location.href = LINK(m[1]) + (v.match(/#admin=[A-Za-z0-9]+/) || [''])[0];
  });
  const nw = root.querySelector('#newsrv'); if(nw) nw.addEventListener('submit', async ev => {
    ev.preventDefault(); const err = root.querySelector('#srverr'); err.textContent = '';
    const name = root.querySelector('#srvname').value.trim(); if(name.length < 2) return;
    try{
      const [res] = await rpc('vw_create_server', {p_name: name});
      LS.set('vw-admin-' + res.slug, res.admin_token); rememberServer(res.slug, name, true);
      location.href = LINK(res.slug) + '#new';
    }catch(e){ err.textContent = (en ? 'Could not create the Valhalla: ' : 'Valhalu se nepodařilo založit: ') + e.message; }
  });
  };
  window.__bindForms = bindForms;
  if(location.hash === '#app'){ history.replaceState(null, '', location.pathname + location.search); setTimeout(() => openModal('app'), 50); }
  await window.ASSETS_READY;
  document.querySelectorAll('.feat .fi').forEach(el => { const ic = ASSETS.icons[el.dataset.ic]; if(ic) el.innerHTML = `<img src="${ic}" alt="">`; });
  try{
    if(!window.DEMO) window.DEMO = await (await fetch('/assets/demo.json', {cache: 'force-cache'})).json();
    const d = window.DEMO; CHARS_BY_NAME[d.name] = d;
    const el = document.getElementById('demo'); if(el) el.innerHTML = sheet(d);
  }catch(e){ console.error('demo', e); const hd = document.querySelector('.hero-demo'); if(hd) hd.remove(); const ex = land.querySelector('[data-scroll="demo"]'); if(ex){ ex.removeAttribute('data-scroll'); ex.href = LINK('valheim-2026'); } }
}
// prepnuti jazyka na uvodni strance: render() z sablony zavola SITE_RENDER, ten prekresli landing
const helpHTML = en => `<h3>${en ? 'Help' : 'Nápověda'}</h3>
      <details><summary>${en ? 'Where is my character file (.fch)?' : 'Kde najdu soubor své postavy (.fch)?'}</summary><p>${en ? 'Steam: <code>C:\\Program Files (x86)\\Steam\\userdata\\&lt;your Steam id&gt;\\892970\\remote\\characters\\&lt;name&gt;.fch</code>. Without Steam Cloud, or on Game Pass: <code>%USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\characters_local</code>. Ignore files with <code>_backup_</code> or <code>.old</code>. The game writes the file when you log out and every ~20 minutes while playing.' : 'Steam: <code>C:\\Program Files (x86)\\Steam\\userdata\\&lt;tvoje Steam id&gt;\\892970\\remote\\characters\\&lt;jméno&gt;.fch</code>. Bez Steam Cloudu nebo na Game Passu: <code>%USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\characters_local</code>. Soubory s <code>_backup_</code> nebo <code>.old</code> ignoruj. Hra soubor zapisuje při odhlášení a zhruba každých 20 minut hraní.'}</p></details>
      <details><summary>${en ? 'Who can overwrite or remove a character? What is the character key?' : 'Kdo může postavu přepsat nebo odebrat? Co je klíč postavy?'}</summary><p>${en ? 'The first upload of a character creates a secret <b>character key</b>, stored in the browser (or the Sync app) that uploaded it. Only that browser/app, or the Valhalla admin, may overwrite or remove the character, so nobody can push a fake sheet of you. If you switch device or browser, or start using the Sync app, move the key: in the browser that owns the character click <b>⚿ Character key</b> under its sheet (copies it); in the app open Settings, click the character row and the key is in the <b>Character key</b> field. Paste it where the upload gets refused. Or simply remove the character (×) from the owning device and upload it fresh from the new one.' : 'První nahrání postavy vytvoří tajný <b>klíč postavy</b>, který se uloží do prohlížeče (nebo Sync appky), odkud se nahrávalo. Přepsat nebo odebrat postavu může jen tento prohlížeč/appka, nebo admin Valhaly, takže ti nikdo nemůže podstrčit falešný list. Když změníš zařízení nebo prohlížeč, nebo začneš používat Sync appku, klíč si přenes: v prohlížeči, který postavu vlastní, klikni pod jejím listem na <b>⚿ Klíč postavy</b> (zkopíruje se); v appce otevři Nastavení, klikni na řádek postavy a klíč je v poli <b>Klíč postavy</b>. Vlož ho tam, kde nahrání hlásí odmítnutí. Nebo postavu na původním zařízení odeber (×) a z nového nahraj znovu.'}</p></details>
      <details><summary>${en ? 'What is the admin link?' : 'Co je admin odkaz?'}</summary><p>${en ? 'Whoever creates a Valhalla gets a second link ending with <code>#admin=…</code>. Opening it on any device makes that browser the Valhalla admin: it can remove any character and overwrite any upload. Keep it to yourself; the normal link is what you share with the party. You can copy both again via the <b>Invite</b> button on the Valhalla page (admin link shows only for the admin).' : 'Kdo Valhalu zakládá, dostane i druhý odkaz končící <code>#admin=…</code>. Otevřením na libovolném zařízení se ten prohlížeč stane adminem Valhaly: může odebrat jakoukoli postavu a přepsat jakékoli nahrání. Nech si ho pro sebe, partě posílej běžný odkaz. Oba odkazy znovu zkopíruješ tlačítkem <b>Pozvat</b> na stránce Valhaly (admin odkaz vidí jen admin).'}</p></details>
      <details><summary>${en ? 'The Sync app says the character was uploaded by someone else' : 'Sync appka hlásí, že postavu nahrál někdo jiný'}</summary><p>${en ? 'You uploaded the character in the browser first, so the browser holds the key. Either paste the key from the browser (⚿ Character key under the sheet) into the app (Settings, Character key), or remove the character on the web (×) and let the app upload it. Windows keeps old notifications in the notification centre, so check the status column in the app for the current state.' : 'Postavu jsi nejdřív nahrál v prohlížeči, takže klíč má prohlížeč. Buď vlož klíč z prohlížeče (⚿ Klíč postavy pod listem) do appky (Nastavení, Klíč postavy), nebo postavu na webu odeber (×) a nech ji nahrát appku. Windows staré bubliny nechává v centru oznámení, aktuální stav uvidíš ve sloupci Stav v appce.'}</p></details>
      <details><summary>${en ? 'How current are the numbers?' : 'Jak aktuální jsou čísla?'}</summary><p>${en ? 'Each sheet shows <b>Data as of</b> the time the .fch file was saved by the game. Upload again after a session (or let the Sync app do it) and the sheet updates. Deaths, kills and similar counters are lifetime totals of the character across all worlds it visited.' : 'Každý list ukazuje <b>Stav k</b> času, kdy hra soubor uložila. Po hraní nahraj znovu (nebo to nech na Sync appce) a list se přepíše. Smrti, zabití a podobné počty jsou celoživotní součty postavy ze všech světů, kde byla.'}</p></details>
      <details><summary>${en ? 'What is sent to the server? Spoilers?' : 'Co se posílá na server? Spoilery?'}</summary><p>${en ? 'The file is parsed in your browser or in the app. Only statistics leave your PC: no map pins, no coordinates, no spawn, death or logout positions, no boss altars, no world data. Locked achievements are never shown. Sheets show only things the character already owns or killed, so nothing from biomes the party has not reached.' : 'Soubor se zpracuje v prohlížeči nebo v appce. Z počítače odejdou jen statistiky: žádné pins, souřadnice, pozice spawnu, smrti nebo odhlášení, žádné oltáře bossů, žádná data světa. Neodemčené achievementy se nikdy neukazují. Listy ukazují jen věci, které postava už má nebo zabila, tedy nic z biomů, kam parta ještě nedošla.'}</p></details>
      <details><summary>${en ? 'Windows blocks the Sync app' : 'Windows blokuje Sync appku'}</summary><p>${en ? 'The app is an unsigned beta. SmartScreen: choose <i>More info</i>, then <i>Run anyway</i>. PCs with <i>Smart App Control</i> enabled refuse unsigned apps entirely; there, upload through the web page instead (one drag and drop after each session). The app runs in the system tray; launching it again just opens its window.' : 'Appka je nepodepsaná beta. SmartScreen: zvol <i>Další informace</i>, pak <i>Přesto spustit</i>. Počítače se zapnutým <i>Smart App Control</i> nepodepsané appky odmítají úplně; tam nahrávej přes web (jedno přetažení po každém hraní). Appka běží v liště u hodin; další spuštění jen otevře její okno.'}</p></details>
      <details><summary>${en ? 'Something is wrong or missing' : 'Něco nefunguje nebo chybí'}</summary><p>${en ? 'Use <a href="#" data-report="1">Report a bug or idea</a> (no account needed). Say which Valhalla, which character and what you expected. If you have GitHub, <a href="https://github.com/honzamudroch/valheimwarriors/issues/new" target="_blank" rel="noopener">Issues</a> work too.' : 'Použij <a href="#" data-report="1">Nahlásit chybu nebo nápad</a> (bez účtu). Uveď Valhalu, postavu a co jsi čekal. Kdo má GitHub, může i do <a href="https://github.com/honzamudroch/valheimwarriors/issues/new" target="_blank" rel="noopener">Issues</a>.'}</p></details>
    `;
let landingLang = null;
function closeModal(){ const m = document.getElementById('vwmodal'); if(m) m.remove(); document.body.style.overflow = ''; }
function openModal(kind, data){
  closeModal(); const en = EN();
  const FILE = `<code>C:\\Program Files (x86)\\Steam\\userdata\\&lt;${en ? 'your Steam id' : 'tvoje Steam id'}&gt;\\892970\\remote\\characters\\&lt;${en ? 'name' : 'jméno'}&gt;.fch</code>`;
  let title = '', body = '';
  if(kind === 'char' && data){
    title = esc(data.name);
    body = `<p class="lead">${en ? 'Your character, parsed in this browser only. To share it with your party, drop the same file into your Valhalla.' : 'Tvoje postava, zpracovaná jen v tomto prohlížeči. Pro sdílení s partou přetáhni ten samý soubor do své Valhaly.'}</p><div class="sheets demo full" id="demo-full"></div>`;
  } else if(kind === 'demo'){
    title = en ? 'Example: one character sheet' : 'Ukázka: list jedné postavy';
    body = `<p class="lead">${en ? 'This is a real character from a live Valhalla. Hover items, trophies and creatures for details. In a Valhalla your whole party sits like this side by side.' : 'Skutečná postava ze živé Valhaly. Najeď myší na předměty, trofeje a potvory, ukážou detail. Ve Valhale je takhle vedle sebe celá parta.'}</p><div class="sheets demo full" id="demo-full"></div>`;
  } else if(kind === 'own'){
    title = en ? 'Try it with your own character' : 'Vyzkoušej to na vlastní postavě';
    body = `<ol class="guide">
      <li>${en ? 'Find your character file. Steam:' : 'Najdi soubor své postavy. Steam:'} ${FILE}</li>
      <li>${en ? 'Pick it below (or drag it anywhere onto this page).' : 'Vyber ho níže (nebo ho přetáhni kamkoli na tuhle stránku).'}</li>
      <li>${en ? 'The sheet opens in a window and is remembered under My characters below. Nothing leaves your browser.' : 'List se otevře v okně a zůstane uložený dole v Moje postavy. Nic neodejde z tvého prohlížeče.'}</li></ol>
      <div class="mrow"><button class="sitebtn" id="own-pick">${en ? 'Choose file' : 'Vybrat soubor'}</button><span class="note" id="own-msg"></span></div>`;
  } else if(kind === 'create'){
    title = en ? 'Create a Valhalla' : 'Založit Valhalu';
    body = `<p class="lead">${en ? 'A Valhalla is a shared page for one party. Everyone uploads their own character to it and you all see each other there.' : 'Valhala je společná stránka jedné party. Každý do ní nahraje svoji postavu a vidíte se tam všichni.'}</p>
      <ol class="guide">
      <li>${en ? 'Type your party name and press Create. No account needed.' : 'Napiš název party a dej Založit. Účet není potřeba.'}</li>
      <li>${en ? 'You get two links. Send the <b>normal link</b> to your party. Keep the <b>admin link</b> for yourself: it lets you remove characters and manage the Valhalla from another device.' : 'Dostaneš dva odkazy. <b>Běžný odkaz</b> pošli partě. <b>Admin odkaz</b> si nech: umožní ti mazat postavy a spravovat Valhalu z jiného zařízení.'}</li>
      <li>${en ? 'Upload your own character on the Valhalla page (drag the .fch file there), others do the same.' : 'Na stránce Valhaly nahraj svoji postavu (přetáhni tam soubor .fch), ostatní udělají to samé.'}</li></ol>
      <form id="newsrv" class="mform"><input id="srvname" maxlength="60" required placeholder="${en ? 'Party name' : 'Název party'}" autocomplete="off"><button type="submit">${en ? 'Create' : 'Založit'}</button></form><div class="err" id="srverr"></div>`;
  } else if(kind === 'help'){
    title = en ? 'Help' : 'Nápověda';
    body = `<div class="help inmodal">${helpHTML(en).replace(/<h3>[^]*?<\/h3>/, '')}</div>`;
  } else if(kind === 'app'){
    title = en ? 'Sync app: updates without lifting a finger' : 'Sync appka: aktualizace bez práce';
    body = `<p class="lead">${en ? 'A small Windows program that sits in the tray, watches your Steam character folder and uploads your character to your Valhalla after every game save. You never drag the file again and your party always sees fresh numbers.' : 'Malý program pro Windows, který sedí v liště u hodin, hlídá složku s postavami ve Steamu a po každém uložení hry nahraje tvoji postavu do Valhaly. Soubor už nikdy nepřetahuješ a parta vidí vždy čerstvá čísla.'}</p>
      <ol class="guide">
      <li>${en ? 'Download and run' : 'Stáhni a spusť'} <code>ValheimWarriorsSync.exe</code>. ${en ? 'Unsigned beta: Windows warns about an unknown publisher, choose More info, Run anyway. On PCs with Smart App Control turned on it will not run, use the web there.' : 'Nepodepsaná beta: Windows varuje před neznámým vydavatelem, zvol Další informace, Přesto spustit. Na PC se zapnutým Smart App Control se nespustí, tam používej web.'}</li>
      <li>${en ? 'Paste your Valhalla link (or press Find my Valhallas), tick your character, optionally Start with Windows.' : 'Vlož odkaz své Valhaly (nebo dej Najít moje Valhaly), zaškrtni svoji postavu, případně Spouštět při startu Windows.'}</li>
      <li>${en ? 'Save. From now on it uploads by itself; the sheet shows a green "Sync app" badge.' : 'Ulož. Od teď nahrává sama; na listu je zelený štítek "Sync appka".'}</li></ol>
      <div class="mrow"><a class="sitebtn" href="/download/ValheimWarriorsSync.exe" download style="text-decoration:none">${en ? 'Download for Windows' : 'Stáhnout pro Windows'} <small>· v0.1.4 · 30 MB</small></a></div>
      <div class="mrow small"><details class="sha"><summary>${en ? 'Verify the download' : 'Ověření staženého souboru'}</summary>${en ? 'Unsigned apps cannot prove who made them, so here is the fingerprint of the file I published. In PowerShell run <code>Get-FileHash ValheimWarriorsSync.exe</code>; the result must be' : 'Nepodepsaná appka nemůže prokázat, kdo ji vydal, proto je tady otisk zveřejněného souboru. V PowerShellu spusť <code>Get-FileHash ValheimWarriorsSync.exe</code>; výsledek musí být'} <code>384f87cef77b1c749b9a59f8faa11b4bd6cc053d132114a8285af4e2003a455c</code>. ${en ? 'If it differs, do not run the file.' : 'Když se liší, soubor nespouštěj.'}</details></div>
      <div class="note" style="margin-top:8px">${en ? 'Open source Python (PyInstaller). Reads only .fch files in the folders you choose and sends the same statistics as the web page. Config lives in %APPDATA%\ValheimWarriors.' : 'Otevřený Python (PyInstaller). Čte jen soubory .fch ve zvolených složkách a posílá ty samé statistiky jako web. Nastavení je v %APPDATA%\ValheimWarriors.'}</div>`;
  } else if(kind === 'add'){
    title = en ? 'Add your character to this Valhalla' : 'Přidat svou postavu do této Valhaly';
    body = `<ol class="guide">
      <li>${en ? 'Find your character file. Steam:' : 'Najdi soubor své postavy. Steam:'} ${FILE}</li>
      <li>${en ? 'Pick it below, or drag it anywhere onto this page.' : 'Vyber ho níže, nebo ho přetáhni kamkoli na tuhle stránku.'}</li>
      <li>${en ? 'Your sheet appears next to the others. Only this browser (and the admin) can replace it later. After a session upload again, or use the Sync app.' : 'Tvůj list se objeví vedle ostatních. Přepsat ho pak může jen tento prohlížeč (a admin). Po hraní nahraj znovu, nebo použij Sync appku.'}</li></ol>
      <div class="mrow"><button class="sitebtn" id="own-pick">${en ? 'Choose file' : 'Vybrat soubor'}</button><span class="note">${en ? 'Parsed in your browser, only statistics are stored.' : 'Zpracuje se v prohlížeči, ukládají se jen statistiky.'}</span></div>`;
  } else if(kind === 'join'){
    title = en ? 'Join your party' : 'Připojit se k partě';
    body = `<ol class="guide">
      <li>${en ? 'Somebody in your party created a Valhalla and sent you a link like <code>valheimwarriors.com/s/…</code>. Open it. That is the whole trick, nothing to fill in here.' : 'Někdo z party založil Valhalu a poslal ti odkaz typu <code>valheimwarriors.com/s/…</code>. Otevři ho. To je celé, tady nic vyplňovat nemusíš.'}</li>
      <li>${en ? 'On that page drag your character file onto the dashed box. Steam:' : 'Na té stránce přetáhni soubor své postavy do čárkovaného rámečku. Steam:'} ${FILE}</li>
      <li>${en ? 'After a session drop the file again, or run the Sync app once and it uploads by itself.' : 'Po hraní soubor přetáhni znovu, nebo si jednou pusť Sync appku a nahrává se sám.'}</li></ol>
      <div class="mrow"><label for="golink" class="note">${en ? 'Got only the ID instead of a link?' : 'Dostal jsi jen ID místo odkazu?'}</label></div>
      <form id="gosrv" class="mform"><input id="golink" placeholder="${en ? 'e.g. valheim-2026' : 'např. valheim-2026'}" autocomplete="off"><button type="submit">${en ? 'Open' : 'Otevřít'}</button></form><div class="err" id="goerr"></div>`;
  }
  const m = document.createElement('div'); m.id = 'vwmodal'; m.className = 'vwmodal' + (kind === 'demo' || kind === 'char' ? ' wide' : '');
  m.innerHTML = `<div class="mbox"><button class="mx" aria-label="Zavřít">×</button><h4>${title}</h4>${body}</div>`;
  document.body.appendChild(m); document.body.style.overflow = 'hidden';
  m.addEventListener('click', ev => { if(ev.target === m || ev.target.closest('.mx') || ev.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function esc(ev){ if(ev.key === 'Escape'){ closeModal(); document.removeEventListener('keydown', esc); } });
  if(window.__bindForms) window.__bindForms(m);
  const inp = m.querySelector('input'); if(inp) setTimeout(() => inp.focus(), 50);
  if(kind === 'char' && data){ const el = m.querySelector('#demo-full'); CHARS_BY_NAME[data.name] = data; el.innerHTML = sheet(data); }
  if(kind === 'demo'){ const d = window.DEMO; const el = m.querySelector('#demo-full'); if(d && el){ CHARS_BY_NAME[d.name] = d; el.innerHTML = sheet(d); } else if(el) el.innerHTML = `<p class="note">${en ? 'Example not available, open a live Valhalla:' : 'Ukázka není k dispozici, otevři živou Valhalu:'} <a href="${LINK('valheim-2026')}">Valheim 2026</a></p>`; }
  if(kind === 'own' || kind === 'add'){ m.querySelector('#own-pick').addEventListener('click', () => { const fi = document.getElementById('file'); if(fi){ fi.click(); } }); }
}
window.addEventListener('vw-loaded', () => { closeModal(); const st = document.getElementById('dropStatus'); const nm = st && (st.textContent.match(/[:]\s*(.+)$/) || [])[1]; const sh = [...document.querySelectorAll('#sheets .sheet')].find(x => nm && x.querySelector('.name') && x.querySelector('.name').textContent === nm.trim()) || document.querySelector('#sheets .sheet'); if(sh) sh.scrollIntoView({behavior: 'smooth', block: 'start', inline: 'nearest'}); });
window.SITE_RENDER_LANDING = () => {
  const l = document.getElementById('landing'); if(slug || isAdminPage || !l || l.hidden) return;
  if(landingLang !== LANG) landing();   // prepnuti jazyka: prekreslit celou uvodni stranku
  const en = EN();
  document.getElementById('sheets').hidden = true;
  const anchor = l.querySelector('.foot2'); const dz = document.getElementById('drop'); if(anchor && dz && dz.nextElementSibling !== anchor) anchor.before(dz);
  const dt = document.getElementById('dropT'), ds = document.getElementById('dropS');
  const dz0 = document.getElementById('drop'); if(dz0) dz0.id = 'drop', dz0.setAttribute('data-anchor', 'preview');
  if(!document.getElementById('preview')){ const a = document.createElement('div'); a.id = 'preview'; a.className = 'prevhead'; a.textContent = en ? 'Preview your own character (just for you, stays in your browser)' : 'Náhled vlastní postavy (jen pro tebe, zůstane u tebe v prohlížeči)'; document.getElementById('drop').before(a); }
  if(dt) dt.textContent = en ? 'Drop your .fch file here' : 'Přetáhni sem soubor .fch';
  if(ds) ds.innerHTML = en ? 'Stays in your browser, nothing is sent anywhere. To share with your party, use your Valhalla link instead. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters' : 'Zůstane u tebe v prohlížeči, nikam se neposílá. Pro sdílení s partou použij odkaz své Valhaly. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters';
};

/* ---------- stranka serveru ---------- */
async function server(){
  const hm = location.hash.match(/admin=([A-Za-z0-9]+)/);
  if(hm){ LS.set('vw-admin-' + slug, hm[1]); history.replaceState(null, '', location.pathname + location.search); }
  const isNew = location.hash === '#new'; if(isNew) history.replaceState(null, '', location.pathname + location.search);
  ADMIN = LS.get('vw-admin-' + slug);
  let srv, rows;
  try{ [srv, rows] = await Promise.all([rpc('vw_get_server', {p_slug: slug}), rpc('vw_get_characters', {p_slug: slug})]); }
  catch(e){ notFound(e.message); return; }
  if(!srv.length){ notFound(); return; }
  SERVER = srv[0];
  if(ADMIN){ try{ if(!(await rpc('vw_is_admin', {p_slug: slug, p_token: ADMIN}))){ ADMIN = null; LS.del('vw-admin-' + slug); } }catch(e){} }
  rememberServer(slug, SERVER.name, !!ADMIN);
  chars.length = 0;
  rows.forEach(r => { const d = r.data; d.meta = Object.assign({}, d.meta || {}, {saved: r.saved_at, uploaded_at: r.uploaded_at, player_id: r.player_id, uploaded: !!(ADMIN || LS.get(tokKey(r.player_id)))}); chars.push(d); });
  visible = new Set(chars.map(c => c.name));
  await window.ASSETS_READY; render();
  if(isNew) showInvite(true);
}
function notFound(msg){
  const land = document.getElementById('landing'); land.hidden = false; document.getElementById('drop').hidden = true; document.getElementById('sheets').hidden = true;
  land.innerHTML = `<section class="land"><div class="hero"><h2>${EN() ? 'Valhalla not found' : 'Valhala nenalezena'}</h2><p>${esc(slug)}${msg ? ' · ' + esc(msg) : ''}</p><a class="sitebtn" href="${HOME}" style="text-decoration:none;display:inline-block">${EN() ? 'Back' : 'Zpět'}</a></div></section>`;
}
function copy(text){ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return Promise.resolve(); }
function showInvite(withAdmin){
  const en = EN(); const link = ABS(slug);
  const box = document.createElement('div'); box.className = 'achpop on'; box.style.cssText = 'top:70px;right:16px;left:auto;width:min(420px,92vw)';
  box.innerHTML = `<h4>${en ? 'Invite the party' : 'Pozvi partu'}<span>${esc(SERVER.name)}</span></h4>
    <div class="note" style="margin-bottom:4px">${en ? 'Link for everyone' : 'Odkaz pro všechny'}</div><div class="a" style="grid-template-columns:1fr auto"><code style="font-size:12px;word-break:break-all">${esc(link)}</code><button class="sitebtn" data-copy="${esc(link)}">${en ? 'Copy' : 'Kopírovat'}</button></div>
    ${withAdmin && ADMIN ? `<div class="note" style="margin:10px 0 4px">${en ? 'Admin link, keep it to yourself (lets you remove any character or open the Valhalla on another device)' : 'Admin odkaz, nech si ho pro sebe (můžeš mazat cizí postavy a otevřít správu z jiného zařízení)'}</div><div class="a" style="grid-template-columns:1fr auto"><code style="font-size:12px;word-break:break-all">${esc(link + '#admin=' + ADMIN)}</code><button class="sitebtn" data-copy="${esc(link + '#admin=' + ADMIN)}">${en ? 'Copy' : 'Kopírovat'}</button></div>` : ''}
    <div style="text-align:right;margin-top:10px"><button class="sitebtn ghost" data-close="1">${en ? 'Close' : 'Zavřít'}</button></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', async ev => { const c = ev.target.closest('[data-copy]'); if(c){ await copy(c.dataset.copy); toast(en ? 'Copied' : 'Zkopírováno'); } if(ev.target.closest('[data-close]')) box.remove(); });
}

function reportBox(){
  const en = EN(); if(document.getElementById('reportbox')) return;
  const box = document.createElement('div'); box.className = 'achpop on'; box.id = 'reportbox'; box.style.cssText = 'top:70px;right:16px;left:auto;width:min(440px,92vw)';
  box.innerHTML = `<h4>${en ? 'Report a bug or idea' : 'Nahlásit chybu nebo nápad'}<span>${slug ? esc(slug) : 'web'}</span></h4>
    <textarea id="rep-text" rows="6" maxlength="2000" placeholder="${en ? 'What happened, what did you expect? Which character?' : 'Co se stalo, co jsi čekal? Která postava?'}" style="width:100%;font:inherit;font-size:13px;background:var(--bar);color:var(--ink);border:1px solid var(--line);padding:8px;resize:vertical"></textarea>
    <input id="rep-contact" maxlength="120" placeholder="${en ? 'Contact (optional: Discord, e-mail)' : 'Kontakt (nepovinné: Discord, e-mail)'}" style="width:100%;margin-top:6px;font:inherit;font-size:13px;background:var(--bar);color:var(--ink);border:1px solid var(--line);padding:7px 8px">
    <div class="note" id="rep-msg" style="min-height:16px"></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><button class="sitebtn ghost" data-close="1">${en ? 'Close' : 'Zavřít'}</button><button class="sitebtn" id="rep-send">${en ? 'Send' : 'Odeslat'}</button></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', async ev => {
    if(ev.target.closest('[data-close]')){ box.remove(); return; }
    if(ev.target.id !== 'rep-send') return;
    const t = document.getElementById('rep-text').value.trim(); const c = document.getElementById('rep-contact').value.trim(); const m = document.getElementById('rep-msg');
    if(t.length < 5){ m.textContent = en ? 'Write a few words at least.' : 'Napiš aspoň pár slov.'; return; }
    ev.target.disabled = true;
    try{ await rpc('vw_report', {p_text: t, p_contact: c || null, p_page: location.pathname + location.search, p_slug: slug || null, p_ua: navigator.userAgent.slice(0, 200)}); box.remove(); toast(en ? 'Thanks, sent.' : 'Díky, odesláno.'); }
    catch(e){ m.textContent = (en ? 'Could not send: ' : 'Nepodařilo se odeslat: ') + e.message; ev.target.disabled = false; }
  });
}
document.addEventListener('click', ev => { const r = ev.target.closest('[data-report]'); if(r){ ev.preventDefault(); reportBox(); } const md = ev.target.closest('[data-modal]'); if(md && !md.closest('.land')){ ev.preventDefault(); openModal(md.dataset.modal); } });
document.addEventListener('click', async ev => { const k = ev.target.closest('[data-key]'); if(k){ await copy(k.dataset.key); toast(EN() ? 'Key copied' : 'Klíč zkopírován'); } });
window.SITE_UPLOAD = async d => {
  if(!SERVER){   // uvodni stranka: jen lokalni nahled v okne, nic se neposila
    saveLocalChar(d); await landing(); openModal('char', d); return;
  }
  let tok = ADMIN || LS.get(tokKey(d.player_id)); let t;
  try{ t = await rpc('vw_upsert_character', {p_slug: slug, p_data: d, p_saved_at: d.meta.saved || null, p_token: tok}); }
  catch(e){
    if(!/not allowed/.test(e.message)) throw e;
    const k = prompt(EN() ? `${d.name} was uploaded from another browser or by the Sync app. Paste the character key (from the other browser: "Character key" under the sheet; from the app: Settings, Character key):` : `${d.name} byl nahrán z jiného prohlížeče nebo Sync appkou. Vlož klíč postavy (v druhém prohlížeči: „Klíč postavy“ pod listem; v appce: Nastavení, Klíč postavy):`);
    if(!k) throw new Error(EN() ? 'upload cancelled, character belongs to another device' : 'nahrání zrušeno, postava patří jinému zařízení');
    tok = k.trim(); t = await rpc('vw_upsert_character', {p_slug: slug, p_data: d, p_saved_at: d.meta.saved || null, p_token: tok});
  }
  if(!ADMIN) LS.set(tokKey(d.player_id), t);
  d.meta.uploaded = true; d.meta.player_id = d.player_id; d.meta.uploaded_at = new Date().toISOString();
  const i = chars.findIndex(c => c.player_id === d.player_id || c.name === d.name); if(i >= 0) chars.splice(i, 1, d); else chars.push(d);
  visible.add(d.name); render(); window.dispatchEvent(new Event('vw-loaded'));
};
window.SITE_REMOVE = async name => {
  const c = chars.find(x => x.name === name); if(!c) return false;
  if(!confirm(EN() ? `Remove ${name} from this Valhalla?` : `Odebrat ${name} z této Valhaly?`)) return false;
  const pid = c.meta.player_id || c.player_id; const tok = ADMIN || LS.get(tokKey(pid));
  try{ await rpc('vw_remove_character', {p_slug: slug, p_player_id: pid, p_token: tok}); LS.del(tokKey(pid)); return true; }
  catch(e){ toast((EN() ? 'Cannot remove: ' : 'Nejde odebrat: ') + e.message); return false; }
};
window.SITE_RENDER = () => {
  if(!SERVER){ if(window.SITE_RENDER_LANDING) window.SITE_RENDER_LANDING(); return; }
  const en = EN();
  document.getElementById('h1').textContent = SERVER.name; document.title = SERVER.name + ' · Valheim Warriors';
  let bar = document.getElementById('sitebar');
  if(!bar){ bar = document.createElement('div'); bar.id = 'sitebar'; bar.className = 'sitebar'; document.querySelector('.top > div').prepend(bar); }
  bar.innerHTML = `<button type="button" class="sitebtn" id="addchar">${en ? '+ Add my character' : '+ Přidat svou postavu'}</button><button type="button" class="sitebtn ghost" id="invite">${en ? 'Invite' : 'Pozvat'}</button>${ADMIN ? `<span class="adm">admin</span>` : ''}`;
  document.getElementById('addchar').onclick = () => openModal('add');
  document.getElementById('invite').onclick = () => showInvite(true);
  let crumb = document.getElementById('crumb');
  if(!crumb){ crumb = document.createElement('div'); crumb.id = 'crumb'; crumb.className = 'crumb'; document.querySelector('.top').after(crumb); }
  crumb.innerHTML = `<a href="${HOME}">Valheim Warriors</a> › ${esc(SERVER.name)} · ${chars.length} ${en ? (chars.length === 1 ? 'character' : 'characters') : (chars.length === 1 ? 'postava' : chars.length < 5 ? 'postavy' : 'postav')} <a class="bug" href="#" data-report="1">${en ? 'report a bug' : 'nahlásit chybu'}</a><a class="bug" href="#" data-modal="help">${en ? 'help' : 'nápověda'}</a>`;
  const dt = document.getElementById('dropT'), ds = document.getElementById('dropS');
  if(dt) dt.textContent = en ? 'Drop your character file (.fch) here, it shows up for the whole party' : 'Přetáhni sem svou postavu (.fch), objeví se celé partě';
  if(ds) ds.innerHTML = en ? 'Parsed in your browser, only statistics are stored. Upload again after playing to refresh. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters' : 'Zpracuje se u tebe v prohlížeči, ukládají se jen statistiky. Po hraní nahraj znovu a list se obnoví. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters';
  const empty = document.querySelector('#sheets .empty'); if(empty) empty.textContent = en ? 'Nobody in this Valhalla yet. Drop a .fch file below.' : 'Ve Valhale ještě nikdo není. Přetáhni níže soubor .fch.';
  document.querySelectorAll('#sheets .sheet').forEach(sh => {
    const name = sh.querySelector('.name')?.textContent; const c = CHARS_BY_NAME[name]; if(!c) return;
    const pid = c.meta.player_id || c.player_id; const tok = LS.get(tokKey(pid)); const foot = sh.querySelector('.foot');
    if(tok && foot && !foot.querySelector('[data-key]')) foot.insertAdjacentHTML('beforeend', `<span class="rmlink" data-key="${esc(tok)}" style="color:var(--gold)" title="${en ? 'Copy the key for the Sync app or another browser' : 'Zkopírovat klíč pro Sync appku nebo jiný prohlížeč'}">⚿ ${en ? 'Character key' : 'Klíč postavy'}</span>`);
  });
  const dz = document.getElementById('drop');
  if(dz && !document.getElementById('appnote')){ dz.insertAdjacentHTML('afterend', `<div class="appnote" id="appnote">${en ? 'Tired of dragging? <a href="#" data-modal="app">Sync app for Windows</a> uploads your character after every save.' : 'Nechceš přetahovat ručně? <a href="#" data-modal="app">Sync appka pro Windows</a> nahraje postavu po každém uložení sama.'}</div>`); }
};


/* ---------- automaticke hlaseni JS chyb (max 1 na nacteni) ---------- */
let errSent = false;
window.addEventListener('error', ev => {
  if(errSent) return; errSent = true;
  const msg = `${ev.message || 'error'} @ ${(ev.filename || '').split('/').pop()}:${ev.lineno || 0}`;
  try{ rpc('vw_report', {p_text: msg.slice(0, 500), p_kind: 'error', p_page: location.pathname + location.search, p_slug: slug || null, p_ua: navigator.userAgent.slice(0, 200)}).catch(() => {}); }catch(e){}
});

/* ---------- admin: prehled pro spravce webu ---------- */
async function adminPage(){
  const land = document.getElementById('landing'); land.hidden = false;
  document.getElementById('drop').hidden = true; document.getElementById('sheets').hidden = true; document.getElementById('who').style.display = 'none';
  document.getElementById('h1').textContent = 'Valheim Warriors · admin'; document.title = 'Admin · Valheim Warriors';
  const hm = location.hash.match(/key=([A-Za-z0-9]+)/); if(hm){ LS.set('vw-site-admin', hm[1]); history.replaceState(null, '', location.pathname + location.search); }
  const key = LS.get('vw-site-admin');
  const en = EN();
  if(!key){ land.innerHTML = `<section class="land"><div class="hero"><h2>Admin</h2><p>${en ? 'Open this page through your admin link (with #key=…).' : 'Otevři tuhle stránku přes svůj admin odkaz (s #key=…).'}</p></div></section>`; return; }
  let d;
  try{ d = await rpc('vw_admin_overview', {p_key: key}); }
  catch(e){ LS.del('vw-site-admin'); land.innerHTML = `<section class="land"><div class="hero"><h2>Admin</h2><p>${esc(e.message)}</p></div></section>`; return; }
  const fmtT = t => { const x = new Date(t); return isNaN(x) ? '' : `${x.getDate()}. ${x.getMonth() + 1}. ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
  const reps = d.reports || []; const bugs = reps.filter(r => r.kind === 'bug'), errs = reps.filter(r => r.kind === 'error');
  const repRow = r => `<tr class="${r.done ? 'done' : ''}"><td>${fmtT(r.created_at)}</td><td>${esc(r.slug || '')}<br><small>${esc(r.page || '')}</small></td><td>${esc(r.text)}${r.contact ? `<br><small>${esc(r.contact)}</small>` : ''}${r.ua ? `<br><small class="ua">${esc(r.ua)}</small>` : ''}</td><td><label><input type="checkbox" data-done="${r.id}" ${r.done ? 'checked' : ''}> ${en ? 'done' : 'vyřešeno'}</label></td></tr>`;
  land.innerHTML = `<section class="land wide admin">
    <div class="tot"><div><b>${d.totals.servers}</b><span>${en ? 'Valhallas' : 'Valhal'}</span></div><div><b>${d.totals.characters}</b><span>${en ? 'characters' : 'postav'}</span></div><div><b>${d.totals.uploads_24h}</b><span>${en ? 'uploads 24 h' : 'nahrání za 24 h'}</span></div><div><b>${d.totals.db_kb >= 1024 ? (d.totals.db_kb / 1024).toFixed(1) + ' MB' : d.totals.db_kb + ' kB'}</b><span>${en ? 'database' : 'databáze'}</span></div><div><b>${bugs.filter(r => !r.done).length}</b><span>${en ? 'open bugs' : 'otevřené bugy'}</span></div><div><b>${errs.filter(r => !r.done).length}</b><span>${en ? 'open errors' : 'otevřené chyby'}</span></div></div>
    <h3>${en ? 'Valhallas' : 'Valhaly'} <small>${d.servers.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'Name' : 'Název'}</th><th>slug</th><th>${en ? 'Characters' : 'Postavy'}</th><th>${en ? 'Created' : 'Založen'}</th><th>${en ? 'Last activity' : 'Poslední aktivita'}</th><th></th></tr>
    ${d.servers.map(sv => `<tr><td><a href="${LINK(sv.slug)}">${esc(sv.name)}</a></td><td><code>${esc(sv.slug)}</code></td><td>${sv.chars}<br><small>${esc(sv.names)}</small></td><td>${fmtT(sv.created_at)}</td><td>${fmtT(sv.last_activity)}</td><td><button class="sitebtn ghost" data-del="${esc(sv.slug)}">${en ? 'delete' : 'smazat'}</button></td></tr>`).join('')}</table></div>
    <h3>${en ? 'Bug reports' : 'Nahlášené bugy a nápady'} <small>${bugs.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'When' : 'Kdy'}</th><th>${en ? 'Where' : 'Kde'}</th><th>${en ? 'Text' : 'Text'}</th><th></th></tr>${bugs.map(repRow).join('') || `<tr><td colspan="4"><i>${en ? 'nothing yet' : 'zatím nic'}</i></td></tr>`}</table></div>
    <h3>${en ? 'Errors caught on the site' : 'Chyby zachycené na webu'} <small>${errs.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'When' : 'Kdy'}</th><th>${en ? 'Where' : 'Kde'}</th><th>${en ? 'Error' : 'Chyba'}</th><th></th></tr>${errs.map(repRow).join('') || `<tr><td colspan="4"><i>${en ? 'nothing yet' : 'zatím nic'}</i></td></tr>`}</table></div>
    <div class="priv">${en ? 'Only you see this page (site admin key in this browser). Sync app logs stay on each PC in %APPDATA%\\ValheimWarriors\\sync.log.' : 'Tuhle stránku vidíš jen ty (admin klíč webu v tomto prohlížeči). Logy Sync appky zůstávají u každého v %APPDATA%\\ValheimWarriors\\sync.log.'}</div>
  </section>`;
  land.addEventListener('change', async ev => { const c = ev.target.closest('[data-done]'); if(!c) return; try{ await rpc('vw_admin_report_done', {p_key: key, p_id: +c.dataset.done, p_done: c.checked}); c.closest('tr').classList.toggle('done', c.checked); }catch(e){ toast(e.message); } });
  land.addEventListener('click', async ev => { const b = ev.target.closest('[data-del]'); if(!b) return; const sl = b.dataset.del; if(!confirm((en ? 'Delete Valhalla ' : 'Smazat Valhalu ') + sl + (en ? ' with all its characters?' : ' se všemi postavami?'))) return; try{ await rpc('vw_admin_delete_server', {p_key: key, p_slug: sl}); b.closest('tr').remove(); toast(en ? 'Deleted' : 'Smazáno'); }catch(e){ toast(e.message); } });
}

if(isAdminPage) adminPage(); else if(slug) server(); else landing();
})();
