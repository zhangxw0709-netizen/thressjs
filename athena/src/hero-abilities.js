import { recalculate } from './hero.js';

const living = unit => unit && unit.hp > 0;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const definition = sim => sim.map.roster.find(row=>row.id===sim.hero?.rawcode);
const rankOf = (sim,id) => definition(sim)?.skills.find(s=>s.id===id)?.ranks[(sim.hero?.ranks[id]||0)-1];
const vulnerable = unit => living(unit) && !unit.magicImmune;
const point = unit => ({x:unit.x,y:unit.y});

function enemyTarget(sim,range,targetId){
  const within=e=>vulnerable(e)&&distance(sim.hero,e)<=range;
  if(targetId!=null)return sim.enemies.find(e=>e.id===targetId&&within(e));
  const current=sim.enemies.find(e=>e.id===sim.hero.targetId&&within(e));
  if(current)return current;
  let nearest=null,best=Infinity;
  for(const e of sim.enemies)if(within(e)){
    const d=distance(sim.hero,e);
    if(d<best){best=d;nearest=e;}
  }
  return nearest;
}

function pay(sim,action,rank) {
  sim.hero.mana-=rank.mana??0;
  sim.cooldowns[action.cooldownKey]=rank.cooldown||0;
  sim.hero.channel=null;
  sim.message=sim.hero.name+'施放了'+action.name+'。';
}

function applySpeed(target,now){
  const control=target.heroSlows;
  if(!control)return;
  let move=1,attack=1;
  for(const [key,slow] of Object.entries(control.spells)){
    if(slow.until<=now)delete control.spells[key];
    else {move=Math.min(move,1-slow.move);attack=Math.min(attack,1-slow.attack);}
  }
  target.speed=control.speed*move;
  target.haste=control.haste*attack;
  if(!Object.keys(control.spells).length)delete target.heroSlows;
}

function slow(sim,target,spell,id){
  const control=target.heroSlows??={speed:target.speed,haste:target.haste??1,spells:{}};
  control.spells[id]={until:sim.time+(target.boss?spell.heroDuration:spell.duration),move:spell.moveSlow,attack:spell.attackSlow};
  applySpeed(target,sim.time);
}

function stun(sim,target,spell){
  const duration=target.boss?spell.heroDuration:spell.duration;
  target.stunnedUntil=Math.max(target.stunnedUntil??0,sim.time+duration);
  target.moving=false;
}

function summon(sim,rank){
  const h=sim.hero;
  for(let n=0;n<rank.value;n++){
    const theta=h.angle+Math.PI/2+n*2*Math.PI/rank.value;
    const pos=sim.nearestOpen({x:h.x+90*Math.cos(theta),y:h.y+90*Math.sin(theta)});
    const ally={id:'elemental-'+(++sim.sequence),type:'ally',rawcode:rank.unit,name:'水元素',
      ...pos,home:point(pos),ownerId:h.id,summoned:true,expiresAt:sim.time+rank.duration,
      hp:rank.health,maxHp:rank.health,range:rank.range,speed:rank.speed,armor:rank.armor,
      attackBase:rank.attack,angle:h.angle,attackWait:sim.time,attackUntil:0,
      path:[],waypoint:0,repathAt:0,goal:null,moving:false,targetId:null};
    sim.allies.push(ally);
    sim.effect('summon',ally,.85);
  }
}

export function castAbility(sim,id,payload={}) {
  const h=sim.hero;
  if(!living(h)||sim.paused)return false;
  const action=definition(sim)?.actions.find(a=>a.id===id);
  if(!action)return false;
  const targetId=payload.targetId;
  if(id==='AHhb')return sim.holyLight(targetId);
  if(id==='Atau')return sim.taunt();
  const rank=action.skillId?rankOf(sim,action.skillId):action;
  if(!rank)return sim.hint('请先在技能面板学习'+action.name+'。');
  if(id==='ANfa'){
    h.frostEnabled=!h.frostEnabled;
    sim.message=h.frostEnabled?'已开启霜冻攻击，每次命中消耗魔法。':'已关闭霜冻攻击。';
    return true;
  }
  if((sim.cooldowns[action.cooldownKey]||0)>0)return sim.hint(action.name+'正在冷却。');
  if(h.mana<(rank.mana||0))return sim.hint(action.name+'需要 '+rank.mana+' 魔法。');
  if(id==='AHbz'){
    const center=Number.isFinite(payload.x)&&Number.isFinite(payload.y)?point(payload):enemyTarget(sim,rank.range,targetId);
    if(!center||distance(h,center)>rank.range)return sim.hint('请在暴风雪施法距离内指定地点或靠近敌人。');
    pay(sim,action,rank);sim.order=null;h.moving=false;
    h.channel={id,center:point(center),rank,remaining:rank.pulses,nextAt:sim.time+1};
    sim.effect('blizzard',center,.9);
  }else if(id==='AHwe'){
    pay(sim,action,rank);summon(sim,rank);
  }else if(id==='A004'){
    const dest=targetId==null?sim.statue:[sim.statue,...sim.allies].find(a=>a.id===targetId&&living(a));
    if(!living(dest))return sim.hint('请选择存活的守军、召唤物或女神像作为传送目标。');
    pay(sim,action,rank);sim.order=null;h.moving=false;
    h.channel={id,targetId:dest.id,nextAt:sim.time+3};
    sim.effect('teleport',h,3,dest);
  }else if(id==='AHtb'){
    const target=enemyTarget(sim,rank.range,targetId);
    if(!target)return sim.hint('施法距离内没有可被风暴之锤击中的敌人。');
    pay(sim,action,rank);stun(sim,target,rank);
    sim.spellDamage(target,h,rank.value);
    sim.effect('storm',h,.40,target);
  }else if(id==='AHtc'){
    const targets=sim.enemies.filter(e=>vulnerable(e)&&distance(e,h)<=rank.radius);
    if(!targets.length)return sim.hint('雷霆一击范围内没有敌人。');
    pay(sim,action,rank);sim.effect('clap',h,.65);
    for(const e of targets){slow(sim,e,rank,id);sim.spellDamage(e,h,rank.value);}
  }else if(id==='AHav'){
    pay(sim,action,rank);
    h.avatar={until:sim.time+rank.duration,health:rank.health,armor:rank.armor,damage:rank.value};
    recalculate(sim);sim.effect('avatar',h,1);
  }else return false;
  return true;
}

