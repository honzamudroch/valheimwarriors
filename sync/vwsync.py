# Valheim Warriors Sync: hlida slozku s postavami (.fch) a po kazdem ulozeni nahraje postavu na server valheimwarriors.com
# Bezi v systemove liste (tray). Nastaveni: odkaz na server, slozky, ktere postavy synchronizovat. Konfigurace v %APPDATA%\ValheimWarriors\config.json
import os, sys, json, time, threading, datetime, re, socket, webbrowser, traceback, urllib.request, urllib.error, urllib.parse, locale
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

APP = 'Valheim Warriors Sync'
VERSION = '0.1.8'
SITE = 'https://valheimwarriors.com'
DEFAULT_API = {"url": "https://sfaxumbeilroctogyzri.supabase.co", "key": "sb_publishable_jaO8rRYg_IN0xpzJ37CMHQ_EhwmQJ56"}
CFG_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'ValheimWarriors')
CFG_PATH = os.path.join(CFG_DIR, 'config.json')
LOG_PATH = os.path.join(CFG_DIR, 'sync.log')
RES = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RES)
import fchfull, items  # noqa: E402  (parser .fch, stejny jako na webu)
try:
    for _n in json.load(open(os.path.join(RES, 'item-names.json'), encoding='utf-8')):
        items.TABLE.setdefault(fchfull.sh(_n), _n)
except Exception:
    pass

T = {
  'cz': {'server': 'Odkaz na Valhalu', 'server_hint': 'Vlož odkaz své Valhaly (stránka party na valheimwarriors.com), např. https://valheimwarriors.com/s/moje-parta', 'folders': 'Složky s postavami', 'add_folder': 'Přidat složku', 'chars': 'Postavy k synchronizaci', 'col_sync': 'Sync', 'col_name': 'Postava', 'col_file': 'Soubor', 'col_status': 'Stav', 'key': 'Klíč postavy', 'key_hint': 'Normálně není potřeba: novější uložení hry postavu vždy převezme. Klíč slouží jen pro přepsání starším souborem (na webu pod listem postavy: ⚿ Klíč postavy).', 'advanced': 'Pokročilé: klíč postavy', 'find': 'Najít moje Valhaly', 'found': 'Valhaly, kde už je některá z tvých postav:', 'none_found': 'Žádnou Valhalu s tvými postavami jsem nenašel. Založ ji na valheimwarriors.com nebo si vyžádej odkaz od party.', 'help': 'Nápověda (web)', 'autostart': 'Spouštět při startu Windows', 'save': 'Uložit a spustit', 'sync_now': 'Nahrát teď', 'open': 'Otevřít Valhalu', 'settings': 'Nastavení', 'quit': 'Ukončit', 'no_server': 'Zadej odkaz na Valhalu.', 'bad_server': 'Valhala nenalezena: ', 'uploaded': 'Nahráno', 'error': 'Chyba', 'waiting': 'Čeká na změnu', 'not_uploaded': 'Zatím nenahráno', 'lang': 'English', 'owned': 'Na serveru je novější uložení této postavy z jiného zařízení. Zahraj si a nech hru uložit, appka postavu při dalším uložení převezme sama.', 'refresh': 'Obnovit seznam', 'updating': 'Stahuji novou verzi {v}, appka se za chvíli sama restartuje.', 'ok_saved': 'Nastavení uloženo, appka běží v liště u hodin.', 'title_hint': 'Po uložení se okno schová do systémové lišty. Postavy se nahrají po každém uložení hry (Valheim ukládá při odhlášení a průběžně).'},
  'en': {'server': 'Valhalla link', 'server_hint': 'Paste the link of your Valhalla (your party page on valheimwarriors.com), e.g. https://valheimwarriors.com/s/my-party', 'folders': 'Character folders', 'add_folder': 'Add folder', 'chars': 'Characters to sync', 'col_sync': 'Sync', 'col_name': 'Character', 'col_file': 'File', 'col_status': 'Status', 'key': 'Character key', 'key_hint': 'Normally not needed: a newer game save always takes the character over. The key is only for overwriting an older file (on the web under the sheet: ⚿ Character key).', 'advanced': 'Advanced: character key', 'find': 'Find my Valhallas', 'found': 'Valhallas that already have one of your characters:', 'none_found': 'No Valhalla with your characters found. Create one at valheimwarriors.com or ask your party for the link.', 'help': 'Help (web)', 'autostart': 'Start with Windows', 'save': 'Save and run', 'sync_now': 'Upload now', 'open': 'Open Valhalla', 'settings': 'Settings', 'quit': 'Quit', 'no_server': 'Enter the Valhalla link.', 'bad_server': 'Valhalla not found: ', 'uploaded': 'Uploaded', 'error': 'Error', 'waiting': 'Waiting for changes', 'not_uploaded': 'Not uploaded yet', 'lang': 'Česky', 'owned': 'The server has a newer save of this character from another device. Play and let the game save, the app takes it over on the next save automatically.', 'refresh': 'Refresh list', 'updating': 'Downloading version {v}, the app restarts itself in a moment.', 'ok_saved': 'Settings saved, the app keeps running in the tray.', 'title_hint': 'After saving the window hides to the system tray. Characters upload after every game save (Valheim saves on logout and periodically).'},
}


