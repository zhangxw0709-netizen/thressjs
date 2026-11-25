import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenario} from '../scripts/map-data.mjs';
import {createMap} from '../src/map.js';
import {Simulation} from '../src/simulation.js';

const map=createMap(loadScenario());
function choose(id) {
  const s=new Simulation(map);
  s.command('begin');
  s.command('move',map.roster.find(hero=>hero.id===id).altar);
  s.update(5);
  assert.equal(s.hero?.rawcode,id);
  return s;
}
function purchase(s,id) {
  assert.ok(s.command('buy',{item:id}));
  for(let i=0;i<200 && s.order?.type==='trade';i++)s.update(.05);
  assert.notEqual(s.order?.type,'trade');
}

test('mana stone improves Archmage regeneration until consumed, a knowledge tome changes all three stats',()=>{
  const s=choose('Hamg'),h=s.hero,base=h.manaRegen;
  s.update(15);
  purchase(s,'mnst');
  assert.equal(h.manaRegen,base*1.5);
  h.mana=0;s.update(1);
  assert.ok(Math.abs(h.mana-h.manaRegen)<.001);
  assert.ok(s.command('useItem',{slot:s.inventory.findIndex(item=>item?.id==='mnst')}));
  assert.equal(h.mana,h.maxMana);assert.equal(h.manaRegen,base);
  const before=[h.strength,h.agility,h.intelligence,h.attackBase];
  s.gold=s.itemTypes.get('I00I').price;
  purchase(s,'I00I');
  assert.deepEqual([h.strength,h.agility,h.intelligence,h.attackBase],before.map((n,k)=>n+(k===3?50*map.attackPerPrimary:50)));
});

test('crusader shield applies its documented armor and resistance until sold',()=>{
  const s=choose('Hmkg'),h=s.hero,armor=h.armor;
  s.update(15);
  purchase(s,'I007');
  assert.equal(h.armor,armor+10);
  let hp=h.hp;
  s.spellDamage(h,s.statue,100);assert.equal(h.hp,hp-67);
  assert.ok(s.command('sellItem',{slot:s.inventory.findIndex(item=>item?.id==='I007'),shopId:'n000'}));
  assert.equal(h.armor,armor);
  hp=h.hp;s.spellDamage(h,s.statue,100);assert.equal(h.hp,hp-100);
});
