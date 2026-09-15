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
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--gold);color:var(--ink);padding:8px 14px;font-size:13px;z-index:1000;box-shadow:0 6px 18px var(--shadow)}
`;
document.head.appendChild(style);

function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function mine(){ try { return JSON.parse(LS.get('vw-servers') || '[]'); } catch(e) { return []; } }
function rememberServer(s, name, admin){ const l = mine().filter(x => x.slug !== s); l.unshift({slug: s, name, admin: !!admin}); LS.set('vw-servers', JSON.stringify(l.slice(0, 20))); }

/* ---------- uvodni stranka ---------- */
function landing(){
  const land = document.getElementById('landing'); land.hidden = false;
  document.getElementById('drop').hidden = true; document.getElementById('sheets').hidden = true; document.getElementById('who').style.display = 'none';
  document.getElementById('h1').textContent = 'Valheim Warriors'; document.title = 'Valheim Warriors';
  const en = EN(); const my = mine();
  land.innerHTML = `<section class="land"><div class="hero">
    <h2>${en ? 'One page for your whole Valheim party' : 'Jedna stránka pro celou vaši valheimskou partu'}</h2>
    <p>${en ? 'Create a server, send the link to your crew. Everyone drops in their character file and you all see each other side by side: gear, skills, kills, deaths, travel, work. Straight from the save file, updated whenever someone uploads again.' : 'Založ server, pošli partě odkaz. Každý přetáhne soubor své postavy a vidíte se všichni vedle sebe: výbava, dovednosti, zabití, smrti, cesta, práce. Přímo ze save souboru, aktuální vždy, když někdo nahraje znovu.'}</p>
    <form id="newsrv"><input id="srvname" maxlength="60" required placeholder="${en ? 'Server or party name' : 'Název serveru nebo party'}" autocomplete="off"><button type="submit">${en ? 'Create server' : 'Založit server'}</button></form>
    <div class="err" id="srverr"></div>
    <div class="steps">
      <div class="step"><b>1 · ${en ? 'Create' : 'Založ'}</b>${en ? 'You get a link and an admin link. Keep the admin one to yourself.' : 'Dostaneš odkaz pro partu a admin odkaz. Ten si nech pro sebe.'}</div>
      <div class="step"><b>2 · ${en ? 'Share' : 'Pošli'}</b>${en ? 'Everyone opens the link and drops their .fch file from' : 'Každý otevře odkaz a přetáhne svůj .fch soubor z'} <code style="font-size:11px">Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters</code></div>
      <div class="step"><b>3 · ${en ? 'Compare' : 'Porovnej'}</b>${en ? 'Upload again after a session and the sheet updates. Only you (or the admin) can replace your character.' : 'Po hraní nahraj znovu a list se přepíše. Tvoji postavu může přepsat jen ty (nebo admin).'}</div>
    </div>
    ${my.length ? `<div class="mine"><h3>${en ? 'My servers' : 'Moje servery'}</h3><ul style="margin:0;padding-left:18px">${my.map(s => `<li><a href="${LINK(s.slug)}">${esc(s.name)}</a>${s.admin ? `<small>admin</small>` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="priv">${en ? 'The file is parsed in your browser. Only statistics go to the server: no map pins, no positions, no boss altars. Nothing you have not reached yet is shown.' : 'Soubor se zpracuje u tebe v prohlížeči. Na server jdou jen statistiky: žádné pins, žádné pozice, žádné oltáře bossů. Nic, kam jste ještě nedošli.'}</div>
  </div></section>`;
  document.getElementById('newsrv').addEventListener('submit', async ev => {
    ev.preventDefault(); const err = document.getElementById('srverr'); err.textContent = '';
    const name = document.getElementById('srvname').value.trim(); if(name.length < 2) return;
    try{
      const [res] = await rpc('vw_create_server', {p_name: name});
      LS.set('vw-admin-' + res.slug, res.admin_token); rememberServer(res.slug, name, true);
      location.href = LINK(res.slug) + '#new';
    }catch(e){ err.textContent = (en ? 'Could not create server: ' : 'Server se nepodařilo založit: ') + e.message; }
  });
}

/* ---------- stranka serveru ---------- */
async function server(){
  const hm = location.hash.match(/admin=([A-Za-z0-9]+)/);
  if(hm){ LS.set('vw-admin-' + slug, hm[1]); history.replaceState(null, '', location.pathname + location.search); }
  const isNew = location.hash === '#new'; if(isNew) history.replaceState(null, '', location.pathname + location.search);
  ADMIN = LS.get('vw-admin-' + slug);
  let srv, rows;
  try{ [srv, rows] = await Promise.all([get('servers_public?slug=eq.' + encodeURIComponent(slug)), get('characters_public?slug=eq.' + encodeURIComponent(slug) + '&order=name')]); }
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

window.SITE_UPLOAD = async d => {
  if(!SERVER) throw new Error(EN() ? 'no server' : 'není server');
  const tok = ADMIN || LS.get(tokKey(d.player_id));
  const t = await rpc('vw_upsert_character', {p_slug: slug, p_data: d, p_saved_at: d.meta.saved || null, p_token: tok});
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
  if(!SERVER) return;
  const en = EN();
  document.getElementById('h1').textContent = SERVER.name; document.title = SERVER.name + ' · Valheim Warriors';
  let bar = document.getElementById('sitebar');
  if(!bar){ bar = document.createElement('div'); bar.id = 'sitebar'; bar.className = 'sitebar'; document.querySelector('.top > div').prepend(bar); }
  bar.innerHTML = `<button type="button" class="sitebtn" id="invite">${en ? 'Invite' : 'Pozvat'}</button>${ADMIN ? `<span class="adm">admin</span>` : ''}`;
  document.getElementById('invite').onclick = () => showInvite(true);
  let crumb = document.getElementById('crumb');
  if(!crumb){ crumb = document.createElement('div'); crumb.id = 'crumb'; crumb.className = 'crumb'; document.querySelector('.top').after(crumb); }
  crumb.innerHTML = `<a href="${HOME}">Valheim Warriors</a> › ${esc(SERVER.name)} · ${chars.length} ${en ? (chars.length === 1 ? 'character' : 'characters') : (chars.length === 1 ? 'postava' : chars.length < 5 ? 'postavy' : 'postav')}`;
  const dt = document.getElementById('dropT'), ds = document.getElementById('dropS');
  if(dt) dt.textContent = en ? 'Drop your character file (.fch) here, it shows up for the whole server' : 'Přetáhni sem svou postavu (.fch), objeví se všem na serveru';
  if(ds) ds.innerHTML = en ? 'Parsed in your browser, only statistics are stored. Upload again after playing to refresh. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters' : 'Zpracuje se u tebe v prohlížeči, ukládají se jen statistiky. Po hraní nahraj znovu a list se obnoví. Steam: Program Files (x86)\\Steam\\userdata\\&lt;id&gt;\\892970\\remote\\characters';
  const empty = document.querySelector('#sheets .empty'); if(empty) empty.textContent = en ? 'No character on this server yet. Drop a .fch file below.' : 'Na serveru ještě nikdo není. Přetáhni níže soubor .fch.';
};

if(slug) server(); else landing();
})();
