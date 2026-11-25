import {gainXp, initializeHero, learnSkill, skillInfo} from './hero.js';
import {enemyAdvance,tickBlademaster,weaponFactor} from './waves.js';
import {buyItem, countCharges, removeCharge, sellItem, useItem} from './items.js';
import {castAbility,tickAbilities,onHeroHit} from './hero-abilities.js';
// Positions and speeds use Warcraft III world units. Weapon and movement orders
// run on simulation time so pausing or changing render speed cannot skip a wave.
const FIRST_GRANT = 20;
const WAVE_START = 50;
const SHOP_RANGE = 400;
const GUARDS = [
  ['Hamg', '大法师', 1844.2, -2975.9, 500, 15, 600],
  ['Hblm', '血魔法师', 2843.6, -1909.1, 500, 18, 600],
  ['Hpal', '圣骑士', 4966, -1932.6, 1200, 22, 110],
  ['Hmkg', '山丘之王', 1823.9, -4203.3, 1200, 24, 110],
];
const DEFAULT_LANES = [
  { x: 0, y: 1344 }, { x: -1168, y: 192 },
  { x: -1584, y: -4864 }, { x: 4304, y: 2496 },
];

const point = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const living = (u) => u && u.hp > 0;
const terminal = (phase) => phase === 'won' || phase === 'lost';
const validPoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

function entity(id, type, rawcode, name, pos, maxHp, extra = {}) {
  return { id, type, rawcode, name, x: pos.x, y: pos.y, angle: 0, hp: maxHp,
    maxHp, speed: 0, range: 0, armor: 0, attackWait: 0, attackUntil: 0,
    targetId: null, path: [], waypoint: 0, goal: null, repathAt: 0,
    moving: false, ...extra };
}

function closest(origin, candidates, radius) {
  let result = null;
  let best = radius;
  for (const other of candidates) {
    if (!living(other)) continue;
    const d = dist(origin, other);
    if (d <= best) {
      best = d;
      result = other;
    }
  }
  return result;
}

export class Simulation {
  constructor(map) {
    this.map = map;
    this.heroSpawn = map.heroSpawn ?? point(3728, -4288);
    this.wispSpawn = map.wispSpawn ?? point(-1941.5, 2302);
    this.altar = map.altar ?? point(-2448, 2752);
    this.shop = map.shop ?? point(3968, -5440);
    this.lanes = map.lanes ?? DEFAULT_LANES;
    this.stats = map.stats ?? {};
    this.firstWaveAt = map.wave?.startsAt ?? WAVE_START;
    this.itemTypes=new Map(map.catalog.map(item=>[item.id,item]));
    this.waves=map.waves;
    this.reset();
  }

  reset() {
    this.selectionId='Hpal';this.altar=this.map.roster.find(r=>r.id==='Hpal').altar;
    this.phase = 'ready';
    this.time = 0;
    this.countdown = FIRST_GRANT;
    this.gold = this.kills = this.teamKills = this.remaining = 0;
    this.inventory=Array(6).fill(null);
    this.stock=new Map();
    this.waveIndex=0;this.nextWaveAt=this.firstWaveAt;this.nextClearCheck=Infinity;
    this.paused = this.granted = this.spawned = this.selecting = false;
    this.hero = this.wisp = this.order = null;
    this.enemies = [];
    this.effects = [];
    this.sequence = 0;
    this.randomState = 0x4a27b3;
    this.cooldowns = { skill: 0, taunt: 0, potion: 0 };
    this.message = '守住四路进攻，击退第十八波的黑石氏族剑圣。';
    const statue = this.stats.nitb ?? {};
    this.statue = entity('statue', 'statue', 'nitb', '雅典娜女神像',
      this.map.statue ?? point(3840, -4288), statue.uhpm ?? 80000,
      { angle: -Math.PI / 2, armor: statue.udef ?? 10, range: statue.ua1r ?? 600, regen: statue.uhpr ?? 10 });
    this.allies = GUARDS.map(([id, name, x, y, baseHp, strength, range]) => {
      const placed = this.map.alliedPlacements?.find(unit => unit.id === id);
      const home = this.nearestOpen(placed ?? point(x, y));
      const stats = this.stats[id] ?? {};
      const hp = (stats.uhpm ?? baseHp) + 35 * (stats.ustr ?? strength);
      return entity('ally-' + id, 'ally', id, name, home, hp,
        { home, angle: placed?.angle ?? 0, speed: 270, range, armor: 8,
          attackBase: (stats.ua1b ?? (range > 200 ? 40 : 50)) + (range > 200 ? 65 : strength * 3.5) });
    });
  }

