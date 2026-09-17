# Valheim 1.0 (.fch verze 46) -> JSON s kompletnim profilem postavy
# pouziti: python fchfull.py <soubor.fch> [vystup.json]
import struct, gzip, json, sys, datetime
from zdo import R, sh
from items import iname, TABLE
for n in "ArmorBerserkerChest ArmorBerserkerLegs HelmetBerserkerHood TrinketIronHealth TrinketBronzeHealth TrinketBronzeStamina ShieldIronBuckler ShieldBoneTower FistweaponBjorn".split():
    TABLE[sh(n)] = n
import os
_ic = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'valheim-icons.json')
if os.path.exists(_ic):
    for n in json.load(open(_ic, encoding='utf-8'))['icons']:
        TABLE.setdefault(sh(n), n)
STATS = "Deaths CraftsOrUpgrades Builds Jumps Cheats EnemyHits EnemyKills EnemyKillsLastHits PlayerHits PlayerKills HitsTakenEnemies HitsTakenPlayers ItemsPickedUp Crafts Upgrades PortalsUsed DistanceTraveled DistanceWalk DistanceRun DistanceSail DistanceAir TimeInBase TimeOutOfBase Sleep ItemStandUses ArmorStandUses WorldLoads TreeChops Tree TreeTier0 TreeTier1 TreeTier2 TreeTier3 TreeTier4 TreeTier5 LogChops Logs MineHits Mines MineTier0 MineTier1 MineTier2 MineTier3 MineTier4 MineTier5 RavenHits RavenTalk RavenAppear CreatureTamed FoodEaten SkeletonSummons ArrowsShot TombstonesOpenedOwn TombstonesOpenedOther TombstonesFit DeathByUndefined DeathByEnemyHit DeathByPlayerHit DeathByFall DeathByDrowning DeathByBurning DeathByFreezing DeathByPoisoned DeathBySmoke DeathByWater DeathByEdgeOfWorld DeathByImpact DeathByCart DeathByTree DeathBySelf DeathByStructural DeathByTurret DeathByBoat DeathByStalagtite DoorsOpened DoorsClosed BeesHarvested SapHarvested TurretAmmoAdded TurretTrophySet TrapArmed TrapTriggered PlaceStacks PortalDungeonIn PortalDungeonOut BossKills BossLastHits".split()
SK = {1: 'Swords', 2: 'Knives', 3: 'Clubs', 4: 'Polearms', 5: 'Spears', 6: 'Blocking', 7: 'Axes', 8: 'Bows', 9: 'ElementalMagic', 10: 'BloodMagic', 11: 'Unarmed', 12: 'Pickaxes', 13: 'WoodCutting', 14: 'Crossbows', 100: 'Jump', 101: 'Sneak', 102: 'Run', 103: 'Swim', 104: 'Fishing', 105: 'Cooking', 106: 'Farming', 107: 'Crafting', 108: 'Ride', 110: 'Tending'}


def dct(r):
    k = r.i32()
    return {r.str(): r.f32() for _ in range(k)}


def statblock(r, n):
    names = STATS + [f"unk{i}" for i in range(len(STATS), n)]
    return dict(zip(names, [r.f32() for _ in range(n)]))


def lists(r):
    out = {}
    out['mods'] = dct(r)
    out['cmds'] = dct(r)
    x = r.i32()
    subs = [dct(r) for _ in range(x)]
    out['kills'] = subs[0] if subs else {}
    out['picked'] = dct(r)
    out['crafted'] = dct(r)
    out['gathered'] = dct(r)
    out['eaten'] = dct(r)
    out['built'] = dct(r)
    return out


def parse_inv(r):
    r.i32()
    cnt = r.u16()
    items = []
    for _ in range(cnt):
        dur = r.i32(); gx = r.u8(); gy = r.u8(); r.u8(); fl = r.u8()
        q = 1; stack = 1; cr = None
        if fl & 0x04:
            q = r.u8(); r.u8()
        if fl & 0x08:
            stack = r.u16()
        if fl & 0x10:
            r.i32()   # varianta (barva stitu apod.)
        if fl & 0x20:
            r.i64(); cr = r.str()
        h = r.u32() if fl & 0x40 else None
        r.u8()
        if fl & 0x80:
            for _ in range(r.u8()):
                r.str(); r.str()
        items.append(dict(name=iname(h) if h is not None else '?', stack=stack, dur=dur / 100, q=q, x=gx, y=gy, equipped=bool(fl & 0x02), crafter=cr or None))
    return items


