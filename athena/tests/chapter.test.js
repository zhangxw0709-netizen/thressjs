import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenario} from '../scripts/map-data.mjs';
import {createMap} from '../src/map.js';
import {Simulation} from '../src/simulation.js';
import {itemStock} from '../src/items.js';
const map=createMap(loadScenario());
function enter(){
  const s=new Simulation(map);s.command('begin');s.command('select');s.update(4);return s;
}
function settle(s,limit=30){
  for(let n=0;n<limit*10 && s.order?.type==='trade';n++)s.update(.1);
  assert.notEqual(s.order?.type,'trade');
}
test('wear, rearrange, and sell a real sword; source merchant and gold are enforced',()=>{
  const s=enter(),h=s.hero,attack=h.attackBase,armor=h.armor;
  assert.equal(s.command('buy',{item:'I004',shopId:'n002'}),false);
  assert.equal(s.command('buy',{item:'I004',shopId:'n000'}),true);
  assert.equal(s.gold,500);settle(s);
  assert.equal(s.gold,150);assert.equal(h.attackBase,attack+40);assert.equal(h.armor,armor+10);
  assert.equal(s.inventory[2].id,'I004');s.command('swapItems',{from:2,to:4});
  assert.equal(s.inventory[4].id,'I004');assert.equal(h.attackBase,attack+40);
  s.command('sellItem',{slot:4,shopId:'n000'});
  assert.equal(h.attackBase,attack);assert.equal(h.armor,armor);assert.equal(s.gold,325);
});
test('experience tome, player choices, combat XP, rank gates, and cleave damage',()=>{
  const s=enter(),h=s.hero;
  assert.ok(s.command('learn',{id:'A00I'}));
  assert.equal(h.ranks.A00I,1);assert.equal(h.skillPoints,0);
  s.command('buy',{item:'texp',shopId:'n005'});settle(s);
  assert.equal(h.level,2);assert.equal(h.skillPoints,1);
  assert.equal(s.command('learn',{id:'A00I'}),false);
  assert.ok(s.command('learn',{id:'Aamk'}));assert.equal(h.strength,22+4+5);
  assert.equal(s.inventory.filter(Boolean).length,2);
  s.update(50-s.time);const [a,b]=s.enemies;
  Object.assign(a,{x:h.x+24,y:h.y,hp:1});Object.assign(b,{x:h.x+36,y:h.y,hp:180});
  const xp=h.xp;s.engage(h,a,.03);
  assert.equal(h.xp,xp+5);assert.ok(b.hp<180);assert.equal(s.kills,1);
});
test('charged items occupy real slots and full inventory rejects charging gold; tomes still apply',()=>{
  const s=enter();s.update(16);
  s.command('buy',{item:'I000'});settle(s);
  assert.equal(s.inventory[2].charges,15);
  s.hero.hp-=600;s.command('useItem',{slot:2});assert.equal(s.inventory[2].charges,14);
  assert.equal(s.command('useItem',{slot:2}),false);
  for(let i=0;i<3;i++){assert.ok(s.command('buy',{item:'ankh'}));settle(s);}
  const gold=s.gold;assert.equal(s.command('buy',{item:'pghe'}),false);assert.equal(s.gold,gold);
  const hp=s.hero.maxHp;s.command('buy',{item:'tstr'});settle(s);assert.equal(s.hero.maxHp,hp+35);
});
test('eighteen original waves, one grant per clear and four bosses at each boss gate',()=>{
  const s=enter();s.update(46);
  const expected=['nftr','nogr','nkog','nfrb','nsel','ndmu','nrvl','nepl','Hlgr','nfpe','nlkl','nane','ntrd','nsgb','nsoc','nhrh','nfra','Nbbc'];
  const uniqueIds=new Set();
  for(let n=0;n<expected.length;n++){
    assert.equal(s.phase,'wave');
    assert.equal(s.waveNumber,n+1);
    assert.equal(s.enemies.length,n===8||n===17?4:120);
    assert.ok(s.enemies.every(e=>e.rawcode===expected[n]&&e.hp===e.maxHp));
    for(const e of s.enemies){assert.ok(!uniqueIds.has(e.id));uniqueIds.add(e.id);}
    for(const foe of s.enemies)s.damage(foe,s.statue,foe.maxHp);
    const gold=s.gold;s.update(2.01);
    if(n===17) {assert.equal(s.phase,'won');assert.equal(s.gold,gold);break;}
    assert.equal(s.phase,'prep');assert.equal(s.wave.number,n+2);assert.equal(s.gold,gold+1000);
    s.command('pause');const time=s.time;s.update(100);assert.equal(s.time,time);s.command('pause');
    s.update(s.nextWaveAt-s.time+.001);assert.equal(s.gold,gold+1000);
  }
  assert.equal(s.teamKills,1928);
});

test('level-ten blademaster mirrors cost mana, use no food and grant no rewards; storm respects Avatar',()=>{
  const s=enter();
  s.waveIndex=17;s.spawnWave();
  const [boss]=s.enemies,h=s.hero;
  Object.assign(boss,{x:h.x-400,y:h.y,targetId:h.id,scanAt:Infinity});
  const gold=s.gold,kills=s.kills,xp=h.xp;
  s.tickEnemies(.05);
  const images=s.enemies.filter(e=>e.ownerId===boss.id);
  assert.equal(images.length,3);
  assert.equal(boss.mana,boss.maxMana-100);
  assert.ok(images.every(e=>e.illusion && !e.food && e.damageFactor===0));
  s.damage(images[0],h,1e6);
  assert.deepEqual([s.gold,s.kills,h.xp],[gold,kills,xp]);
  Object.assign(boss,{x:h.x+70,y:h.y,attackWait:Infinity});h.avatar={until:s.time+5};
  s.tickEnemies(.05);const health=h.hp;
  assert.ok(boss.bladesUntil>s.time);
  s.tickEnemies(.05);assert.equal(h.hp,health);
  h.avatar=null;s.tickEnemies(.05);assert.ok(h.hp<health);
  s.damage(boss,h,1e6);
  assert.ok(images.every(e=>e.hp===0));
});

test('stock recovers on game time and canceling a shopping trip preserves gold and inventory',()=>{
  const s=enter();s.update(16);const gold=s.gold;
  s.command('buy',{item:'I004'});
  s.command('move',{x:s.hero.x,y:s.hero.y});s.update(.1);
  assert.equal(s.gold,gold);assert.equal(s.inventory.filter(Boolean).length,2);
  s.command('buy',{item:'I004'});settle(s);s.command('buy',{item:'I004'});
  const item=s.itemTypes.get('I004');
  assert.equal(itemStock(s,item).count,0);assert.equal(s.command('buy',{item:'I004'}),false);
  s.command('pause');s.update(60);assert.equal(itemStock(s,item).count,0);
  s.command('pause');s.update(30);assert.equal(itemStock(s,item).count,1);
});