  command(type, payload = {}) {
    if (type === 'restart') { this.reset(); return true; }
    if (type === 'begin' && this.phase === 'ready') {
      this.phase = 'choose';
      this.gold = 500;
      this.wisp = entity('wisp', 'wisp', 'ewsp', '小精灵', this.nearestOpen(this.wispSpawn),
        120, { speed: 270, angle: this.wispSpawn.angle ?? 0 });
      this.message = '选择英雄，或指挥小精灵走入对应的法阵。';
      return true;
    }
    if (this.phase === 'ready' || terminal(this.phase)) return false;
    if (type === 'pause') { this.paused = !this.paused; return true; }
    if (this.paused) return false;
    if (type === 'select' && this.wisp) {
      const def=this.map.roster.find(r=>r.id===(payload.id||this.selectionId));
      if(!def)return false;
      this.selectionId=def.id;this.altar=def.altar;
      this.selecting = true;
      this.message = '小精灵正前往'+def.name+'法阵。';
      return true;
    }
    if ((type === 'move' || (type === 'attackMoveTo' && living(this.hero))) &&
        validPoint(payload) && (this.wisp || living(this.hero))) {
      const pos = this.nearestOpen(payload);
      const pad=this.wisp&&this.map.roster.find(r=>dist(payload,r.altar)<=65);
      this.selecting=!!pad;
      if(pad){this.selectionId=pad.id;this.altar=pad.altar;}
      if (this.hero) this.hero.targetId = null;
      this.order = { type, ...pos };
      this.effect('move', pos, 0.6);
      return true;
    }
    if (!living(this.hero)) return false;
    if (type === 'attack') {
      if (!this.enemies.some(e => e.id === payload.id && living(e))) return false;
      this.order = { type, id: payload.id };
      return true;
    }
    if(type==='cast') {
      const id=payload.id||payload.abilityId;
      if(!this.heroDefinition.actions.some(a=>a.id===id)) return false;
      if(id==='AHhb')return this.holyLight(payload.targetId);
      if(id==='Atau')return this.taunt();
      return castAbility(this,id,payload);
    }
    if (type === 'skill' && this.hero.rawcode==='Hpal') return payload.skill === 'taunt' ? this.taunt() : this.holyLight(payload.id);
    if (type === 'learn') return learnSkill(this,payload.id);
    if(type==='swapItems') {
      const {from,to}=payload;
      if(![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<6)||!this.inventory[from])return false;
      [this.inventory[to],this.inventory[from]]=[this.inventory[from],this.inventory[to]];
      this.message='背包顺序已调整。';return true;
    }
    if (type === 'useItem') return useItem(this,payload.slot);
    if (type === 'sellItem') return sellItem(this,payload.slot,payload.shopId);
    if (type === 'potion') {
      const slot=this.inventory.findIndex(s=>s && this.itemTypes.get(s.id).bonus.heal);
      return slot<0?this.hint('背包中没有生命药水。'):useItem(this,slot);
    }
    if (type === 'buy') {
      const id=!payload.item||payload.item==='potion'?'pghe':payload.item;
      return buyItem(this,id,payload.shopId);
    }
    return false;
  }

