const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

// Order follows the World Editor defense classes.
const defenses = ['small','medium','large','fort','normal','hero','divine','none'];
const attackFactors = {
  normal:[1,1.5,1,.7,1,1,.05,1], pierce:[2,.75,1,.35,1,.5,.05,1.5],
  magic:[1.25,.75,2,.5,1,1,.4,1], spells:[1,1,1,1,1,.7,.05,1],
  hero:[1,1,1,.5,1,.8,.1,1], chaos:[1,1,1,1,1,.75,.5,1],
};

export function weaponFactor(attacker,target) {
  const attack=attacker.weapon?.attackType??(attacker.type==='statue'?'spells':'hero');
  const defense=target.weapon?.defense??(target.type==='statue'?'fort':'hero');
  return attackFactors[attack]?.[defenses.indexOf(defense)]??1;
}

export function enemyAdvance(sim,enemy,destination,dt,stop=8) {
  if(!enemy.flying) return sim.move(enemy,destination,dt,stop);
  const d=distance(enemy,destination);
  if(d<=stop) return true;
  const step=Math.min(d-stop,enemy.speed*dt);
  enemy.angle=Math.atan2(destination.y-enemy.y,destination.x-enemy.x);
  enemy.x+=step*Math.cos(enemy.angle);enemy.y+=step*Math.sin(enemy.angle);
  enemy.moving=true;
  return d-step<=stop;
}

function mirrorImages(sim,boss) {
  const spell=boss.spells;
  boss.mana-=spell.mirrorCost;
  boss.mirrorAt=sim.time+spell.mirrorCooldown;
  for(let i=0;i<spell.mirrors;i++) {
    const angle=2*Math.PI*(i+1)/(spell.mirrors+1)+boss.angle;
    const pos=sim.nearestOpen({x:boss.x+65*Math.cos(angle),y:boss.y+65*Math.sin(angle)});
    sim.enemies.push({...boss,...pos,id:boss.id+'-image-'+(++sim.sequence),boss:false,
      illusion:true,ownerId:boss.id,name:boss.name+'镜像',food:0,spells:null,mana:0,
      path:[],goal:null,waypoint:0,bladesUntil:0,expiresAt:sim.time+spell.mirrorDuration,
      damageFactor:spell.mirrorDamage,damageTakenFactor:spell.mirrorDamageTaken});
  }
  sim.effect('mirror',boss,.7);
}

// Cast decisions use the browser AI. Durations, damage, mana, learned ranks
// and mirror damage factors come from the map merged with its base records.
export function tickBlademaster(sim,boss,target,defenders,dt) {
  const s=boss.spells;
  if(boss.bladesUntil>sim.time) {
    if(target && distance(boss,target)>boss.range) enemyAdvance(sim,boss,target,dt,boss.range);
    for(const defender of defenders) {
      if(defender.hp<=0 || defender.flying || defender.avatar?.until>sim.time ||
          distance(boss,defender)>s.stormRadius) continue;
      sim.spellDamage(defender,boss,s.stormDamage*dt*(defender.type==='statue'?1:.7));
    }
    return true;
  }
  boss.magicImmune=false;
  if(!target || boss.stunnedUntil>sim.time) return false;
  if(distance(boss,target)<=s.stormRadius && boss.mana>=s.stormCost && boss.stormAt<=sim.time) {
    boss.mana-=s.stormCost;boss.stormAt=sim.time+s.stormCooldown;
    boss.bladesUntil=sim.time+s.stormDuration;boss.magicImmune=true;
    sim.effect('bladestorm',boss,s.stormDuration);
    return true;
  }
  if(boss.mana>=s.mirrorCost && boss.mirrorAt<=sim.time &&
      !sim.enemies.some(e=>e.ownerId===boss.id && e.hp>0)) mirrorImages(sim,boss);
  return false;
}