function blizzardPulse(sim,channel){
  const {center,rank}=channel;
  const valid=unit=>vulnerable(unit)&&!(unit.avatar?.until>sim.time)&&distance(unit,center)<=rank.radius;
  const targets=[...sim.enemies,...sim.allies,sim.statue,sim.hero].filter(valid);
  const damage=rank.cap>0?Math.min(rank.value,rank.cap/Math.max(1,targets.length)):rank.value;
  for(const unit of targets){
    sim.spellDamage(unit,sim.hero,unit===sim.statue?damage*rank.buildingFactor:damage);
  }
  sim.effect('blizzard',center,1);
}

function completeTeleport(sim,channel){
  const h=sim.hero;
  const dest=[sim.statue,...sim.allies].find(a=>a.id===channel.targetId&&living(a));
  if(!dest){sim.message='传送目标已消失。';return;}
  const nearby=sim.allies.filter(a=>a!==dest&&living(a)&&a.ownerId===h.id&&distance(h,a)<=700).slice(0,24);
  const from=point(h);
  const landing=sim.nearestOpen({x:dest.x+64,y:dest.y});
  const move=(unit,pos)=>{Object.assign(unit,pos,{goal:null,path:[],waypoint:0,targetId:null,moving:false});};
  for(const a of nearby){
    const final=sim.nearestOpen({x:landing.x+a.x-from.x,y:landing.y+a.y-from.y});
    move(a,final);a.home=point(final);
  }
  move(h,landing);sim.effect('teleport',from,.65,h);
  sim.message='大法师已传送至'+(dest.name||'友军')+'附近。';
}

export function tickAbilities(sim,dt){
  const h=sim.hero;
  if(!h||!Number.isFinite(dt)||dt<=0||sim.paused)return;
  for(let i=sim.allies.length-1;i>=0;i--){
    const ally=sim.allies[i];
    if(!ally.summoned)continue;
    if(!living(ally)||ally.expiresAt<=sim.time){sim.allies.splice(i,1);continue;}
    if(living(h)&&distance(h,ally.home)>150)ally.home=point(h);
  }
  for(const enemy of sim.enemies)if(enemy.heroSlows)applySpeed(enemy,sim.time);
  if(h.avatar&&(!living(h)||h.avatar.until<=sim.time)){delete h.avatar;recalculate(sim);}
  if(!living(h)){h.channel=null;return;}
  if(h.rawcode==='Hamg'){
    const aura=rankOf(sim,'AHab');
    if(aura)for(const a of [h,...sim.allies]){
      if(living(a)&&a.maxMana>0&&distance(h,a)<=aura.radius)a.mana=Math.min(a.maxMana,a.mana+aura.value*dt);
    }
  }
  const channel=h.channel;
  if(!channel)return;
  if(sim.order||h.stunnedUntil>sim.time){h.channel=null;return;}
  if(sim.time+1e-8<channel.nextAt)return;
  if(channel.id==='A004'){completeTeleport(sim,channel);h.channel=null;return;}
  while(channel.remaining>0 && channel.nextAt<=sim.time+1e-8 && living(h)){
    blizzardPulse(sim,channel);
    channel.remaining--;channel.nextAt++;
  }
  if(!channel.remaining||!living(h))h.channel=null;
}

export function onHeroHit(sim,attacker,target){
  if(attacker!==sim.hero||target.type!=='enemy'||!vulnerable(target))return;
  if(attacker.rawcode==='Hamg'&&attacker.frostEnabled){
    const frost=rankOf(sim,'ANfa');
    if(!frost||attacker.mana<frost.mana)return;
    attacker.mana-=frost.mana;
    slow(sim,target,frost,'ANfa');sim.damage(target,attacker,frost.value);
    sim.effect('frost',attacker,.4,target);
  }else if(attacker.rawcode==='Hmkg'){
    const bash=rankOf(sim,'AHbh');
    if(!bash || sim.random()*100>=bash.chance)return;
    stun(sim,target,bash);sim.damage(target,attacker,bash.value);
    sim.effect('storm',target,.32);
  }
}