  hint(message) { this.message = message; return false; }
  get wave() {return this.waves[this.waveIndex];}
  get waveNumber() {return this.wave.number;}
  get waveTotal() {return this.waves.length;}
  get waveName() {return this.wave.name;}
  get currentWave() {return this.wave;}
  get heroDefinition() {return this.map.roster.find(r=>r.id===(this.hero?.rawcode||this.selectionId));}
  get potions() {return countCharges(this,i=>!!i.bonus.heal);}
  get ankhs() {return countCharges(this,i=>i.kind==='revive');}

  random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  effect(type, source, life, target) {
    const effect = { id: ++this.sequence, type, x: source.x, y: source.y, life, maxLife: life };
    if (target) { effect.tx = target.x; effect.ty = target.y; }
    this.effects.push(effect);
  }

  open(x, y) {
    const b = this.map.bounds;
    if (b && (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY)) return false;
    return !this.map.walkable || this.map.walkable(x, y);
  }

  nearestOpen(pos) {
    if (this.map.nearestWalkable) return this.map.nearestWalkable(pos.x, pos.y) ?? pos;
    const b = this.map.bounds;
    const x = b ? Math.max(b.minX, Math.min(b.maxX, pos.x)) : pos.x;
    const y = b ? Math.max(b.minY, Math.min(b.maxY, pos.y)) : pos.y;
    if (this.open(x, y)) return point(x, y);
    for (let radius = 24; radius <= 768; radius += 24) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const probe = point(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
        if (this.open(probe.x, probe.y)) return probe;
      }
    }
    return point(x, y);
  }

  lineOpen(a, b) {
    if (this.map.canTraverse) return this.map.canTraverse(a.x, a.y, b.x, b.y);
    const steps = Math.ceil(dist(a, b) / 24);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.open(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }

  route(a, b) {
    const end = this.nearestOpen(b);
    if (this.lineOpen(a, end)) return [end];
    return this.map.route?.(a.x, a.y, end.x, end.y) ?? [];
  }

  setPath(unit, goal) {
    unit.goal = point(goal.x, goal.y);
    unit.path = this.route(unit, goal);
    unit.waypoint = 0;
    unit.repathAt = this.time + 1;
  }

  move(unit, goal, dt, stop = 8) {
    if (dist(unit, goal) <= stop) return true;
    const changed = !unit.goal || dist(unit.goal, goal) > 64;
    if (changed || (unit.waypoint >= unit.path.length && this.time >= unit.repathAt)) {
      this.setPath(unit, goal);
    }
    let budget = unit.speed * dt;
    while (budget > 0 && unit.waypoint < unit.path.length) {
      const next = unit.path[unit.waypoint];
      const dx = next.x - unit.x, dy = next.y - unit.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) { unit.waypoint++; continue; }
      const step = Math.min(budget, length);
      const x = unit.x + dx * step / length, y = unit.y + dy * step / length;
      if (!this.open(x, y) || (this.map.canTraverse && !this.map.canTraverse(unit.x, unit.y, x, y))) {
        unit.waypoint = unit.path.length;
        break;
      }
      unit.x = x; unit.y = y;
      unit.angle = Math.atan2(dy, dx);
      unit.moving = true;
      budget -= step;
      if (step === length) unit.waypoint++;
    }
    return dist(unit, goal) <= stop;
  }

  chooseHero() {
    const def=this.heroDefinition, stats=this.stats[def.id]??{};
    const strength = stats.ustr ?? def.base.strength;
    const maxMana = (stats.uint ?? def.base.intelligence) * 10;
    this.hero = entity('hero', 'hero', def.id, def.name, this.nearestOpen(this.heroSpawn),
      (stats.uhpm ?? 1200) + strength * 35, { angle: -Math.PI / 2, mana: maxMana, maxMana, armor: 10,
        range: stats.ua1r??def.base.range, speed: stats.umvs??def.base.speed, cooldowns: this.cooldowns, reviveIn: 0,
        attackBase: (stats.ua1b ?? 50) + 3.5 * strength });
    this.wisp = this.order = null;
    this.selecting = false;
    initializeHero(this);
    if (!this.spawned) this.phase = 'prep';
    this.effect('spawn', this.hero, 1);
    this.message = def.name+'已就位，按 K 使用第一个技能点。';
  }

  spawnWave() {
    this.spawned = true;
    this.phase = 'wave';
    for (const [lane, center] of this.lanes.entries()) {
      const start = this.nearestOpen(center);
      const route = this.route(start, this.heroSpawn);
      for (let i = 0; i < this.wave.perLane; i++) {
        // Warcraft nudges coincident units apart at creation. Pack this group
        // around the original trigger's center, then share its long route.
        const theta = i * 2.399963;
        const spread = 17 * Math.sqrt(i);
        const spawn = this.nearestOpen(point(start.x + spread * Math.cos(theta),
          start.y + spread * Math.sin(theta)));
        const wave=this.wave;
        const enemy = entity('enemy-'+wave.number+'-'+lane+'-'+i, 'enemy', wave.type, wave.name,
          spawn, wave.hp, { lane, speed:wave.speed, range:wave.range, weapon:wave, haste:wave.haste,
            armor:wave.armor,level:wave.level,boss:wave.boss,spells:wave.spells,mana:wave.mana,maxMana:wave.mana,spellAt:this.time+9+lane,
            food:wave.food,radius:wave.radius,tauntUntil:0,mirrorAt:0,stormAt:0,bladesUntil:0,
            flying:wave.flying,undead:wave.undead,magicImmune:wave.magicImmune,
            scanAt: this.time + (i % 8) * 0.04 });
        enemy.goal = { ...this.heroSpawn };
        enemy.path = [start, ...route];
        this.enemies.push(enemy);
      }
      this.effect('spawn', start, 1);
    }
    this.remaining = this.enemies.filter(enemy=>!enemy.illusion).length;
    this.nextClearCheck=(Math.floor(this.time/2)+1)*2;
    this.message='第 '+this.wave.number+' 波'+this.wave.name+'已从四处出发。';
  }

  holyLight(id) {
    const spell=skillInfo(this,'AHhb');
    if(!spell) return this.hint('请先在技能面板学习神圣之光。');
    if (this.cooldowns.skill > 0) return this.hint('神圣之光正在冷却。');
    if (this.hero.mana < 65) return this.hint('施放神圣之光需要 65 魔法。');
    const injured = this.allies.filter(a => living(a) && a.hp < a.maxHp && dist(this.hero, a) <= 800);
    const target = id === undefined
      ? injured.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      : injured.find(a => a.id === id);
    if (!target) return this.hint('靠近受伤的友方守卫后可用神圣之光治疗。');
    this.hero.mana -= 65;
    this.cooldowns.skill = 5;
    target.hp = Math.min(target.maxHp, target.hp + spell.value);
    this.effect('heal', this.hero, 0.65, target);
    this.message = '神圣之光治疗了' + target.name + '。';
    return true;
  }

  taunt() {
    if (this.cooldowns.taunt > 0) return this.hint('嘲讽正在冷却。');
    const targets = this.enemies.filter(e => living(e) && dist(this.hero, e) <= (this.stats.Atau?.aare ?? 500))
      .sort((a, b) => dist(this.hero, a) - dist(this.hero, b)).slice(0, 10);
    if (!targets.length) return this.hint('嘲讽范围内没有敌人。');
    for (const e of targets) {
      e.targetId = this.hero.id;
      e.tauntUntil = this.time + 4;
    }
    this.cooldowns.taunt = 15;
    this.effect('taunt', this.hero, 0.8);
    this.message = '嘲讽吸引了 ' + targets.length + ' 个敌人。';
    return true;
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.paused || this.phase === 'ready') return;
    while (dt > 1e-8 && !terminal(this.phase)) {
      const step = Math.min(dt, 0.05);
      this.tick(step);
      dt -= step;
    }
  }

  tick(dt) {
    this.time += dt;
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter(fx => fx.life > 0);
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (!this.granted && this.time + 1e-8 >= FIRST_GRANT) {
      this.granted = true;
      this.gold += 1000;
      this.message = '获得 1,000 金备战，首波倒计时 30 秒。';
    }
    if (!this.spawned && this.time + 1e-8 >= this.nextWaveAt) this.spawnWave();
    this.countdown = Math.max(0, (this.granted ? this.nextWaveAt : FIRST_GRANT) - this.time);
    if (this.wisp) {
      this.wisp.moving = false;
      if (this.selecting) {
        if (this.move(this.wisp, this.altar, dt, 32)) this.chooseHero();
      } else if (this.order?.type === 'move') {
        if (this.move(this.wisp, this.order, dt)) this.order = null;
        const pad=this.map.roster.find(r=>dist(this.wisp,r.altar)<=32);
        if(pad){this.selectionId=pad.id;this.altar=pad.altar;this.chooseHero();}
      }
    }
    if (this.hero) {tickAbilities(this,dt);this.tickHero(dt);}
    this.statue.hp = Math.min(this.statue.maxHp, this.statue.hp + this.statue.regen * dt);
    if (!this.spawned) {
      for(const ally of this.allies) {
        ally.moving=false;
        if(ally.summoned && living(ally) && dist(ally,ally.home)>20)this.move(ally,ally.home,dt,20);
      }
      return;
    }
    this.tickDefenses(dt);
    if (living(this.statue)) this.tickEnemies(dt);
    this.enemies = this.enemies.filter(living);
    this.remaining = this.enemies.filter(enemy=>!enemy.illusion).length;
    if (!living(this.statue)) {
      this.phase = 'lost'; this.message = '雅典娜女神像已倒下。';
    } else if (this.time+1e-8>=this.nextClearCheck) {
      this.nextClearCheck+=2;
      if(this.enemies.some(e=>e.food>0)) return;
      if(this.waveIndex===this.waves.length-1) {
        this.phase='won';this.message='四路剑圣已被击退，完成前十八波防守。';
      } else {
        this.waveIndex++;this.gold+=1000;this.nextWaveAt=this.time+30;
        this.phase=this.wisp?'choose':'prep';this.spawned=false;this.countdown=30;
        this.message='全队获得 1,000 金。第 '+this.wave.number+' 波将在 30 秒后抵达。';
      }
    }
  }

  tickHero(dt) {
    const h = this.hero;
    h.moving = false;
    if (!living(h)) {
      if (h.reviveIn > 0 && (h.reviveIn = Math.max(0, h.reviveIn - dt)) === 0) {
        h.hp = Math.min(this.stats.AIrc?.irc2 ?? 1500, h.maxHp);
        h.mana = Math.min(this.stats.AIrc?.irc3 ?? 500, h.maxMana);
        this.effect('revive', h, 1.2);
        this.message = '重生十字章已使'+h.name+'在原地复活。';
      }
      return;
    }
    h.mana = Math.min(h.maxMana, h.mana + h.manaRegen*dt);
    h.hp = Math.min(h.maxHp, h.hp + h.healthRegen*dt);
    if(h.channel)return;
    if (this.order?.type === 'move') {
      if (this.move(h, this.order, dt)) this.order = null;
      return;
    }
    if (this.order?.type === 'trade') {
      const order=this.order;
      if (this.move(h, order.shop, dt, SHOP_RANGE)) {
        this.order=null;
        if(order.action==='sell') sellItem(this,order.slot,order.shop.id,order.expected);
        else buyItem(this,order.id,order.shop.id,true);
      }
      return;
    }
    let target;
    if (this.order?.type === 'attack') {
      target = this.enemies.find(e => e.id === this.order.id && living(e));
      if (!target) this.order = null;
    }
    target ??= closest(h, this.enemies, 550);
    h.targetId = target?.id ?? null;
    if (target) this.engage(h, target, dt);
    else if (this.order?.type === 'attackMoveTo' && this.move(h, this.order, dt)) this.order = null;
  }

  tickDefenses(dt) {
    for (const guard of this.allies) {
      guard.moving = false;
      if (!living(guard)) continue;
      const target = closest(guard, this.enemies, 750);
      guard.targetId = target?.id ?? null;
      if (target && dist(guard.home, target) <= 1200) this.engage(guard, target, dt);
      else if (dist(guard, guard.home) > 20) this.move(guard, guard.home, dt);
    }
    const target = closest(this.statue, this.enemies, this.statue.range);
    if (target) this.engage(this.statue, target, dt);
  }

  tickEnemies(dt) {
    const defenders = [this.statue, ...this.allies];
    if (living(this.hero)) defenders.push(this.hero);
    for (const enemy of this.enemies) {
      enemy.moving = false;
      if (!living(enemy)) continue;
      if (enemy.illusion && this.time>=enemy.expiresAt) {enemy.hp=0;continue;}
      if (enemy.stunnedUntil>this.time) continue;
      let target = defenders.find(d => d.id === enemy.targetId && living(d));
      if (enemy.tauntUntil <= this.time && enemy.scanAt <= this.time) {
        enemy.scanAt = this.time + 0.4;
        target = closest(enemy, defenders, 680);
        enemy.targetId = target?.id ?? null;
      }
      if (enemy.boss && enemy.rawcode==='Nbbc' && tickBlademaster(this,enemy,target,defenders,dt)) continue;
      if (target) this.engage(enemy, target, dt);
      else enemyAdvance(this,enemy,this.heroSpawn,dt);
    }
    this.separateEnemies();
  }

  separateEnemies() {
    // The largest supported unit has radius 32. Separate flying units on
    // their own layer so they can pass directly over ground units and walls.
    const buckets = new Map();
    for (const enemy of this.enemies) {
      if (!living(enemy)) continue;
      const gx = Math.floor(enemy.x / 64), gy = Math.floor(enemy.y / 64);
      for (let y = gy - 1; y <= gy + 1; y++) {
        for (let x = gx - 1; x <= gx + 1; x++) {
          const others = buckets.get(x + ',' + y);
          if (!others) continue;
          for (const other of others) {
            if (enemy.flying!==other.flying) continue;
            const dx = enemy.x - other.x, dy = enemy.y - other.y;
            const d = Math.hypot(dx, dy);
            const diameter=enemy.radius+other.radius;
            if (d >= diameter) continue;
            const amount = Math.min(3, (diameter - d) * 0.45);
            const ox = d > 0.01 ? dx / d * amount : amount;
            const oy = d > 0.01 ? dy / d * amount : 0;
            if (enemy.flying || this.open(enemy.x + ox, enemy.y + oy)) { enemy.x += ox; enemy.y += oy; }
            if (other.flying || this.open(other.x - ox, other.y - oy)) { other.x -= ox; other.y -= oy; }
          }
        }
      }
      const key = gx + ',' + gy;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(enemy);
    }
  }

  engage(attacker, target, dt) {
    if (dist(attacker, target) > attacker.range) {
      if (attacker.type==='enemy') enemyAdvance(this,attacker,target,dt,attacker.range);
      else this.move(attacker,target,dt,attacker.range);
      return;
    }
    attacker.angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    if (attacker.attackWait > this.time) return;
    const troll = attacker.type === 'enemy', statue = attacker.type === 'statue';
    const stats = this.stats[attacker.rawcode] ?? {};
    attacker.attackWait = this.time + (attacker.weapon?.interval ?? stats.ua1c ?? (statue ? 2 : 1.5))/(attacker.haste??1);
    attacker.attackUntil = this.time + 0.35;
    let base;
    if (troll) {
      const weapon=attacker.weapon;
      base=weapon.attackBase;
      for(let i=0;i<weapon.attackDice;i++)base+=1+Math.floor(this.random()*weapon.attackSides);
      if(attacker.boss && attacker.rawcode==='Nbbc' && target.type!=='statue' && this.random()<attacker.spells.critChance) {
        base*=attacker.spells.critFactor;
        this.effect('crit',attacker,.45,target);
      }
      base*=attacker.damageFactor??1;
    }
    else if (statue) base = (stats.ua1b ?? 10) + 1;
    else {
      base = attacker.attackBase;
      for (let i = 0; i < (stats.ua1d ?? 5); i++) base += 1 + Math.floor(this.random() * (stats.ua1s ?? 3));
    }
    const factor=weaponFactor(attacker,target);
    const aura=this.hero && living(this.hero) && target!==this.hero && target.type!=='enemy' && dist(this.hero,target)<=900?skillInfo(this,'AHad')?.value||0:0;
    const shield=target===this.hero && attacker.range<300 ? skillInfo(this,'A001')?.reduction??1:1;
    const damage=base*factor*shield/(1+.06*(target.armor+aura));
    this.damage(target,attacker,damage);
    if(attacker===this.hero)onHeroHit(this,attacker,target,damage);
    this.effect(attacker.range >= 300 ? 'bolt' : 'hit', attacker, 0.25, target);
    const cleave=attacker===this.hero?skillInfo(this,'A00I'):null;
    if(cleave) for(const foe of this.enemies) {
      if(foe!==target && living(foe) && dist(foe,target)<=cleave.radius)
        this.damage(foe,attacker,base*cleave.value/(1+.06*foe.armor));
    }
    if(attacker.boss && attacker.rawcode==='Hlgr' && attacker.mana>=65 && this.time>=attacker.spellAt) {
      attacker.spellAt=this.time+12;
      const injured=this.enemies.find(e=>e!==attacker&&living(e)&&e.hp<e.maxHp*.55&&dist(e,attacker)<800);
      if(injured) {
        injured.hp=Math.min(injured.maxHp,injured.hp+attacker.spells.heal);attacker.mana-=65;
        this.effect('heal',attacker,.6,injured);
      } else if(attacker.mana>=attacker.spells.shockCost) {
        attacker.mana-=attacker.spells.shockCost;
        const dx=Math.cos(attacker.angle),dy=Math.sin(attacker.angle);
        for(const d of [this.statue,this.hero,...this.allies]) {
          if(!living(d) || d.avatar?.until>this.time)continue;
          const x=d.x-attacker.x,y=d.y-attacker.y,along=x*dx+y*dy;
          if(along>=0 && along<=800 && Math.abs(x*dy-y*dx)<130) {
            this.spellDamage(d,attacker,attacker.spells.shock);this.effect('bolt',attacker,.4,d);
          }
        }
      }
    }
  }

  spellDamage(target,attacker,amount) {
    if(target.magicImmune || target.avatar?.until>this.time)return;
    this.damage(target,attacker,amount*(1-(target.spellResistance||0)));
  }

  damage(target,attacker,amount) {
    if(!living(target)) return;
    target.hp=Math.max(0,target.hp-amount*(target.damageTakenFactor??1));
    if(!target.hp) this.died(target,attacker);
  }

  died(target, attacker) {
    this.effect('death', target, 0.5);
    if (target.type === 'enemy') {
      if(target.illusion) return;
      if(target.boss && target.rawcode==='Nbbc') {
        for(const image of this.enemies) if(image.ownerId===target.id) image.hp=0;
      }
      this.teamKills++;
      const personalKill=this.hero && (attacker===this.hero || attacker?.ownerId===this.hero.id);
      if(living(this.hero) && (personalKill || dist(this.hero,target)<=1200))
        gainXp(this,(target.boss?300:25)*this.map.xpFactor);
      if (personalKill) {
        this.kills++;
        const w=target.weapon;
        this.gold+=w.bounty;
        for(let i=0;i<w.bountyDice;i++) this.gold+=1+Math.floor(this.random()*w.bountySides);
      }
    } else if (target === this.hero) {
      this.order = null;
      if (this.ankhs > 0) {
        removeCharge(this,this.inventory.findIndex(s=>s&&this.itemTypes.get(s.id).kind==='revive'));
        target.reviveIn = this.stats.AIrc?.Ircd ?? 15;
        this.message = '重生十字章已消耗，'+target.name+'将在原地复活。';
      } else this.message = target.name+'已阵亡，守卫继续保卫神像。';
    }
  }
}
