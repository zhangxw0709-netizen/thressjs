import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScenario } from '../scripts/map-data.mjs';
import { createMap } from '../src/map.js';
import { Simulation } from '../src/simulation.js';
import { onHeroHit,tickAbilities } from '../src/hero-abilities.js';

const map=createMap(loadScenario());

function select(rawcode){
  const sim=new Simulation(map);
  sim.command('begin');sim.command('select',{id:rawcode});sim.update(5);
  assert.equal(sim.hero.rawcode,rawcode);
  return sim;
}

function foe(sim,id,dx,extras={}){
  const e={id,type:'enemy',rawcode:'nftr',hp:5500,maxHp:5500,x:sim.hero.x+dx,y:sim.hero.y,
    armor:0,speed:270,haste:1,...extras};
  sim.enemies.push(e);return e;
}

test('three original pick regions and hero-specific skill lists use map rank counts and overrides',()=>{
  const [p,a,m]=map.roster;
  assert.deepEqual([p.altar,a.altar,m.altar],[{x:-2448,y:2752},{x:-2448,y:2560},{x:-2448,y:2368}]);
  assert.equal(a.base.strength,15);assert.equal(a.base.range,600);assert.equal(m.base.intelligence,15);
  assert.equal(a.skills.find(s=>s.id==='AHbz').ranks[3].value,420);
  assert.equal(m.skills.find(s=>s.id==='AHtb').ranks[3].value,9000);
  assert.equal(m.skills.find(s=>s.id==='AHav').ranks[2].health,6000);
  assert.equal(a.actions.find(s=>s.id==='A004').mana,30);
  assert.equal(select('Hmkg').command('learn',{id:'AHbz'}),false);
});

test('storm bolt auto-acquires a vulnerable target, respects range, mana and cooldown, and stuns bosses for the original shorter duration',()=>{
  const sim=select('Hmkg'),h=sim.hero;
  const immune=foe(sim,'immune',35,{magicImmune:true}),boss=foe(sim,'boss',300,{boss:true});
  assert.equal(sim.command('cast',{id:'AHtb'}),false);
  assert.equal(sim.command('learn',{id:'AHtb'}),true);
  assert.equal(sim.command('cast',{id:'AHtb',targetId:'immune'}),false);
  assert.equal(h.mana,150);assert.equal(immune.hp,5500);
  assert.equal(sim.command('cast',{id:'AHtb'}),true);
  assert.equal(boss.hp,4500);assert.equal(boss.stunnedUntil,sim.time+3);
  assert.equal(h.mana,75);assert.equal(sim.cooldowns.AHtb,9);
  assert.equal(sim.command('cast',{id:'AHtb'}),false);
  sim.cooldowns.AHtb=0;h.mana=74;
  assert.equal(sim.command('cast',{id:'AHtb'}),false);assert.equal(boss.hp,4500);
});

test('thunder clap affects the close group, restores base speed without drift and bash triggers only on a successful roll',()=>{
  const sim=select('Hmkg'),h=sim.hero,t=foe(sim,'target',60),f=foe(sim,'far',800),i=foe(sim,'immune',80,{magicImmune:true});
  sim.command('learn',{id:'AHtc'});assert.equal(sim.command('cast',{id:'AHtc'}),true);
  assert.equal(t.hp,5360);assert.equal(i.hp,5500);assert.equal(f.hp,5500);assert.equal(t.speed,135);
  sim.time+=5;tickAbilities(sim,5);assert.equal(t.speed,270);assert.equal(t.haste,1);
  h.skillPoints=1;sim.command('learn',{id:'AHbh'});sim.random=()=>.09;
  onHeroHit(sim,h,t);assert.equal(t.hp,5300);assert.equal(t.stunnedUntil,sim.time+2);
  sim.random=()=>.10;onHeroHit(sim,h,t);assert.equal(t.hp,5300);
});