def log(msg):
    os.makedirs(CFG_DIR, exist_ok=True)
    line = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    try:
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass
    print(line)


def load_cfg():
    d = {"lang": 'cz' if (locale.getlocale()[0] or '').lower().startswith(('cs', 'czech')) else 'en', "slug": "", "folders": [], "chars": {}, "autostart": False, "interval": 20}
    try:
        d.update(json.load(open(CFG_PATH, encoding='utf-8')))
    except Exception:
        pass
    return d


def save_cfg(cfg):
    os.makedirs(CFG_DIR, exist_ok=True)
    json.dump(cfg, open(CFG_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def detect_folders():
    out = []
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Valve\Steam')
        steam = winreg.QueryValueEx(k, 'SteamPath')[0].replace('/', '\\')
        ud = os.path.join(steam, 'userdata')
        if os.path.isdir(ud):
            for uid in os.listdir(ud):
                p = os.path.join(ud, uid, '892970', 'remote', 'characters')
                if os.path.isdir(p):
                    out.append(p)
    except Exception:
        pass
    ll = os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'LocalLow', 'IronGate', 'Valheim')
    for sub in ('characters', 'characters_local'):
        p = os.path.join(ll, sub)
        if os.path.isdir(p) and any(f.lower().endswith('.fch') for f in os.listdir(p)):
            out.append(p)
    return out


def list_fch(folders):
    files = []
    for fo in folders:
        try:
            for f in os.listdir(fo):
                fl = f.lower()
                if fl.endswith('.fch') and '_backup_' not in fl and not fl.endswith('.old'):
                    files.append(os.path.join(fo, f))
        except Exception:
            pass
    return files


def strip(d):
    for w in d.get('worlds', []) or []:
        for k in ('pins', 'spawn', 'logout', 'death', 'home'):
            w.pop(k, None)
    wb = d.pop('world_blocks', None) or []
    if not (d.get('global_lists', {}).get('cmds')) and wb:
        d['global_lists']['cmds'] = wb[0].get('cmds', {})
    d.pop('file', None)
    return d


def parse(path):
    d = strip(fchfull.load(path))
    d['meta'] = {"saved": d.get('saved'), "app": f"vwsync/{VERSION}"}
    return d


class Api:
    def __init__(self):
        self.cfg = dict(DEFAULT_API)
        self.latest = None
        try:
            r = urllib.request.urlopen(SITE + '/app-config.json', timeout=6)
            j = json.loads(r.read().decode('utf-8'))
            if j.get('url') and j.get('key'):
                self.cfg = {"url": j['url'], "key": j['key']}
            self.latest = j.get('version')
        except Exception:
            pass

    def _req(self, method, path, body=None):
        req = urllib.request.Request(self.cfg['url'].rstrip('/') + '/rest/v1/' + path, method=method,
                                     data=json.dumps(body).encode('utf-8') if body is not None else None,
                                     headers={'apikey': self.cfg['key'], 'Authorization': 'Bearer ' + self.cfg['key'], 'Content-Type': 'application/json', 'User-Agent': f'vwsync/{VERSION}'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                t = r.read().decode('utf-8')
                return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            t = e.read().decode('utf-8', 'ignore')
            try:
                t = json.loads(t).get('message', t)
            except Exception:
                pass
            raise RuntimeError(t)

    def server(self, slug):
        r = self._req('POST', 'rpc/vw_get_server', {"p_slug": slug})
        return r[0] if r else None

    def servers_with(self, player_ids):
        if not player_ids:
            return []
        rows = self._req('POST', 'rpc/vw_find_servers', {"p_player_ids": [int(p) for p in player_ids]}) or []
        return [{"slug": r['slug'], "name": r['name'], "chars": r.get('chars') or []} for r in rows]

    def upsert(self, slug, data, token):
        return self._req('POST', 'rpc/vw_upsert_character', {"p_slug": slug, "p_data": data, "p_saved_at": data.get('saved'), "p_token": token})


def self_update(latest, notify):
    """Nova verze na webu: stahnout ZIP, rozbalit vedle, a pres davkovy skript po ukonceni appky prepsat slozku a znovu spustit."""
    import zipfile, tempfile, subprocess
    if not getattr(sys, 'frozen', False):
        return False
    appdir = os.path.dirname(sys.executable)
    if not os.access(appdir, os.W_OK):
        log('update: slozka appky neni zapisovatelna ' + appdir); return False
    try:
        notify(latest)
        tmp = tempfile.mkdtemp(prefix='vwsync-upd-')
        zpath = os.path.join(tmp, 'app.zip')
        urllib.request.urlretrieve(SITE + '/download/ValheimWarriorsSync.zip', zpath)
        with zipfile.ZipFile(zpath) as z:
            if z.testzip() is not None or 'ValheimWarriorsSync/ValheimWarriorsSync.exe' not in z.namelist():
                raise ValueError('bad zip')
            z.extractall(tmp)
        src = os.path.join(tmp, 'ValheimWarriorsSync')
        script = os.path.join(tmp, 'update.cmd')
        with open(script, 'w', encoding='cp1250', errors='replace') as f:
            f.write(f"""@echo off
:wait
ping -n 2 127.0.0.1 >nul
tasklist /FI "PID eq {os.getpid()}" 2>nul | find "{os.getpid()}" >nul && goto wait
rmdir /s /q "{os.path.join(appdir, '_internal')}"
xcopy /e /y /q /i "{src}" "{appdir}" >nul
start "" "{os.path.join(appdir, 'ValheimWarriorsSync.exe')}"
rmdir /s /q "{tmp}"
""")
        subprocess.Popen(['cmd', '/c', script], creationflags=0x00000008 | 0x00000200, close_fds=True)   # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        log(f'update: {VERSION} -> {latest}')
        return True
    except Exception as e:
        log('update: ' + repr(e)); return False


def slug_of(text):
    text = (text or '').strip()
    m = re.search(r'/s/([a-z0-9-]+)', text) or re.search(r'[?&]s=([a-z0-9-]+)', text)
    if m:
        return m.group(1)
    return text if re.fullmatch(r'[a-z0-9-]{3,40}', text) else ''


def set_autostart(on):
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Run', 0, winreg.KEY_SET_VALUE)
        if on:
            exe = sys.executable if getattr(sys, 'frozen', False) else f'"{sys.executable}" "{os.path.abspath(__file__)}"'
            winreg.SetValueEx(k, 'ValheimWarriorsSync', 0, winreg.REG_SZ, f'"{exe}"' if getattr(sys, 'frozen', False) else exe)
        else:
            try:
                winreg.DeleteValue(k, 'ValheimWarriorsSync')
            except FileNotFoundError:
                pass
    except Exception as e:
        log(f'autostart: {e}')


class Sync:
    """Hlidac: kontroluje mtime souboru, po zmene (a 5 s klidu) postavu zparsuje a nahraje."""
    def __init__(self, cfg, api, on_status):
        self.cfg, self.api, self.on_status = cfg, api, on_status
        self.seen = {}
        self.status = {}
        self.stop = threading.Event()
        self.wake = threading.Event()
        self.force = threading.Event()
        self.lock = threading.Lock()

    def run(self):
        while not self.stop.is_set():
            try:
                self.tick(force=self.force.is_set())
                self.force.clear()
            except Exception as e:
                log('tick: ' + repr(e))
            self.wake.wait(self.cfg.get('interval', 20))
            self.wake.clear()

    def tick(self, force=False):
        slug = self.cfg.get('slug')
        if not slug:
            return
        for path, c in list(self.cfg.get('chars', {}).items()):
            if not c.get('enabled') or not os.path.exists(path):
                continue
            mt = os.path.getmtime(path)
            if not force and self.seen.get(path) == mt:
                continue
            if time.time() - mt < 5:
                continue   # hra jeste zapisuje
            with self.lock:
                self.upload(path, c, mt)

    def upload(self, path, c, mt):
        try:
            d = parse(path)
            if c.get('player_id') and int(c['player_id']) != int(d['player_id']):
                c['token'] = None
            tok = self.api.upsert(self.cfg['slug'], d, c.get('token') or None)
            c['token'] = tok
            c['player_id'] = d['player_id']
            c['name'] = d['name']
            c['last'] = datetime.datetime.now().isoformat(timespec='seconds')
            self.seen[path] = mt
            save_cfg(self.cfg)
            self.status[path] = ('ok', d['name'])
            log(f"nahrano {d['name']} ({os.path.basename(path)})")
            self.on_status(path, 'ok', d['name'])
        except Exception as e:
            msg = str(e)
            if 'not allowed' in msg:
                msg = T[self.cfg['lang']]['owned']
            self.seen[path] = mt   # neopakovat dokola stejnou chybu, pockat na dalsi zmenu souboru
            self.status[path] = ('err', msg)
            log(f"chyba {os.path.basename(path)}: {msg}")
            self.on_status(path, 'err', msg)


class SettingsWin:
    def __init__(self, app):
        self.app = app
        cfg = app.cfg
        self.t = T[cfg['lang']]
        self.root = tk.Tk()
        self.root.title(f'{APP} {VERSION}')
        self.root.geometry('760x680')
        self.root.minsize(640, 560)
        self.root.configure(bg='#1f1912')
        self.root.protocol('WM_DELETE_WINDOW', self.hide)
        st = ttk.Style(self.root)
        try:
            st.theme_use('clam')
        except Exception:
            pass
        st.configure('.', background='#1f1912', foreground='#e6d5a8', fieldbackground='#0f0c08', font=('Segoe UI', 10))
        st.configure('TButton', background='#d9a441', foreground='#1a1208', font=('Segoe UI', 10, 'bold'))
        st.map('TButton', background=[('active', '#f0c060')])
        st.configure('Small.TLabel', foreground='#9a8a6a', font=('Segoe UI', 9))
        st.configure('Head.TLabel', foreground='#d9a441', font=('Georgia', 12, 'bold'))
        st.configure('Treeview', background='#0f0c08', fieldbackground='#0f0c08', foreground='#e6d5a8', rowheight=24)
        st.configure('Treeview.Heading', background='#2a2218', foreground='#d9a441')
        st.configure('TCheckbutton', background='#1f1912', foreground='#e6d5a8')
        st.configure('TEntry', foreground='#e6d5a8')
        self.build()

    def build(self):
        t, cfg, r = self.t, self.app.cfg, self.root
        for w in r.winfo_children():
            w.destroy()
        top = ttk.Frame(r, padding=14); top.pack(fill='both', expand=True)
        self.msg = ttk.Label(top, text='', style='Small.TLabel'); self.msg.pack(side='bottom', anchor='w', pady=(6, 0))
        bot = ttk.Frame(top); bot.pack(side='bottom', fill='x', pady=(12, 0))
        self.auto = tk.BooleanVar(value=bool(cfg.get('autostart')))
        ttk.Checkbutton(bot, text=t['autostart'], variable=self.auto).pack(side='left')
        ttk.Button(bot, text=t['save'], command=self.save).pack(side='right')
        ttk.Button(bot, text=t['sync_now'], command=self.app.sync_now).pack(side='right', padx=8)
        head = ttk.Frame(top); head.pack(fill='x')
        ttk.Label(head, text=APP, style='Head.TLabel').pack(side='left')
        ttk.Button(head, text=t['lang'], command=self.toggle_lang, width=10).pack(side='right')
        ttk.Button(head, text=t['help'], command=lambda: webbrowser.open(SITE + '/#help'), width=14).pack(side='right', padx=(0, 6))
        lat = getattr(self.app.api, 'latest', None)
        if lat and tuple(int(x) for x in lat.split('.')) > tuple(int(x) for x in VERSION.split('.')):
            ttk.Button(head, text=(('Nová verze ' if self.t is T['cz'] else 'New version ') + lat), command=lambda: webbrowser.open(SITE + '/#app'), width=18).pack(side='right', padx=(0, 6))
        ttk.Label(top, text=t['title_hint'], style='Small.TLabel', wraplength=680).pack(anchor='w', pady=(2, 10))

        ttk.Label(top, text=t['server']).pack(anchor='w')
        self.server = tk.StringVar(value=(SITE + '/s/' + cfg['slug']) if cfg.get('slug') else '')
        sf = ttk.Frame(top); sf.pack(fill='x')
        ttk.Entry(sf, textvariable=self.server).pack(side='left', fill='x', expand=True)
        ttk.Button(sf, text=t['find'], command=self.find_servers).pack(side='left', padx=(6, 0))
        self.found = ttk.Frame(top); self.found.pack(fill='x')
        ttk.Label(top, text=t['server_hint'], style='Small.TLabel').pack(anchor='w', pady=(0, 8))

        ttk.Label(top, text=t['folders']).pack(anchor='w')
        fr = ttk.Frame(top); fr.pack(fill='x')
        self.folders = list(cfg.get('folders') or detect_folders())
        self.folder_list = tk.Listbox(fr, height=min(3, max(1, len(self.folders))), bg='#0f0c08', fg='#c9b88a', highlightthickness=0, relief='flat')
        for f in self.folders:
            self.folder_list.insert('end', f)
        self.folder_list.pack(side='left', fill='x', expand=True)
        bf = ttk.Frame(fr); bf.pack(side='left', padx=(6, 0))
        ttk.Button(bf, text=t['add_folder'], command=self.add_folder).pack(fill='x')
        ttk.Button(bf, text=t['refresh'], command=self.refresh_chars).pack(fill='x', pady=(4, 0))

        ttk.Label(top, text=t['chars']).pack(anchor='w', pady=(10, 0))
        self.tree = ttk.Treeview(top, columns=('sync', 'name', 'file', 'status'), show='headings', height=6, selectmode='browse')
        for c, w, txt in (('sync', 50, t['col_sync']), ('name', 150, t['col_name']), ('file', 220, t['col_file']), ('status', 320, t['col_status'])):
            self.tree.heading(c, text=txt); self.tree.column(c, width=w, anchor='w' if c != 'sync' else 'center')
        self.tree.pack(fill='both', expand=True)
        self.tree.bind('<Button-1>', self.on_tree_click)
        self.tree.bind('<<TreeviewSelect>>', self.on_select)

        self.adv_open = tk.BooleanVar(value=False)
        advb = ttk.Checkbutton(top, text=t['advanced'], variable=self.adv_open, command=self.toggle_adv); advb.pack(anchor='w', pady=(6, 0))
        self.adv = ttk.Frame(top)
        kf = ttk.Frame(self.adv); kf.pack(fill='x', pady=(2, 0))
        ttk.Label(kf, text=t['key']).pack(side='left')
        self.key = tk.StringVar()
        self.key_entry = ttk.Entry(kf, textvariable=self.key, width=44); self.key_entry.pack(side='left', padx=8)
        self.key.trace_add('write', self.on_key)
        ttk.Label(self.adv, text=t['key_hint'], style='Small.TLabel', wraplength=680).pack(anchor='w')

        self.refresh_chars()

    def toggle_adv(self):
        if self.adv_open.get():
            self.adv.pack(fill='x', after=self.adv.master.winfo_children()[-3] if False else None)
        else:
            self.adv.pack_forget()

    def toggle_lang(self):
        self.app.cfg['lang'] = 'en' if self.app.cfg['lang'] == 'cz' else 'cz'
        self.t = T[self.app.cfg['lang']]
        save_cfg(self.app.cfg)
        self.build()

    def find_servers(self):
        for w in self.found.winfo_children():
            w.destroy()
        pids = []
        for path in list_fch(self.folders):
            c = self.app.cfg.setdefault('chars', {}).setdefault(path, {"enabled": False})
            if not c.get('player_id'):
                try:
                    d = fchfull.load(path); c['player_id'] = d['player_id']; c['name'] = d['name']
                except Exception:
                    continue
            pids.append(c['player_id'])
        try:
            res = self.app.api.servers_with(pids)
        except Exception as e:
            res = []; self.msg.configure(text=str(e))
        if not res:
            ttk.Label(self.found, text=self.t['none_found'], style='Small.TLabel', wraplength=680).pack(anchor='w'); return
        ttk.Label(self.found, text=self.t['found'], style='Small.TLabel').pack(anchor='w', pady=(4, 0))
        for r in res:
            ttk.Button(self.found, text=f"{r['name']}  ·  {', '.join(r['chars'])}", command=lambda sl=r['slug']: self.server.set(SITE + '/s/' + sl)).pack(anchor='w', pady=1)

    def add_folder(self):
        d = filedialog.askdirectory(parent=self.root)
        if d:
            d = d.replace('/', '\\')
            if d not in self.folders:
                self.folders.append(d); self.folder_list.insert('end', d)
            self.refresh_chars()

    def refresh_chars(self):
        cfg = self.app.cfg
        for i in self.tree.get_children():
            self.tree.delete(i)
        self.rows = {}
        for path in list_fch(self.folders):
            c = cfg.setdefault('chars', {}).setdefault(path, {"enabled": False})
            if not c.get('name'):
                try:
                    c['name'] = fchfull.load(path)['name']
                except Exception:
                    try:
                        import struct
                        ver = struct.unpack_from('<i', open(path, 'rb').read(8), 4)[0]
                        c['name'] = f'? (v{ver}, ' + ('starší formát' if self.t is T['cz'] else 'old format') + ')'
                    except Exception:
                        c['name'] = '?'
            stt = self.app.sync.status.get(path)
            status = (self.t['uploaded'] + ' ' + (c.get('last') or '')[11:16]) if stt and stt[0] == 'ok' else (self.t['error'] + ': ' + stt[1][:110]) if stt else (self.t['waiting'] if c.get('last') else self.t['not_uploaded'])
            iid = self.tree.insert('', 'end', values=('☑' if c.get('enabled') else '☐', c.get('name', '?'), os.path.basename(path), status))
            self.rows[iid] = path

    def on_tree_click(self, ev):
        if self.tree.identify_column(ev.x) != '#1':
            return
        iid = self.tree.identify_row(ev.y)
        if not iid:
            return
        path = self.rows[iid]; c = self.app.cfg['chars'][path]
        c['enabled'] = not c.get('enabled')
        self.tree.set(iid, 'sync', '☑' if c['enabled'] else '☐')

    def on_select(self, ev=None):
        sel = self.tree.selection()
        if not sel:
            return
        c = self.app.cfg['chars'][self.rows[sel[0]]]
        self.key.set(c.get('token') or '')

    def on_key(self, *a):
        sel = self.tree.selection()
        if not sel:
            return
        c = self.app.cfg['chars'][self.rows[sel[0]]]
        v = self.key.get().strip()
        if v != (c.get('token') or ''):
            c['token'] = v or None; save_cfg(self.app.cfg)
            if v: self.msg.configure(text=('Klíč uložen pro ' if self.t is T['cz'] else 'Key saved for ') + str(c.get('name', '?')))

    def save(self):
        cfg = self.app.cfg
        slug = slug_of(self.server.get())
        if not slug:
            messagebox.showwarning(APP, self.t['no_server'], parent=self.root); return
        try:
            srv = self.app.api.server(slug)
        except Exception as e:
            srv = None; err = str(e)
        else:
            err = slug
        if not srv:
            messagebox.showwarning(APP, self.t['bad_server'] + err, parent=self.root); return
        cfg['slug'] = slug; cfg['server_name'] = srv.get('name'); cfg['folders'] = self.folders; cfg['autostart'] = bool(self.auto.get())
        set_autostart(cfg['autostart'])
        save_cfg(cfg)
        self.msg.configure(text=self.t['ok_saved'])
        self.app.sync_now()
        self.root.after(1200, self.hide)

    def hide(self):
        self.root.withdraw()

    def show(self):
        self.refresh_chars()
        self.root.deiconify(); self.root.lift(); self.root.focus_force()


class App:
    def __init__(self):
        self.cfg = load_cfg()
        self.api = Api()
        self.sync = Sync(self.cfg, self.api, self.on_status)
        self.win = SettingsWin(self)
        self.icon = None
        threading.Thread(target=self.sync.run, daemon=True).start()
        self.start_tray()
        if not self.cfg.get('slug'):
            self.win.show()
        else:
            self.win.hide()
        lat = self.api.latest
        if lat and getattr(sys, 'frozen', False) and tuple(int(x) for x in lat.split('.') if x.isdigit()) > tuple(int(x) for x in VERSION.split('.')):
            threading.Thread(target=self.auto_update, args=(lat,), daemon=True).start()

    def auto_update(self, lat):
        def notify(v):
            try:
                self.icon.notify(T[self.cfg['lang']]['updating'].format(v=v), APP)
            except Exception:
                pass
        if self_update(lat, notify):
            self.win.root.after(0, self.quit)

    def on_status(self, path, kind, msg):
        try:
            self.win.root.after(0, self.win.refresh_chars)
        except Exception:
            pass
        if self.icon:
            t = T[self.cfg['lang']]
            try:
                self.icon.notify((t['uploaded'] + ': ' + msg) if kind == 'ok' else (t['error'] + ': ' + msg[:120]), APP)
            except Exception:
                pass

    def sync_now(self):
        self.sync.force.set()
        self.sync.wake.set()

    def start_tray(self):
        try:
            import pystray
            from PIL import Image, ImageDraw
        except Exception as e:
            log('tray: ' + repr(e)); return
        img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.polygon([(32, 4), (58, 14), (54, 40), (32, 60), (10, 40), (6, 14)], fill=(31, 25, 18, 255), outline=(217, 164, 65, 255), width=3)
        d.polygon([(32, 14), (48, 22), (45, 38), (32, 50), (19, 38), (16, 22)], fill=(217, 164, 65, 255))
        t = T[self.cfg['lang']]
        menu = pystray.Menu(
            pystray.MenuItem(t['settings'], lambda: self.win.root.after(0, self.win.show), default=True),
            pystray.MenuItem(t['sync_now'], lambda: self.sync_now()),
            pystray.MenuItem(t['open'], lambda: webbrowser.open(SITE + '/s/' + self.cfg['slug']) if self.cfg.get('slug') else None),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(t['quit'], self.quit))
        self.icon = pystray.Icon('vwsync', img, APP, menu)
        threading.Thread(target=self.icon.run, daemon=True).start()

    def quit(self):
        self.sync.stop.set(); self.sync.wake.set()
        try:
            self.icon.stop()
        except Exception:
            pass
        self.win.root.after(0, self.win.root.destroy)

    def run(self):
        self.win.root.mainloop()


def single_instance():
    """Jedina instance: kdyz uz appka bezi, druhe spusteni ji jen rekne, aby ukazala okno, a skonci."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', 47311)); s.listen(2); return s
    except OSError:
        try:
            c = socket.create_connection(('127.0.0.1', 47311), timeout=2); c.sendall(b'ver'); c.settimeout(2)
            other = c.recv(32).decode('ascii', 'ignore').strip(); c.close()
        except Exception:
            other = ''
        if other and tuple(int(x) for x in other.split('.') if x.isdigit()) < tuple(int(x) for x in VERSION.split('.')):
            try:   # bezi starsi verze: ukoncit ji a prevzit
                c = socket.create_connection(('127.0.0.1', 47311), timeout=2); c.sendall(b'quit'); c.close()
            except Exception:
                pass
            for _ in range(20):
                time.sleep(0.3)
                try:
                    s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s2.bind(('127.0.0.1', 47311)); s2.listen(2); return s2
                except OSError:
                    continue
            return None
        try:
            c = socket.create_connection(('127.0.0.1', 47311), timeout=2); c.sendall(b'show'); c.close()
        except Exception:
            pass
        return None


def serve_show(lock, app):
    while True:
        try:
            c, _ = lock.accept(); c.settimeout(2)
            cmd = c.recv(16)
            if cmd.startswith(b'show'):
                app.win.root.after(0, app.win.show)
            elif cmd.startswith(b'ver'):
                c.sendall(VERSION.encode('ascii'))
            elif cmd.startswith(b'quit'):
                c.close(); app.win.root.after(0, app.quit); return
            c.close()
        except Exception:
            time.sleep(0.5)


if __name__ == '__main__':
    lock = single_instance()
    if not lock:
        sys.exit(0)
    try:
        app = App()
        threading.Thread(target=serve_show, args=(lock, app), daemon=True).start()
        app.run()
    except Exception:
        log(traceback.format_exc())
        raise
