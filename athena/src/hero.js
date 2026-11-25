export function initializeHero(sim) {
  const h=sim.hero;
  Object.assign(h,{level:1,xp:0,xpNext:200,skillPoints:1,ranks:{},
    training:{strength:0,agility:0,intelligence:0,health:0}});
  sim.inventory[0]={id:'ankh',charges:1};
  sim.inventory[1]={id:'pghe',charges:1};
  recalculate(sim);
  h.hp=h.maxHp; h.mana=h.maxMana;
}

export function skillInfo(sim, id, rank=sim.hero?.ranks[id]||0) {
  return sim.heroDefinition.skills.find(s=>s.id===id)?.ranks[rank-1];
}

export function recalculate(sim) {
  const h=sim.hero, def=sim.heroDefinition, s=sim.stats[h.rawcode]||{}, defaults=def.base;
  const gear={attack:0,armor:0,haste:0,speed:0,regen:0,manaRegen:0};
  h.spellResistance=0;
  for (const slot of sim.inventory) {
    if (!slot) continue;
    const item=sim.itemTypes.get(slot.id);
    for (const key of Object.keys(gear)) gear[key]+=item?.bonus[key]||0;
    h.spellResistance=Math.max(h.spellResistance,item?.bonus.spellResistance||0);
  }
  const bonus=skillInfo(sim,'Aamk')?.value||0;
  const attr=(base,growth,training)=>Math.floor(base+(h.level-1)*growth)+bonus+h.training[training];
  h.strength=attr(s.ustr??defaults.strength,s.ustp??defaults.strGrowth??3,'strength');
  h.agility=attr(s.uagi??defaults.agility,s.uagp??defaults.agiGrowth??2,'agility');
  h.intelligence=attr(s.uint??defaults.intelligence,s.uinp??defaults.intGrowth??2,'intelligence');
  const maxHp=(s.uhpm??1200)+h.strength*35+h.training.health+(h.avatar?.health||0), maxMana=h.intelligence*10;
  if (h.hp>0) h.hp=Math.min(maxHp,h.hp+Math.max(0,maxHp-h.maxHp));
  h.mana=Math.min(maxMana,h.mana+Math.max(0,maxMana-h.maxMana));
  h.maxHp=maxHp;h.maxMana=maxMana;
  h.attackBase=(s.ua1b??50)+h[def.primary]*sim.map.attackPerPrimary+gear.attack+(h.avatar?.damage||0);
  h.armor=(s.udef??5)+5+h.agility*.25+gear.armor+(skillInfo(sim,'A001')?.value||0)+(skillInfo(sim,'AHad')?.value||0)+(h.avatar?.armor||0);
  h.haste=1+h.agility*.02+gear.haste;
  h.speed=(s.umvs??defaults.speed)+gear.speed;
  h.healthRegen=h.strength*.08+gear.regen;
  h.manaRegen=h.intelligence*.05*(1+gear.manaRegen);
}

export function gainXp(sim,amount) {
  const h=sim.hero,max=sim.map.maxHeroLevel;
  if (!h || h.level>=max || amount<=0) return;
  h.xp+=amount;
  const was=h.level;
  while(h.level<max && h.xp>=h.xpNext) {
    h.xp-=h.xpNext; h.level++; h.skillPoints++;
    h.xpNext=(h.level+1)*100;
  }
  if(h.level===max){h.xp=0;h.xpNext=0;}
  if(h.level!==was) {
    recalculate(sim);
    sim.effect('revive',h,1);
    sim.message=h.name+'升至 '+h.level+' 级，可在技能面板分配技能点。';
  }
}

export function learnSkill(sim,id) {
  const s=sim.heroDefinition.skills.find(skill=>skill.id===id);
  if (!s) return false;
  const h=sim.hero,rank=h.ranks[id]||0;
  if(!h.skillPoints || rank>=s.ranks.length || h.level<s.minLevel+rank*s.skip)
    return sim.hint('当前等级或技能点不足。');
  h.skillPoints--;
  h.ranks[id]=rank+1;
  recalculate(sim);
  sim.message=s.name+' 已提升至 '+(rank+1)+' 级。';
  return true;
}