test('blizzard channels real damage pulses, shares their cap, misses immune targets and cancels on a move command',()=>{
  const sim=select('Hamg'),h=sim.hero;
  sim.command('learn',{id:'AHbz'});
  const group=Array.from({length:6},(_,i)=>foe(sim,'target'+i,500+i));
  const immune=foe(sim,'immune',510,{magicImmune:true});
  assert.equal(sim.command('cast',{id:'AHbz',x:h.x+2000,y:h.y}),false);
  assert.equal(sim.command('cast',{id:'AHbz'}),true);
  assert.equal(h.mana,115);assert.ok(h.channel);
  sim.time++;tickAbilities(sim,1);
  assert.deepEqual(group.map(e=>e.hp),Array(6).fill(5475));assert.equal(immune.hp,5500);
  sim.command('move',{x:h.x+48,y:h.y});sim.time++;tickAbilities(sim,1);assert.equal(h.channel,null);
  assert.deepEqual(group.map(e=>e.hp),Array(6).fill(5475));
});

test('water elementals persist as targetable allied units, travel by the Archmage innate and disappear at expiry',()=>{
  const sim=select('Hamg'),h=sim.hero;
  sim.command('learn',{id:'AHwe'});assert.equal(sim.command('cast',{id:'AHwe'}),true);
  const summon=sim.allies.find(a=>a.summoned);
  assert.equal(summon.rawcode,'hwat');assert.equal(summon.maxHp,1200);assert.equal(summon.attackBase,78);
  assert.equal(sim.cooldowns.AHwe,18);assert.equal(h.mana,65);
  const original={x:h.x,y:h.y};
  const to=sim.allies.find(a=>a.rawcode==='Hmkg'&&!a.summoned);
  assert.equal(sim.command('cast',{id:'A004',targetId:to.id}),true);
  sim.time+=3;tickAbilities(sim,3);
  assert.ok(Math.hypot(h.x-original.x,h.y-original.y)>1000);
  assert.ok(Math.hypot(h.x-summon.x,h.y-summon.y)<250);
  assert.equal(sim.command('cast',{id:'A004'}),false);
  sim.cooldowns.A004=0;
  assert.equal(sim.command('cast',{id:'A004'}),true);
  sim.time+=3;tickAbilities(sim,3);
  assert.ok(Math.hypot(h.x-sim.statue.x,h.y-sim.statue.y)<200);
  sim.time=summon.expiresAt;tickAbilities(sim,1);
  assert.ok(!sim.allies.includes(summon));
});

test('frost autocast consumes mana per hit, brilliance restores mana, avatar grants its map bonuses only until expiry',()=>{
  const mage=select('Hamg'),h=mage.hero;
  h.level=8;h.skillPoints=2;
  mage.command('learn',{id:'ANfa'});mage.command('learn',{id:'AHab'});
  assert.equal(mage.command('cast',{id:'ANfa'}),true);
  const e=foe(mage,'ice',100);h.mana=40;onHeroHit(mage,h,e);
  assert.equal(e.hp,5200);assert.equal(h.mana,30);
  assert.ok(Math.abs(e.speed-135)<.0001);assert.ok(Math.abs(e.haste-.6)<.0001);
  tickAbilities(mage,.5);assert.equal(h.mana,30.5);
  mage.command('cast',{id:'ANfa'});onHeroHit(mage,h,e);assert.equal(h.mana,30.5);
  const king=select('Hmkg'),k=king.hero;k.level=8;king.command('learn',{id:'AHav'});
  const before=[k.maxHp,k.armor,k.attackBase];
  assert.ok(king.command('cast',{id:'AHav'}));
  assert.deepEqual([k.maxHp,k.armor,k.attackBase],before.map((n,j)=>n+[2000,10,250][j]));
  const health=k.hp;king.spellDamage(k,null,300);assert.equal(k.hp,health);
  king.time=k.avatar.until;tickAbilities(king,.1);
  assert.deepEqual([k.maxHp,k.armor,k.attackBase],before);assert.equal(k.avatar,undefined);
});
