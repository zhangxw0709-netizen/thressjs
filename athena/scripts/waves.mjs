// Warcraft's 1.24.4 Custom unit defaults, used only for fields the map inherits.
// https://github.com/sumneko/w3x2lni/tree/master/data/zhCN-1.24.4/prebuilt/Custom
// Name, range, speed, attack interval, base, dice, sides, armor, armor class,
// attack type, food, bounty dice. The map overrides these in buildWaveDefinitions.
const inherited = {
  nftr: ['森林巨魔',500,270,1.6,16,1,4,0,'large','pierce',2,1],
  nogr: ['食人鬼战士',100,270,1.35,13,1,2,1,'large','normal',2,1],
  nkog: ['狗头人占卜者',600,270,1.8,22,1,5,0,'medium','pierce',2,1],
  nfrb: ['熊怪追踪者',100,320,1.35,28,1,5,2,'large','normal',5,4],
  nsel: ['海元素',600,220,1.8,27,1,10,2,'medium','pierce',4,3],
  ndmu: ['达拉然之变种怪物',90,270,1.3,10,2,2,0,'large','normal',2,6],
  nrvl: ['闪电幽魂',128,270,1.35,28,1,5,2,'medium','normal',5,4],
  nepl: ['灾祸树人',100,270,1.35,31,1,5,1,'large','normal',4,3],
  Hlgr: ['加里瑟斯',100,270,2.2,0,2,6,2,'hero','hero',0,8],
  nfpe: ['北极熊怪萨满长者',600,320,1.8,30,1,9,3,'large','chaos',6,6],
  nlkl: ['马库拉潮汐领主',100,270,1.35,38,1,6,6,'large','chaos',6,5],
  nane: ['阿卡那瑟德掘地者',500,270,1.6,23,1,6,2,'medium','pierce',3,2],
  ntrd: ['龙龟',128,270,1.35,64,1,19,4,'large','chaos',8,8],
  nsgb: ['深海巨兽',100,200,1.35,42,1,7,0,'large','chaos',6,6],
  nsoc: ['兽族战士骷髅',100,270,1.35,48,1,7,2,'large','chaos',6,6],
  nhrh: ['女妖风暴巫师',500,350,1.8,27,1,10,1,'large','pierce',4,3],
  nfra: ['熊怪乌萨战士',100,320,1.35,48,1,7,4,'large','chaos',6,6],
  Nbbc: ['黑石氏族剑圣',100,320,1.77,0,2,12,0,'hero','hero',0,8],
};

export function buildWaveDefinitions(game,objects) {
  const units=new Map(objects.单位.原生覆盖.map(o=>[o.id,Object.fromEntries(o.modifications.map(m=>[m.field,m.value]))]));
  const skills=new Map(objects.技能.原生覆盖.map(o=>[o.id,o.modifications]));
  const skill=(id,field,rank,fallback)=>skills.get(id)?.find(m=>m.field===field&&m.level===rank)?.value??fallback;
  return game.进攻.兵种表.slice(0,18).map(entry=>{
    const type=entry.兵种ID, u=units.get(type), event=entry.入场触发;
    const [name,range,speed,interval,base,dice,sides,armor,defense,attack,food,bountyDice]=inherited[type];
    const level=event?.入场设置等级??u.ulev??(type==='nhrh'?5:1);
    const blade=type==='Nbbc', boss=!!event;
    const str=boss?Math.floor(u.ustr+(level-1)*(blade?2:2.7)):0;
    const agi=boss?Math.floor(u.uagi+(level-1)*(blade?1.75:1.5)):0;
    const intel=boss?Math.floor(u.uint+(level-1)*(blade?2.25:1.8)):0;
    let spells=null;
    if(type==='Hlgr') spells={heal:skill('AHhb','Hhb1',2,1200),shock:skill('AOsh','Osh1',2,540),shockCost:skill('AOsh','amcs',2,110)};
    if(blade) spells={
      critChance:skill('AOcr','Ocr1',3,15)/100,critFactor:skill('AOcr','Ocr2',3,4),
      mirrors:skill('AOmi','Omi1',3,3),mirrorCost:skill('AOmi','amcs',3,125),
      mirrorDuration:skill('AOmi','adur',3,60),mirrorDamage:skill('AOmi','Omi2',3,0),
      mirrorDamageTaken:skill('AOmi','Omi3',3,2),mirrorCooldown:skill('AOmi','acdn',3,3),
      stormDamage:skill('AOww','Oww1',1,110),stormRadius:skill('AOww','aare',1,200),
      stormDuration:skill('AOww','adur',1,7),stormCost:skill('AOww','amcs',1,200),
      stormCooldown:skill('AOww','acdn',1,180),
    };
    return {number:entry.波次,type,name:entry.地图改名||name,perLane:entry.每路数量,boss,bossLevel:event?.入场设置等级??0,level,spells,
      hp:u.uhpm+str*35,mana:boss?intel*10:(u.umpm??0),speed:u.umvs??speed,range:u.ua1r??range,
      armor:(u.udef??armor)+(boss?5+.25*agi:0),defense:u.udty??defense,attackType:u.ua1t??attack,
      attackBase:(u.ua1b??base)+(boss?(blade?agi:str)*Number(game.全局游戏常量覆盖.StrAttackBonus):0),attackDice:u.ua1d??dice,attackSides:u.ua1s??sides,
      interval:u.ua1c??interval,haste:boss?1+agi*.02:1,food:u.ufoo??food,radius:u.ucol??(boss?32:16),
      bounty:u.ubba??0,bountyDice:u.ubdi??bountyDice,bountySides:u.ubsi??3,
      flying:type==='nhrh',undead:type==='nsoc',magicImmune:(u.uabi??'').split(',').includes('Amim')};
  });
}