def load(path):
    d = open(path, 'rb').read()
    r = R(d)
    n = r.i32()
    body = d[4:4 + n]
    ver = r.i32(); ns = r.i32(); hdr = r.i32()
    gstats = statblock(r, ns - 1)
    g = {}
    g['_d0'] = dct(r)
    g['worlds_time'] = dct(r)
    g.update(lists(r))
    per = []
    end = len(body)
    # bloky per-svet: cteme, dokud to vypada jako blok (statistiky + slovniky); prazdne sablony zahodime
    while True:
        save = r.o
        try:
            st = statblock(r, ns - 1)
            if any(abs(v) > 1e9 for v in st.values()):
                raise ValueError
            r.i32(); r.i32()
            L = lists(r)
            r.i32(); r.i32(); r.i32()
        except Exception:
            r.o = save
            break
        if any(st.values()):
            per.append(dict(stats=st, **L))
    for q in range(end - 8, 0, -1):
        if struct.unpack_from('<i', body, q)[0] == end - q - 4 and body[q - 1] == 1 and body[q - 10] == 0 and body[q - 11] == 0:
            break
    pdstart = q + 4
    e = q - 19
    for L in range(1, 64):
        if body[e - L - 1] == L:
            name = body[e - L:e].decode()
            break
    rr = R(body, e)
    pid = rr.i64(); rr.str(); rr.u8(); created = rr.i64()
    worlds = []
    nm_off = e - L - 1
    # svety jdou za sebou, kazdy konci gzip mapou; hledame od jmena zpet, dokud bloky navazuji (hrac mohl navstivit vic svetu)
    wend = nm_off
    q2 = wend - 4
    while q2 > 20000 and len(worlds) < 12:
        q2 -= 1
        if struct.unpack_from('<i', body, q2)[0] == wend - (q2 + 4) and body[q2 + 4:q2 + 6] == b'\x1f\x8b':
            gl = wend - (q2 + 4)
            wr = R(body, q2 - 4 - 4 - 1 - 12 - 12 - 1 - 12 - 1 - 12 - 1 - 8)
            uid = wr.i64(); hs = wr.u8(); sp = [wr.f32() for _ in range(3)]; hl = wr.u8(); lo = [wr.f32() for _ in range(3)]
            hd = wr.u8(); de = [wr.f32() for _ in range(3)]; hp = [wr.f32() for _ in range(3)]; wr.u8(); wr.i32(); wr.i32(); wr.i32()
            raw = gzip.decompress(body[q2 + 4:q2 + 4 + gl])
            m = R(raw)
            ts = m.i32()
            ex = raw[m.o:m.o + ts * ts]; m.o += ts * ts
            oth = raw[m.o:m.o + ts * ts]; m.o += ts * ts
            npin = m.i32()
            pins = []
            for _ in range(npin):
                pn = m.str(); pp = [m.f32() for _ in range(3)]; pt = m.i32(); pc = m.u8(); po = m.i64(); pa = m.str()
                pins.append(dict(name=pn, pos=pp, type=pt, checked=bool(pc), owner=po, author=pa))
            S = 128
            f = ts // S
            grid = []
            for gy in range(S):
                row = []
                for gx in range(S):
                    c = 0; c2 = 0
                    for yy in range(gy * f, gy * f + f, 4):
                        base = yy * ts + gx * f
                        c += ex[base:base + f:4].count(1)
                        c2 += oth[base:base + f:4].count(1)
                    row.append(2 if c else (1 if c2 else 0))
                grid.append(''.join(str(v) for v in row))   # radek jako text '0120…', 3x mensi nez pole cisel
            px = (20000 / ts) ** 2 / 1e6
            worlds.append(dict(uid=uid, spawn=sp if hs else None, logout=lo if hl else None, death=de if hd else None, home=hp,
                               explored_km2=round(ex.count(1) * px, 2), others_km2=round(oth.count(1) * px, 2), grid=grid, pins=pins))
            wend = q2 - 68
            q2 = wend - 3
    worlds.sort(key=lambda w: -(w['explored_km2'] + w['others_km2']))   # hlavni svet = nejvic prozkoumany
    p = R(body, pdstart)
    p.i32(); maxhp = p.f32(); p.f32(); maxst = p.f32(); tsd = p.f32(); gp = p.str(); p.f32()
    inv = parse_inv(p)

    def strs():
        return [p.str() for _ in range(p.i32())]
    recipes = strs()
    stations = {p.str(): p.i32() for _ in range(p.i32())}
    materials = strs(); tutorials = strs(); uniques = strs(); trophies = strs(); biomes = strs()
    texts = {p.str(): p.str() for _ in range(p.i32())}
    beard = p.str(); hair = p.str(); skin = [p.f32() for _ in range(3)]; haircol = [p.f32() for _ in range(3)]; model = p.i32()
    foods = [(p.str(), p.f32()) for _ in range(p.i32())]
    p.i32()
    sc = p.i32()
    skills = {}
    for _ in range(sc):
        k = p.i32(); lv = p.f32(); acc = p.f32()
        skills[SK.get(k, str(k))] = dict(level=round(lv, 2), progress=round(acc, 3))
    created_iso = datetime.datetime.fromtimestamp(created, datetime.timezone.utc).isoformat() if 10 ** 9 < created < 10 ** 10 else None
    saved_iso = datetime.datetime.fromtimestamp(os.path.getmtime(path)).astimezone().isoformat(timespec='minutes')
    return dict(file=path, saved=saved_iso, version=ver, name=name, player_id=pid, created=created_iso,
                global_stats=gstats, worlds_time=g['worlds_time'],
                global_lists={k: g[k] for k in ('mods', 'cmds', 'kills', 'picked', 'crafted', 'gathered', 'eaten', 'built')},
                world_blocks=per, worlds=worlds,
                player=dict(max_hp=maxhp, max_stamina=maxst, time_since_death=tsd, guardian_power=gp, inventory=inv,
                            recipes=len(recipes), stations=stations, materials=len(materials), tutorials=len(tutorials),
                            uniques=uniques, trophies=trophies, biomes=biomes, texts=len(texts), beard=beard, hair=hair,
                            skin=skin, hair_color=haircol, model=model, foods=foods, skills=skills))


if __name__ == '__main__':
    out = load(sys.argv[1])
    dst = sys.argv[2] if len(sys.argv) > 2 else out['name'].lower() + '.json'
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    s = out['global_stats']
    w = out['worlds'][0] if out['worlds'] else {}
    print(f"{out['name']} pid {out['player_id']} created {out['created']} | deaths {s['Deaths']:.0f} kills {s['EnemyKills']:.0f} km {s['DistanceTraveled']/1000:.0f} | inv {len(out['player']['inventory'])} skills {len(out['player']['skills'])} | explored {w.get('explored_km2')} km2, pins {len(w.get('pins', []))} | -> {dst}")
