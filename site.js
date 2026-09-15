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
.appnote{font-size:12.5px;color:var(--muted);margin:8px 0 0;text-align:center}
.appnote a{color:var(--gold)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--gold);color:var(--ink);padding:8px 14px;font-size:13px;z-index:1000;box-shadow:0 6px 18px var(--shadow)}

.land.wide{max-width:1180px}
.hero2{display:grid;grid-template-columns:minmax(300px,1.05fr) minmax(320px,1fr);gap:28px;align-items:center;border:2px solid var(--line);background:linear-gradient(180deg,var(--panel-2),var(--panel) 40%,var(--panel-3));box-shadow:inset 0 0 0 1px var(--panel-3),inset 0 0 0 3px var(--line-2),0 10px 30px var(--shadow);padding:30px 32px 0 32px;position:relative;overflow:hidden}
.hero2::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 15% 0%,rgba(224,138,46,.16),transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.012) 0 2px,transparent 2px 9px);pointer-events:none}
.hero-txt{position:relative;padding-bottom:30px}
.kicker{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ember);margin-bottom:10px}
.land .hero-txt h2{font-size:clamp(24px,3vw,34px);line-height:1.12;margin:0 0 12px}
.land .hero-txt p{font-size:15px;max-width:52ch}
.land .alt{font-size:13px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
.land .alt a{color:var(--gold);text-decoration:none;font-weight:700}
.hero-demo{position:relative;max-height:560px;overflow:hidden;align-self:start}
.demo-cap{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:2px 0 8px}
.sheets.demo{display:block;overflow:visible;padding:0;transform:scale(.86);transform-origin:top left;width:116%}
.sheets.demo .sheet{display:block}
.demo-fade{position:absolute;left:0;right:0;bottom:0;height:140px;background:linear-gradient(transparent,var(--panel-3));pointer-events:none}
.feats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
.feat{background:var(--panel);border:1px solid var(--line);padding:14px 14px 12px;display:grid;grid-template-columns:44px 1fr;gap:4px 12px;align-items:start}
.feat .fi{grid-row:1/3;width:44px;height:44px;background:var(--bar);border:1px solid var(--bar-line);display:grid;place-items:center}
.feat .fi img{width:38px;height:38px}
.feat b{font-family:"Metamorphous",serif;font-weight:400;color:var(--gold);font-size:14px}
.feat span{font-size:12.5px;color:var(--ink-2);line-height:1.4}
.land .steps{margin-top:10px}
.land .step code{font-size:11px;color:var(--ink)}
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
@media (max-width:900px){.hero2{grid-template-columns:1fr;padding:22px 20px 0}.hero-demo{max-height:420px}.feats{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.feats{grid-template-columns:1fr}}

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
@media (max-width:640px){.paths{grid-template-columns:1fr}}
`;
document.head.appendChild(style);

function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function mine(){ try { return JSON.parse(LS.get('vw-servers') || '[]'); } catch(e) { return []; } }
function rememberServer(s, name, admin){ const l = mine().filter(x => x.slug !== s); l.unshift({slug: s, name, admin: !!admin}); LS.set('vw-servers', JSON.stringify(l.slice(0, 20))); }

/* ---------- uvodni stranka ---------- */
const FEAT = [
  ['SwordIron', 'Výbava a poškození', 'Gear and damage', 'Co má na sobě, celková zbroj, útok zbraně přepočtený na skill: za hit i DPS.', 'What they wear, total armor, weapon damage adjusted for skill: per hit and DPS.'],
  ['TrophyTheElder', 'Trofeje a velké kusy', 'Trophies and big game', 'Trolly, medvědi, zrůdy, bossové. Kdo kolik zabil a co z toho padá.', 'Trolls, bears, abominations, bosses. Who killed how many and what they drop.'],
  ['ArrowFire', 'Boj a smrti', 'Combat and deaths', 'Rozdané a přijaté hity, šípy, smrti podle příčiny, hroby a jak se do nich vešel.', 'Hits dealt and taken, arrows, deaths by cause, tombstones and whether it all fit.'],
  ['Hammer', 'Cesta a práce', 'Travel and work', 'Kilometry pěšky, během, lodí. Postaveno, vytěženo, sebráno, snědeno, prozkoumaná mapa.', 'Kilometres walked, run and sailed. Built, mined, picked, eaten, explored map.']
];
async function landing(){
  const land = document.getElementById('landing'); land.hidden = false;
  document.getElementById('drop').hidden = false; document.getElementById('sheets').hidden = chars.length === 0;
  document.getElementById('h1').textContent = 'Valheim Warriors'; document.title = 'Valheim Warriors';
  const en = EN(); const my = mine(); landingLang = LANG;
  const dropEl = document.getElementById('drop'); if(dropEl && chars.length === 0) setTimeout(() => { const hero = land.querySelector('.hero2'); if(hero && chars.length === 0) hero.after(dropEl); }, 0);
  land.innerHTML = `<section class="land wide">
    <div class="hero2">
      <div class="hero-txt">
        <div class="kicker">${en ? 'Viking sheets for your Valheim party' : 'Listy vikingů pro vaši valheimskou partu'}</div>
        <h2>${en ? 'See your whole crew side by side. Straight from the save file.' : 'Celá parta vedle sebe. Přímo ze save souboru.'}</h2>
        <p>${en ? 'Create a server, send one link. Everyone drops in their character file once and the page turns it into a sheet: gear, skills, kills, deaths, travel, work, explored map. Then run the small Sync app and your sheet updates itself after every game save, nothing else to do. No app? Just drop the file again after a session.' : 'Založ server, pošli jeden odkaz. Každý jednou přetáhne soubor své postavy a stránka z něj udělá list: výbava, dovednosti, zabití, smrti, cesta, práce, prozkoumaná mapa. Pak si pustí malou Sync appku a list se obnovuje sám po každém uložení hry, nic dalšího dělat nemusíš. Bez appky stačí po hraní soubor přetáhnout znovu.'}</p>
        <div class="paths">
          <div class="path"><b>${en ? 'Your party already has a server?' : 'Parta už server má?'}</b><span>${en ? 'Open the link they sent you (looks like valheimwarriors.com/s/…) and drop your character file there.' : 'Otevři odkaz, který ti poslali (vypadá jako valheimwarriors.com/s/…), a přetáhni tam svoji postavu.'}</span>
            <form id="gosrv"><input id="golink" placeholder="${en ? 'Paste the link here' : 'Sem vlož odkaz'}" autocomplete="off"><button type="submit">${en ? 'Open' : 'Otevřít'}</button></form><div class="err" id="goerr"></div></div>
          <div class="path"><b>${en ? 'Starting a server for your party?' : 'Zakládáš server pro partu?'}</b><span>${en ? 'Name it, you get a link to share. One per party is enough.' : 'Pojmenuj ho, dostaneš odkaz pro ostatní. Stačí jeden na partu.'}</span>
            <form id="newsrv"><input id="srvname" maxlength="60" required placeholder="${en ? 'Server or party name' : 'Název serveru nebo party'}" autocomplete="off"><button type="submit">${en ? 'Create server' : 'Založit server'}</button></form><div class="err" id="srverr"></div></div>
        </div>
        <div class="alt"><span>${en ? 'Just curious about your own character? Drop the .fch file below, it stays in your browser.' : 'Chceš jen vidět svoji postavu? Přetáhni soubor .fch níže, zůstane u tebe v prohlížeči.'}</span> <a href="${LINK('valheim-2026')}">${en ? 'Peek at a live server' : 'Kouknout na živý server'} ›</a></div>
      </div>
      <div class="hero-demo"><div class="demo-cap">${en ? 'A real character, rendered live' : 'Skutečná postava, vykreslená živě'}</div><div class="sheets demo" id="demo"></div><div class="demo-fade"></div></div>
    </div>
    <div class="feats">${FEAT.map(([ic, cz, e, dcz, de]) => `<div class="feat"><div class="fi" data-ic="${ic}"></div><b>${en ? e : cz}</b><span>${en ? de : dcz}</span></div>`).join('')}</div>
    <div class="steps">
      <div class="step"><b>1 · ${en ? 'One of you creates a server' : 'Jeden z party založí server'}</b>${en ? 'Takes ten seconds, no account. He gets a link and sends it to the rest of you.' : 'Deset sekund, bez účtu. Dostane odkaz a pošle ho ostatním.'}</div>
      <div class="step"><b>2 · ${en ? 'Everyone drops in their character' : 'Každý nahraje svoji postavu'}</b>${en ? 'Open the link, drag your .fch file onto the page. It is in' : 'Otevři odkaz a přetáhni na stránku svůj soubor .fch. Najdeš ho v'} <code>Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters</code></div>
      <div class="step"><b>3 · ${en ? 'Keep it fresh' : 'Udržuj aktuální'}</b>${en ? 'Drop the file again after a session, or run the Sync app once and forget about it. Only you (or the admin) can replace your character.' : 'Po hraní soubor přetáhni znovu, nebo si jednou pusť Sync appku a už na to nemysli. Tvoji postavu může přepsat jen ty (nebo admin).'}</div>
    </div>
    <div class="appbox" id="app">
      <div class="appicon"><svg viewBox="0 0 64 64" width="44" height="44"><polygon points="32,4 58,14 54,40 32,60 10,40 6,14" fill="#1f1912" stroke="#d9a441" stroke-width="3"/><polygon points="32,14 48,22 45,38 32,50 19,38 16,22" fill="#d9a441"/></svg></div>
      <div class="apptxt"><b>${en ? 'Sync app for Windows' : 'Sync appka pro Windows'} <span class="beta">beta</span></b>
        <p>${en ? 'Runs in the tray, watches your Steam character folder and uploads the character to your server after every save. Nothing to drag, everyone always sees fresh data. No install, single file.' : 'Běží v liště u hodin, hlídá složku s postavami ve Steamu a po každém uložení hry postavu sama nahraje na tvůj server. Nic se nepřetahuje, parta má vždy čerstvá data. Bez instalace, jeden soubor.'}</p>
        <ol><li>${en ? 'Download and run' : 'Stáhni a spusť'} <code>ValheimWarriorsSync.exe</code>${en ? ' (unsigned beta: Windows warns about an unknown publisher, choose More info, Run anyway; on PCs with Smart App Control turned on it will not run, upload via the web instead)' : ' (nepodepsaná beta: Windows varuje před neznámým vydavatelem, zvol Další informace, Přesto spustit; na PC se zapnutým Smart App Control se nespustí, tam nahrávej přes web)'}</li><li>${en ? 'Paste your server link, tick your character, optionally "Start with Windows"' : 'Vlož odkaz svého serveru, zaškrtni svoji postavu, případně „Spouštět při startu Windows“'}</li><li>${en ? 'Save. Done, it uploads after every game save.' : 'Ulož. Hotovo, nahrává po každém uložení hry.'}</li></ol>
        <a class="sitebtn" href="/download/ValheimWarriorsSync.exe" download>${en ? 'Download for Windows' : 'Stáhnout pro Windows'} <small>· v0.1.2 · 30 MB</small></a>
        <details class="sha"><summary>${en ? 'Verify the download' : 'Ověření staženého souboru'}</summary>${en ? 'Unsigned apps cannot prove who made them, so here is the fingerprint of the file I published. In PowerShell run <code>Get-FileHash ValheimWarriorsSync.exe</code>; the result must be' : 'Nepodepsaná appka nemůže prokázat, kdo ji vydal, proto je tady otisk zveřejněného souboru. V PowerShellu spusť <code>Get-FileHash ValheimWarriorsSync.exe</code>; výsledek musí být'} <code>55615f68265f090b110f6e33529a35112070594101da11c6276342455d217bcd</code>. ${en ? 'If it differs, do not run the file.' : 'Když se liší, soubor nespouštěj.'}</details>
        <div class="priv" style="margin-top:8px">${en ? 'Open source Python (PyInstaller). Reads only .fch files in the folders you choose and sends the same statistics as the web page. Config lives in %APPDATA%\ValheimWarriors.' : 'Otevřený Python (PyInstaller). Čte jen soubory .fch ve zvolených složkách a posílá ty samé statistiky jako web. Nastavení je v %APPDATA%\ValheimWarriors.'}</div>
      </div>
    </div>

    <div class="help" id="help">
      <h3>${en ? 'Help' : 'Nápověda'}</h3>
      <details><summary>${en ? 'Where is my character file (.fch)?' : 'Kde najdu soubor své postavy (.fch)?'}</summary><p>${en ? 'Steam: <code>C:\\Program Files (x86)\\Steam\\userdata\\&lt;your Steam id&gt;\\892970\\remote\\characters\\&lt;name&gt;.fch</code>. Without Steam Cloud, or on Game Pass: <code>%USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\characters_local</code>. Ignore files with <code>_backup_</code> or <code>.old</code>. The game writes the file when you log out and every ~20 minutes while playing.' : 'Steam: <code>C:\\Program Files (x86)\\Steam\\userdata\\&lt;tvoje Steam id&gt;\\892970\\remote\\characters\\&lt;jméno&gt;.fch</code>. Bez Steam Cloudu nebo na Game Passu: <code>%USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\characters_local</code>. Soubory s <code>_backup_</code> nebo <code>.old</code> ignoruj. Hra soubor zapisuje při odhlášení a zhruba každých 20 minut hraní.'}</p></details>
      <details><summary>${en ? 'Who can overwrite or remove a character? What is the character key?' : 'Kdo může postavu přepsat nebo odebrat? Co je klíč postavy?'}</summary><p>${en ? 'The first upload of a character creates a secret <b>character key</b>, stored in the browser (or the Sync app) that uploaded it. Only that browser/app, or the server admin, may overwrite or remove the character, so nobody can push a fake sheet of you. If you switch device or browser, or start using the Sync app, move the key: in the browser that owns the character click <b>⚿ Character key</b> under its sheet (copies it); in the app open Settings, click the character row and the key is in the <b>Character key</b> field. Paste it where the upload gets refused. Or simply remove the character (×) from the owning device and upload it fresh from the new one.' : 'První nahrání postavy vytvoří tajný <b>klíč postavy</b>, který se uloží do prohlížeče (nebo Sync appky), odkud se nahrávalo. Přepsat nebo odebrat postavu může jen tento prohlížeč/appka, nebo admin serveru, takže ti nikdo nemůže podstrčit falešný list. Když změníš zařízení nebo prohlížeč, nebo začneš používat Sync appku, klíč si přenes: v prohlížeči, který postavu vlastní, klikni pod jejím listem na <b>⚿ Klíč postavy</b> (zkopíruje se); v appce otevři Nastavení, klikni na řádek postavy a klíč je v poli <b>Klíč postavy</b>. Vlož ho tam, kde nahrání hlásí odmítnutí. Nebo postavu na původním zařízení odeber (×) a z nového nahraj znovu.'}</p></details>
      <details><summary>${en ? 'What is the admin link?' : 'Co je admin odkaz?'}</summary><p>${en ? 'Whoever creates a server gets a second link ending with <code>#admin=…</code>. Opening it on any device makes that browser the server admin: it can remove any character and overwrite any upload. Keep it to yourself; the normal link is what you share with the party. You can copy both again via the <b>Invite</b> button on the server page (admin link shows only for the admin).' : 'Kdo server zakládá, dostane i druhý odkaz končící <code>#admin=…</code>. Otevřením na libovolném zařízení se ten prohlížeč stane adminem serveru: může odebrat jakoukoli postavu a přepsat jakékoli nahrání. Nech si ho pro sebe, partě posílej běžný odkaz. Oba odkazy znovu zkopíruješ tlačítkem <b>Pozvat</b> na stránce serveru (admin odkaz vidí jen admin).'}</p></details>
      <details><summary>${en ? 'The Sync app says the character was uploaded by someone else' : 'Sync appka hlásí, že postavu nahrál někdo jiný'}</summary><p>${en ? 'You uploaded the character in the browser first, so the browser holds the key. Either paste the key from the browser (⚿ Character key under the sheet) into the app (Settings, Character key), or remove the character on the web (×) and let the app upload it. Windows keeps old notifications in the notification centre, so check the status column in the app for the current state.' : 'Postavu jsi nejdřív nahrál v prohlížeči, takže klíč má prohlížeč. Buď vlož klíč z prohlížeče (⚿ Klíč postavy pod listem) do appky (Nastavení, Klíč postavy), nebo postavu na webu odeber (×) a nech ji nahrát appku. Windows staré bubliny nechává v centru oznámení, aktuální stav uvidíš ve sloupci Stav v appce.'}</p></details>
      <details><summary>${en ? 'How current are the numbers?' : 'Jak aktuální jsou čísla?'}</summary><p>${en ? 'Each sheet shows <b>Data as of</b> the time the .fch file was saved by the game. Upload again after a session (or let the Sync app do it) and the sheet updates. Deaths, kills and similar counters are lifetime totals of the character across all worlds it visited.' : 'Každý list ukazuje <b>Stav k</b> času, kdy hra soubor uložila. Po hraní nahraj znovu (nebo to nech na Sync appce) a list se přepíše. Smrti, zabití a podobné počty jsou celoživotní součty postavy ze všech světů, kde byla.'}</p></details>
      <details><summary>${en ? 'What is sent to the server? Spoilers?' : 'Co se posílá na server? Spoilery?'}</summary><p>${en ? 'The file is parsed in your browser or in the app. Only statistics leave your PC: no map pins, no coordinates, no spawn, death or logout positions, no boss altars, no world data. Locked achievements are never shown. Sheets show only things the character already owns or killed, so nothing from biomes the party has not reached.' : 'Soubor se zpracuje v prohlížeči nebo v appce. Z počítače odejdou jen statistiky: žádné pins, souřadnice, pozice spawnu, smrti nebo odhlášení, žádné oltáře bossů, žádná data světa. Neodemčené achievementy se nikdy neukazují. Listy ukazují jen věci, které postava už má nebo zabila, tedy nic z biomů, kam parta ještě nedošla.'}</p></details>
      <details><summary>${en ? 'Windows blocks the Sync app' : 'Windows blokuje Sync appku'}</summary><p>${en ? 'The app is an unsigned beta. SmartScreen: choose <i>More info</i>, then <i>Run anyway</i>. PCs with <i>Smart App Control</i> enabled refuse unsigned apps entirely; there, upload through the web page instead (one drag and drop after each session). The app runs in the system tray; launching it again just opens its window.' : 'Appka je nepodepsaná beta. SmartScreen: zvol <i>Další informace</i>, pak <i>Přesto spustit</i>. Počítače se zapnutým <i>Smart App Control</i> nepodepsané appky odmítají úplně; tam nahrávej přes web (jedno přetažení po každém hraní). Appka běží v liště u hodin; další spuštění jen otevře její okno.'}</p></details>
      <details><summary>${en ? 'Something is wrong or missing' : 'Něco nefunguje nebo chybí'}</summary><p>${en ? 'Use <a href="#" data-report="1">Report a bug or idea</a> (no account needed). Say which server, which character and what you expected. If you have GitHub, <a href="https://github.com/honzamudroch/valheimwarriors/issues/new" target="_blank" rel="noopener">Issues</a> work too.' : 'Použij <a href="#" data-report="1">Nahlásit chybu nebo nápad</a> (bez účtu). Uveď server, postavu a co jsi čekal. Kdo má GitHub, může i do <a href="https://github.com/honzamudroch/valheimwarriors/issues/new" target="_blank" rel="noopener">Issues</a>.'}</p></details>
    </div>
    ${my.length ? `<div class="mine"><h3>${en ? 'My servers' : 'Moje servery'}</h3><ul>${my.map(s => `<li><a href="${LINK(s.slug)}">${esc(s.name)}</a>${s.admin ? `<small>admin</small>` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="priv"><b>${en ? 'No spoilers, no positions.' : 'Bez spoilerů, bez pozic.'}</b> ${en ? 'The file is parsed in your browser and only statistics are stored: no map pins, no coordinates, no boss altars, nothing from biomes you have not reached. Locked achievements stay hidden.' : 'Soubor se zpracuje u tebe v prohlížeči a ukládají se jen statistiky: žádné pins, žádné souřadnice, žádné oltáře bossů, nic z biomů, kam jste ještě nedošli. Neodemčené achievementy zůstávají skryté.'}</div>
    <div class="foot2">${en ? 'Fan project, not affiliated with Iron Gate AB. Valheim is a trademark of Iron Gate AB. Item data and icons via valheim.tools.' : 'Fanouškovský projekt, nesouvisí s Iron Gate AB. Valheim je ochranná známka Iron Gate AB. Data a ikony předmětů přes valheim.tools.'} · <a href="#" data-report="1">${en ? 'Report a bug or idea' : 'Nahlásit chybu nebo nápad'}</a></div>
  </section>`;
  document.getElementById('gosrv').addEventListener('submit', ev => {
    ev.preventDefault(); const v = document.getElementById('golink').value.trim(); const m = v.match(/\/s\/([a-z0-9-]+)/) || v.match(/[?&]s=([a-z0-9-]+)/) || (/^[a-z0-9-]{3,40}$/.test(v) ? [null, v] : null);
    if(!m){ document.getElementById('goerr').textContent = en ? 'That does not look like a server link.' : 'To nevypadá jako odkaz na server.'; return; }
    location.href = LINK(m[1]) + (v.match(/#admin=[A-Za-z0-9]+/) || [''])[0];
  });
  document.getElementById('newsrv').addEventListener('submit', async ev => {
    ev.preventDefault(); const err = document.getElementById('srverr'); err.textContent = '';
    const name = document.getElementById('srvname').value.trim(); if(name.length < 2) return;
    try{
      const [res] = await rpc('vw_create_server', {p_name: name});
      LS.set('vw-admin-' + res.slug, res.admin_token); rememberServer(res.slug, name, true);
      location.href = LINK(res.slug) + '#new';
    }catch(e){ err.textContent = (en ? 'Could not create server: ' : 'Server se nepodařilo založit: ') + e.message; }
  });
  await window.ASSETS_READY;
  document.querySelectorAll('.feat .fi').forEach(el => { const ic = ASSETS.icons[el.dataset.ic]; if(ic) el.innerHTML = `<img src="${ic}" alt="">`; });
  try{
    if(!window.DEMO) window.DEMO = await (await fetch('/assets/demo.json', {cache: 'force-cache'})).json();
    const d = window.DEMO; CHARS_BY_NAME[d.name] = d;
    const el = document.getElementById('demo'); if(el) el.innerHTML = sheet(d);
  }catch(e){ const hd = document.querySelector('.hero-demo'); if(hd) hd.remove(); }
}
// prepnuti jazyka na uvodni strance: render() z sablony zavola SITE_RENDER, ten prekresli landing
let landingLang = null;
window.SITE_RENDER_LANDING = () => {
  const l = document.getElementById('landing'); if(slug || isAdminPage || !l || l.hidden) return;
  if(landingLang !== LANG) landing();   // prepnuti jazyka: prekreslit celou uvodni stranku
  const en = EN();
  const sheetsEl = document.getElementById('sheets'); sheetsEl.hidden = chars.length === 0;
  const hero = l.querySelector('.hero2'); if(hero && chars.length){ hero.after(sheetsEl); const dz = document.getElementById('drop'); if(dz) sheetsEl.after(dz); }
  const dt = document.getElementById('dropT'), ds = document.getElementById('dropS');
  if(dt) dt.textContent = en ? 'Preview your own character here (.fch)' : 'Náhled vlastní postavy: přetáhni sem soubor .fch';
  if(ds) ds.innerHTML = en ? 'Stays in your browser, nothing is sent anywhere. To share with your party, use your server link instead. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters' : 'Zůstane u tebe v prohlížeči, nikam se neposílá. Pro sdílení s partou použij odkaz svého serveru. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters';
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
  land.innerHTML = `<section class="land"><div class="hero"><h2>${EN() ? 'Server not found' : 'Server nenalezen'}</h2><p>${esc(slug)}${msg ? ' · ' + esc(msg) : ''}</p><a class="sitebtn" href="${HOME}" style="text-decoration:none;display:inline-block">${EN() ? 'Back' : 'Zpět'}</a></div></section>`;
}
function copy(text){ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return Promise.resolve(); }
function showInvite(withAdmin){
  const en = EN(); const link = ABS(slug);
  const box = document.createElement('div'); box.className = 'achpop on'; box.style.cssText = 'top:70px;right:16px;left:auto;width:min(420px,92vw)';
  box.innerHTML = `<h4>${en ? 'Invite the party' : 'Pozvi partu'}<span>${esc(SERVER.name)}</span></h4>
    <div class="note" style="margin-bottom:4px">${en ? 'Link for everyone' : 'Odkaz pro všechny'}</div><div class="a" style="grid-template-columns:1fr auto"><code style="font-size:12px;word-break:break-all">${esc(link)}</code><button class="sitebtn" data-copy="${esc(link)}">${en ? 'Copy' : 'Kopírovat'}</button></div>
    ${withAdmin && ADMIN ? `<div class="note" style="margin:10px 0 4px">${en ? 'Admin link, keep it to yourself (lets you remove any character or open the server on another device)' : 'Admin odkaz, nech si ho pro sebe (můžeš mazat cizí postavy a otevřít správu z jiného zařízení)'}</div><div class="a" style="grid-template-columns:1fr auto"><code style="font-size:12px;word-break:break-all">${esc(link + '#admin=' + ADMIN)}</code><button class="sitebtn" data-copy="${esc(link + '#admin=' + ADMIN)}">${en ? 'Copy' : 'Kopírovat'}</button></div>` : ''}
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
document.addEventListener('click', ev => { const r = ev.target.closest('[data-report]'); if(r){ ev.preventDefault(); reportBox(); } });
document.addEventListener('click', async ev => { const k = ev.target.closest('[data-key]'); if(k){ await copy(k.dataset.key); toast(EN() ? 'Key copied' : 'Klíč zkopírován'); } });
window.SITE_UPLOAD = async d => {
  if(!SERVER){   // uvodni stranka: jen lokalni nahled, nic se neposila
    d.meta.uploaded = true; const i = chars.findIndex(c => c.name === d.name); if(i >= 0) chars.splice(i, 1, d); else chars.push(d);
    visible.add(d.name); render(); return;
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
  visible.add(d.name); render();
};
window.SITE_REMOVE = async name => {
  const c = chars.find(x => x.name === name); if(!c) return false;
  if(!confirm(EN() ? `Remove ${name} from this server?` : `Odebrat ${name} z tohoto serveru?`)) return false;
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
  bar.innerHTML = `<button type="button" class="sitebtn" id="invite">${en ? 'Invite' : 'Pozvat'}</button>${ADMIN ? `<span class="adm">admin</span>` : ''}`;
  document.getElementById('invite').onclick = () => showInvite(true);
  let crumb = document.getElementById('crumb');
  if(!crumb){ crumb = document.createElement('div'); crumb.id = 'crumb'; crumb.className = 'crumb'; document.querySelector('.top').after(crumb); }
  crumb.innerHTML = `<a href="${HOME}">Valheim Warriors</a> › ${esc(SERVER.name)} · ${chars.length} ${en ? (chars.length === 1 ? 'character' : 'characters') : (chars.length === 1 ? 'postava' : chars.length < 5 ? 'postavy' : 'postav')} <a class="bug" href="#" data-report="1">${en ? 'report a bug' : 'nahlásit chybu'}</a><a class="bug" href="${HOME}#help">${en ? 'help' : 'nápověda'}</a>`;
  const dt = document.getElementById('dropT'), ds = document.getElementById('dropS');
  if(dt) dt.textContent = en ? 'Drop your character file (.fch) here, it shows up for the whole server' : 'Přetáhni sem svou postavu (.fch), objeví se všem na serveru';
  if(ds) ds.innerHTML = en ? 'Parsed in your browser, only statistics are stored. Upload again after playing to refresh. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters' : 'Zpracuje se u tebe v prohlížeči, ukládají se jen statistiky. Po hraní nahraj znovu a list se obnoví. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters';
  const empty = document.querySelector('#sheets .empty'); if(empty) empty.textContent = en ? 'No character on this server yet. Drop a .fch file below.' : 'Na serveru ještě nikdo není. Přetáhni níže soubor .fch.';
  document.querySelectorAll('#sheets .sheet').forEach(sh => {
    const name = sh.querySelector('.name')?.textContent; const c = CHARS_BY_NAME[name]; if(!c) return;
    const pid = c.meta.player_id || c.player_id; const tok = LS.get(tokKey(pid)); const foot = sh.querySelector('.foot');
    if(tok && foot && !foot.querySelector('[data-key]')) foot.insertAdjacentHTML('beforeend', `<span class="rmlink" data-key="${esc(tok)}" style="color:var(--gold)" title="${en ? 'Copy the key for the Sync app or another browser' : 'Zkopírovat klíč pro Sync appku nebo jiný prohlížeč'}">⚿ ${en ? 'Character key' : 'Klíč postavy'}</span>`);
  });
  const dz = document.getElementById('drop');
  if(dz && !document.getElementById('appnote')){ dz.insertAdjacentHTML('afterend', `<div class="appnote" id="appnote">${en ? 'Tired of dragging? <a href="' + HOME + '#app">Sync app for Windows</a> uploads your character after every save.' : 'Nechceš přetahovat ručně? <a href="' + HOME + '#app">Sync appka pro Windows</a> nahraje postavu po každém uložení sama.'}</div>`); }
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
    <div class="tot"><div><b>${d.totals.servers}</b><span>${en ? 'servers' : 'serverů'}</span></div><div><b>${d.totals.characters}</b><span>${en ? 'characters' : 'postav'}</span></div><div><b>${d.totals.uploads_24h}</b><span>${en ? 'uploads 24 h' : 'nahrání za 24 h'}</span></div><div><b>${d.totals.db_kb >= 1024 ? (d.totals.db_kb / 1024).toFixed(1) + ' MB' : d.totals.db_kb + ' kB'}</b><span>${en ? 'database' : 'databáze'}</span></div><div><b>${bugs.filter(r => !r.done).length}</b><span>${en ? 'open bugs' : 'otevřené bugy'}</span></div><div><b>${errs.filter(r => !r.done).length}</b><span>${en ? 'open errors' : 'otevřené chyby'}</span></div></div>
    <h3>${en ? 'Servers' : 'Servery'} <small>${d.servers.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'Name' : 'Název'}</th><th>slug</th><th>${en ? 'Characters' : 'Postavy'}</th><th>${en ? 'Created' : 'Založen'}</th><th>${en ? 'Last activity' : 'Poslední aktivita'}</th><th></th></tr>
    ${d.servers.map(sv => `<tr><td><a href="${LINK(sv.slug)}">${esc(sv.name)}</a></td><td><code>${esc(sv.slug)}</code></td><td>${sv.chars}<br><small>${esc(sv.names)}</small></td><td>${fmtT(sv.created_at)}</td><td>${fmtT(sv.last_activity)}</td><td><button class="sitebtn ghost" data-del="${esc(sv.slug)}">${en ? 'delete' : 'smazat'}</button></td></tr>`).join('')}</table></div>
    <h3>${en ? 'Bug reports' : 'Nahlášené bugy a nápady'} <small>${bugs.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'When' : 'Kdy'}</th><th>${en ? 'Where' : 'Kde'}</th><th>${en ? 'Text' : 'Text'}</th><th></th></tr>${bugs.map(repRow).join('') || `<tr><td colspan="4"><i>${en ? 'nothing yet' : 'zatím nic'}</i></td></tr>`}</table></div>
    <h3>${en ? 'Errors caught on the site' : 'Chyby zachycené na webu'} <small>${errs.length}</small></h3>
    <div class="tw"><table class="adm"><tr><th>${en ? 'When' : 'Kdy'}</th><th>${en ? 'Where' : 'Kde'}</th><th>${en ? 'Error' : 'Chyba'}</th><th></th></tr>${errs.map(repRow).join('') || `<tr><td colspan="4"><i>${en ? 'nothing yet' : 'zatím nic'}</i></td></tr>`}</table></div>
    <div class="priv">${en ? 'Only you see this page (site admin key in this browser). Sync app logs stay on each PC in %APPDATA%\\ValheimWarriors\\sync.log.' : 'Tuhle stránku vidíš jen ty (admin klíč webu v tomto prohlížeči). Logy Sync appky zůstávají u každého v %APPDATA%\\ValheimWarriors\\sync.log.'}</div>
  </section>`;
  land.addEventListener('change', async ev => { const c = ev.target.closest('[data-done]'); if(!c) return; try{ await rpc('vw_admin_report_done', {p_key: key, p_id: +c.dataset.done, p_done: c.checked}); c.closest('tr').classList.toggle('done', c.checked); }catch(e){ toast(e.message); } });
  land.addEventListener('click', async ev => { const b = ev.target.closest('[data-del]'); if(!b) return; const sl = b.dataset.del; if(!confirm((en ? 'Delete server ' : 'Smazat server ') + sl + (en ? ' with all its characters?' : ' se všemi postavami?'))) return; try{ await rpc('vw_admin_delete_server', {p_key: key, p_slug: sl}); b.closest('tr').remove(); toast(en ? 'Deleted' : 'Smazáno'); }catch(e){ toast(e.message); } });
}

if(isAdminPage) adminPage(); else if(slug) server(); else landing();
})();
