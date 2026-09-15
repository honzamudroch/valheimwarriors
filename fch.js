// Valheim 1.0 .fch (verze 46) -> JSON, port fchfull.py do JavaScriptu (prohlizec i Node)
// pouziti: const data = await parseFch(arrayBuffer, itemNames)
(function (root) {
  'use strict';

  const STATS = "Deaths CraftsOrUpgrades Builds Jumps Cheats EnemyHits EnemyKills EnemyKillsLastHits PlayerHits PlayerKills HitsTakenEnemies HitsTakenPlayers ItemsPickedUp Crafts Upgrades PortalsUsed DistanceTraveled DistanceWalk DistanceRun DistanceSail DistanceAir TimeInBase TimeOutOfBase Sleep ItemStandUses ArmorStandUses WorldLoads TreeChops Tree TreeTier0 TreeTier1 TreeTier2 TreeTier3 TreeTier4 TreeTier5 LogChops Logs MineHits Mines MineTier0 MineTier1 MineTier2 MineTier3 MineTier4 MineTier5 RavenHits RavenTalk RavenAppear CreatureTamed FoodEaten SkeletonSummons ArrowsShot TombstonesOpenedOwn TombstonesOpenedOther TombstonesFit DeathByUndefined DeathByEnemyHit DeathByPlayerHit DeathByFall DeathByDrowning DeathByBurning DeathByFreezing DeathByPoisoned DeathBySmoke DeathByWater DeathByEdgeOfWorld DeathByImpact DeathByCart DeathByTree DeathBySelf DeathByStructural DeathByTurret DeathByBoat DeathByStalagtite DoorsOpened DoorsClosed BeesHarvested SapHarvested TurretAmmoAdded TurretTrophySet TrapArmed TrapTriggered PlaceStacks PortalDungeonIn PortalDungeonOut BossKills BossLastHits".split(' ');
  const SK = { 1: 'Swords', 2: 'Knives', 3: 'Clubs', 4: 'Polearms', 5: 'Spears', 6: 'Blocking', 7: 'Axes', 8: 'Bows', 9: 'ElementalMagic', 10: 'BloodMagic', 11: 'Unarmed', 12: 'Pickaxes', 13: 'WoodCutting', 14: 'Crossbows', 100: 'Jump', 101: 'Sneak', 102: 'Run', 103: 'Swim', 104: 'Fishing', 105: 'Cooking', 106: 'Farming', 107: 'Crafting', 108: 'Ride', 110: 'Tending' };

  // Valheim stable hash (stejny jako zdo.py)
  function sh(s) {
    let n1 = 5381, n2 = 5381, i = 0;
    while (i < s.length) {
      n1 = (((n1 << 5) + n1) ^ s.charCodeAt(i)) >>> 0;
      if (i + 1 >= s.length) break;
      n2 = (((n2 << 5) + n2) ^ s.charCodeAt(i + 1)) >>> 0;
      i += 2;
    }
    // (n1 + n2*1566083941) & 0xFFFFFFFF, bez ztraty presnosti
    const prod = (BigInt(n2) * 1566083941n) & 0xFFFFFFFFn;
    return Number((BigInt(n1) + prod) & 0xFFFFFFFFn);
  }

  const td = new TextDecoder('utf-8');
  class R {
    constructor(u8, o = 0) { this.u = u8; this.dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.o = o; }
    chk(n) { if (this.o + n > this.u.length) throw new RangeError('eof'); }
    u8() { this.chk(1); return this.u[this.o++]; }
    u16() { this.chk(2); const v = this.dv.getUint16(this.o, true); this.o += 2; return v; }
    i32() { this.chk(4); const v = this.dv.getInt32(this.o, true); this.o += 4; return v; }
    u32() { this.chk(4); const v = this.dv.getUint32(this.o, true); this.o += 4; return v; }
    i64() { this.chk(8); const v = this.dv.getBigInt64(this.o, true); this.o += 8; return Number(v); }
    f32() { this.chk(4); const v = this.dv.getFloat32(this.o, true); this.o += 4; return v; }
    v7() { let n = 0, k = 0; for (;;) { const b = this.u8(); n |= (b & 0x7F) << k; if (!(b & 0x80)) return n; k += 7; } }
    str() { const n = this.v7(); this.chk(n); const s = td.decode(this.u.subarray(this.o, this.o + n)); this.o += n; return s; }
  }

  const dct = r => { const k = r.i32(); if (k < 0 || k > 100000) throw new RangeError('dict'); const o = {}; for (let i = 0; i < k; i++) { const key = r.str(); o[key] = r.f32(); } return o; };
  const statblock = (r, n) => { const o = {}; for (let i = 0; i < n; i++) o[i < STATS.length ? STATS[i] : 'unk' + i] = r.f32(); return o; };
  const lists = r => { const out = {}; out.mods = dct(r); out.cmds = dct(r); const x = r.i32(); if (x < 0 || x > 50) throw new RangeError('subs'); const subs = []; for (let i = 0; i < x; i++) subs.push(dct(r)); out.kills = subs[0] || {}; out.picked = dct(r); out.crafted = dct(r); out.gathered = dct(r); out.eaten = dct(r); out.built = dct(r); return out; };

  function parseInv(r, nameOf) {
    r.i32(); const cnt = r.u16(); const items = [];
    for (let i = 0; i < cnt; i++) {
      const dur = r.i32(), gx = r.u8(), gy = r.u8(); r.u8(); const fl = r.u8();
      let q = 1, stack = 1, cr = null;
      if (fl & 0x04) { q = r.u8(); r.u8(); }
      if (fl & 0x08) stack = r.u16();
      if (fl & 0x20) { r.i64(); cr = r.str(); }
      const h = (fl & 0x40) ? r.u32() : null;
      r.u8();
      if (fl & 0x80) { const c = r.u8(); for (let k = 0; k < c; k++) { r.str(); r.str(); } }
      items.push({ name: h == null ? '?' : nameOf(h), stack, dur: dur / 100, q, x: gx, y: gy, equipped: !!(fl & 0x02), crafter: cr || null });
    }
    return items;
  }

  async function gunzip(u8) {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const stream = new Blob([u8]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    // Node fallback
    const zlib = require('zlib');
    return new Uint8Array(zlib.gunzipSync(Buffer.from(u8)));
  }

  async function parseFch(buffer, itemNames) {
    const d = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const table = new Map();
    (itemNames || []).forEach(n => { const h = sh(n); if (!table.has(h)) table.set(h, n); });
    const nameOf = h => table.get(h) || ('?' + h.toString(16).padStart(8, '0'));

    const r0 = new R(d); const n = r0.i32();
    const body = d.subarray(4, 4 + n);
    const r = new R(body);
    const ver = r.i32(), ns = r.i32(); r.i32();
    const gstats = statblock(r, ns - 1);
    dct(r); const worlds_time = dct(r);
    const g = lists(r);
    const per = [];
    for (;;) {
      const save = r.o;
      try {
        const st = statblock(r, ns - 1);
        if (Object.values(st).some(v => Math.abs(v) > 1e9 || Number.isNaN(v))) throw new RangeError('stats');
        r.i32(); r.i32();
        const L = lists(r);
        r.i32(); r.i32(); r.i32();
        if (Object.values(st).some(v => v)) per.push(Object.assign({ stats: st }, L));
      } catch (e) { r.o = save; break; }
    }
    const end = body.length; const bdv = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let q;
    for (q = end - 8; q > 0; q--) {
      if (bdv.getInt32(q, true) === end - q - 4 && body[q - 1] === 1 && body[q - 10] === 0 && body[q - 11] === 0) break;
    }
    const pdstart = q + 4; const e = q - 19;
    let name = '?', L = 1;
    for (L = 1; L < 64; L++) { if (body[e - L - 1] === L) { name = td.decode(body.subarray(e - L, e)); break; } }
    const rr = new R(body, e); const pid = rr.i64(); rr.str(); rr.u8(); const created = rr.i64();
    const nm_off = e - L - 1;
    const worlds = [];
    for (let q2 = nm_off - 4; q2 > 20000; q2--) {
      if (bdv.getInt32(q2, true) === nm_off - (q2 + 4) && body[q2 + 4] === 0x1f && body[q2 + 5] === 0x8b) {
        const gl = nm_off - (q2 + 4);
        const wr = new R(body, q2 - 68);
        const uid = wr.i64(); const hs = wr.u8(); const sp = [wr.f32(), wr.f32(), wr.f32()]; const hl = wr.u8(); const lo = [wr.f32(), wr.f32(), wr.f32()];
        const hd = wr.u8(); const de = [wr.f32(), wr.f32(), wr.f32()]; const hp = [wr.f32(), wr.f32(), wr.f32()]; wr.u8(); wr.i32(); wr.i32(); wr.i32();
        const raw = await gunzip(body.subarray(q2 + 4, q2 + 4 + gl));
        const m = new R(raw); const ts = m.i32();
        const ex = raw.subarray(m.o, m.o + ts * ts); m.o += ts * ts;
        const oth = raw.subarray(m.o, m.o + ts * ts); m.o += ts * ts;
        const npin = m.i32(); const pins = [];
        for (let i = 0; i < npin; i++) { const pn = m.str(); const pp = [m.f32(), m.f32(), m.f32()]; const pt = m.i32(); const pc = m.u8(); const po = m.i64(); const pa = m.str(); pins.push({ name: pn, pos: pp, type: pt, checked: !!pc, owner: po, author: pa }); }
        const S = 128, f = ts / S; const grid = [];
        for (let gy = 0; gy < S; gy++) {
          const row = new Array(S);
          for (let gx = 0; gx < S; gx++) {
            let c = 0, c2 = 0;
            for (let yy = gy * f; yy < gy * f + f; yy += 4) { const base = yy * ts + gx * f; for (let xx = 0; xx < f; xx += 4) { if (ex[base + xx] === 1) c++; if (oth[base + xx] === 1) c2++; } }
            row[gx] = c ? 2 : (c2 ? 1 : 0);
          }
          grid.push(row);
        }
        let exc = 0, othc = 0; for (let i = 0; i < ex.length; i++) { if (ex[i] === 1) exc++; if (oth[i] === 1) othc++; }
        const px = Math.pow(20000 / ts, 2) / 1e6;
        worlds.push({ uid, spawn: hs ? sp : null, logout: hl ? lo : null, death: hd ? de : null, home: hp, explored_km2: Math.round(exc * px * 100) / 100, others_km2: Math.round(othc * px * 100) / 100, grid, pins });
        break;
      }
    }
    const p = new R(body, pdstart);
    p.i32(); const maxhp = p.f32(); p.f32(); const maxst = p.f32(); const tsd = p.f32(); const gp = p.str(); p.f32();
    const inv = parseInv(p, nameOf);
    const strs = () => { const k = p.i32(); const a = []; for (let i = 0; i < k; i++) a.push(p.str()); return a; };
    const recipes = strs();
    const stations = {}; { const k = p.i32(); for (let i = 0; i < k; i++) { const s = p.str(); stations[s] = p.i32(); } }
    const materials = strs(), tutorials = strs(), uniques = strs(), trophies = strs(), biomes = strs();
    const texts = {}; { const k = p.i32(); for (let i = 0; i < k; i++) { const a = p.str(); texts[a] = p.str(); } }
    const beard = p.str(), hair = p.str(); const skin = [p.f32(), p.f32(), p.f32()]; const haircol = [p.f32(), p.f32(), p.f32()]; const model = p.i32();
    const foods = []; { const k = p.i32(); for (let i = 0; i < k; i++) foods.push([p.str(), p.f32()]); }
    p.i32(); const sc = p.i32(); const skills = {};
    for (let i = 0; i < sc; i++) { const k = p.i32(); const lv = p.f32(); const acc = p.f32(); skills[SK[k] || String(k)] = { level: Math.round(lv * 100) / 100, progress: Math.round(acc * 1000) / 1000 }; }
    const created_iso = (created > 1e9 && created < 1e10) ? new Date(created * 1000).toISOString() : null;
    return {
      version: ver, name, player_id: pid, created: created_iso,
      global_stats: gstats, worlds_time,
      global_lists: { mods: g.mods, cmds: g.cmds, kills: g.kills, picked: g.picked, crafted: g.crafted, gathered: g.gathered, eaten: g.eaten, built: g.built },
      world_blocks: per, worlds,
      player: { max_hp: maxhp, max_stamina: maxst, time_since_death: tsd, guardian_power: gp, inventory: inv, recipes: recipes.length, stations, materials: materials.length, tutorials: tutorials.length, uniques, trophies, biomes, texts: Object.keys(texts).length, beard, hair, skin, hair_color: haircol, model, foods, skills }
    };
  }

  const api = { parseFch, sh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FCH = api;
})(typeof window !== 'undefined' ? window : globalThis);
