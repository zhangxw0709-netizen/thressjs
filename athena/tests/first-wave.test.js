import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScenario } from '../scripts/map-data.mjs';
import { createMap } from '../src/map.js';
import { Simulation } from '../src/simulation.js';

const map=createMap(loadScenario());
const tick=sim=>sim.update(1/30);
function advance(sim,seconds) {
  for (let i=0;i<Math.round(seconds*30);i++) tick(sim);
}

test('four entrances, altar and supply shop connect through valid pathing cells',()=>{
  const pairs=map.lanes.map(p=>[p,map.heroSpawn]);
  pairs.push([map.wispSpawn,map.altar],[map.heroSpawn,map.shop]);
  for (const [from,to] of pairs) {
    const points=map.route(from.x,from.y,to.x,to.y);
    assert.ok(points.length);
    let p=from;
    for (const q of points) {
      assert.ok(map.canTraverse(p.x,p.y,q.x,q.y));
      p=q;
    }
    assert.deepEqual(p,{x:to.x,y:to.y});
  }
});

test('selection, distance-limited purchase, pause and the original wave clock',()=>{
  const sim=new Simulation(map);
  sim.command('begin'); sim.command('select'); advance(sim,4);
  assert.equal(sim.hero.rawcode,'Hpal');
  assert.equal(sim.gold,500);
  sim.command('buy');
  assert.equal(sim.potions,1);
  advance(sim,8);
  assert.equal(sim.potions,2);assert.equal(sim.gold,450);
  sim.command('pause'); const t=sim.time; advance(sim,8); assert.equal(sim.time,t);
  sim.command('pause'); advance(sim,8);assert.equal(sim.gold,1450);
  advance(sim,30);
  assert.equal(sim.phase,'wave');
  assert.equal(sim.remaining,120);
  for (let i=0;i<4;i++) assert.equal(sim.enemies.filter(u=>u.lane===i).length,30);
});

test('first-wave combat awards the next preparation interval, and restart clears prior state',()=>{
  const sim=new Simulation(map);
  sim.command('begin');sim.command('select');
  for (let frame=0;frame<30*1900;frame++) {
    if (sim.wave.number===2||sim.phase==='lost') break;
    if (sim.hero && sim.hero.hp>0 && frame%30===0) {
      if (sim.hero.hp < sim.hero.maxHp*.6) sim.command('potion');
      sim.command('skill');
    }
    tick(sim);
  }
  assert.equal(sim.phase,'prep');assert.equal(sim.wave.number,2);
  assert.equal(sim.teamKills,120);
  assert.equal(sim.remaining,0);
  sim.command('restart');
  assert.equal(sim.phase,'ready');assert.equal(sim.gold,0);assert.equal(sim.hero,null);
  sim.command('begin');sim.command('select');advance(sim,50);
  const attacker=sim.enemies[0];
  Object.assign(attacker,{x:sim.statue.x+80,y:sim.statue.y,targetId:sim.statue.id,scanAt:Infinity,attackWait:0});
  sim.statue.hp=.01;tick(sim);
  assert.equal(sim.phase,'lost');
});
