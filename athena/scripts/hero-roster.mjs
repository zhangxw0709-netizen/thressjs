// Warcraft base values for properties absent from the editor overrides:
// https://classic.battle.net/war3/human/units/archmage.shtml
// https://classic.battle.net/war3/human/units/mountainking.shtml
// https://classic.battle.net/war3/human/units/waterelemental.shtml
// https://classic.battle.net/war3/neutral/nagaseawitch.shtml
export function buildRoster(game, objects, paladinSkills) {
  const rows = Object.values(objects).flatMap(group => [...group.原生覆盖, ...group.新增对象]);
  const db = new Map(rows.map(obj => [obj.id, obj]));
  function read(id, key, level, stock) {
    const mod = db.get(id)?.modifications.find(m => m.field === key && (m.level ?? 0) === level);
    return mod?.value ?? (Array.isArray(stock) ? stock[Math.min(Math.max(level-1,0),stock.length-1)] : stock);
  }
  const skip = Number(game.全局游戏常量覆盖.HeroAbilityLevelSkip);
  function skill(id, name, description, stockLevels, fields, format) {
    const max = read(id,'alev',0,stockLevels);
    return {id, name, description, minLevel:read(id,'arlv',0,1), skip:read(id,'alsk',0,skip)||skip,
      ranks:Array.from({length:max},(_,i)=>{
        const rank=Object.fromEntries(Object.entries(fields).map(([key,[field,base]])=>[key,read(id,field,i+1,base)]));
        rank.text=format(rank);
        return rank;
      })};
  }
  const blizzard=skill('AHbz','暴风雪','持续施法，在指定区域落下冰片。移动会打断引导，冰片会伤及友军。',3,{
    value:['Hbz2',[30,40,50]], pulses:['Hbz1',[6,8,10]], radius:['aare',200], mana:['amcs',75],
    cooldown:['acdn',6], range:['aran',800], cap:['Hbz6',[150,200,250]], buildingFactor:['Hbz4',.5],
  },r=>r.pulses+' 波，每波每目标 '+r.value+' 伤害，每波合计上限 '+r.cap+'，半径 '+r.radius+'，耗魔 '+r.mana+'。');
  const elemental=skill('AHwe','召唤水元素','召唤能吸引火力的远程水元素，跟随大法师作战。',3,{
    unit:['Hwe1',['hwat','hwt2','hwt3']],value:['Hwe2',1],duration:['adur',60],mana:['amcs',125],cooldown:['acdn',20],
  },r=>r.value+' 个水元素，持续 '+r.duration+' 秒，耗魔 '+r.mana+'。');
  for(const r of elemental.ranks){
    r.health=read(r.unit,'uhpm',0,525);r.attack=read(r.unit,'ua1b',0,20);r.armor=read(r.unit,'udef',0,0);
    r.range=read(r.unit,'ua1r',0,300);r.speed=read(r.unit,'umvs',0,220);
  }
  const brilliance=skill('AHab','辉煌光环','提高自身和附近友军的魔法回复。',3,{
    value:['Hab1',[.75,1.5,2.25]],radius:['aare',900],
  },r=>'半径 '+r.radius+' 内每秒额外回复 '+r.value+' 魔法。');
  const frost=skill('ANfa','霜冻攻击','切换自动施放。普通攻击消耗魔法，附带伤害并降低敌人速度。',3,{
    value:['Hca1',[5,10,15]],moveSlow:['Hca2',[.3,.5,.7]],attackSlow:['Hca3',[.3,.5,.7]],
    duration:['adur',5],heroDuration:['ahdu',1.5],mana:['amcs',10],
  },r=>'每击额外 '+r.value+' 伤害，移动减速 '+Math.round(r.moveSlow*100)+'%，每击耗魔 '+r.mana+'。');
  const bolt=skill('AHtb','风暴之锤','向敌人投掷战锤并将其击晕。',3,{
    value:['Htb1',[100,225,350]],range:['aran',600],duration:['adur',5],heroDuration:['ahdu',3],mana:['amcs',75],cooldown:['acdn',9],
  },r=>r.value+' 伤害，眩晕 '+r.duration+' 秒（首领 '+r.heroDuration+' 秒），耗魔 '+r.mana+'。');
  const clap=skill('AHtc','雷霆一击','震击周围敌人，降低其移动和攻击速度。',3,{
    value:['Htc1',[60,100,140]],radius:['aare',[250,300,350]],moveSlow:['Htc3',.5],attackSlow:['Htc4',.5],
    duration:['adur',5],heroDuration:['ahdu',3],mana:['amcs',90],cooldown:['acdn',6],
  },r=>'半径 '+r.radius+'，伤害 '+r.value+'，减速 '+r.duration+' 秒，耗魔 '+r.mana+'。');
  const bash=skill('AHbh','重击','每次普通攻击有机会击晕目标并造成额外伤害。',3,{
    value:['Hbh3',25],chance:['Hbh1',[20,30,40]],duration:['adur',2],heroDuration:['ahdu',1],
  },r=>r.chance+'% 概率造成 '+r.value+' 额外伤害并眩晕 '+r.duration+' 秒。');
  const avatar=skill('AHav','天神下凡','暂时获得魔法免疫，并提升生命上限、护甲和攻击。',1,{
    value:['Hav3',20],armor:['Hav1',5],health:['Hav2',500],duration:['adur',60],mana:['amcs',150],cooldown:['acdn',180],
  },r=>'持续 '+r.duration+' 秒，生命 +'+r.health+'，护甲 +'+r.armor+'，攻击 +'+r.value+'，耗魔 '+r.mana+'。');
  const attribute=paladinSkills.find(s=>s.id==='Aamk');
  const action=(id,name,key,targeting,description,extras={})=>({id,name,key,targeting,description,cooldownKey:id,skillId:id,...extras});
  const taunt=(key)=>action('Atau','嘲讽',key,'self','吸引身边的敌人。',{cooldownKey:'taunt',skillId:null});
  const definitions=[
    {id:'Hpal',name:'圣骑士',role:'支援守护',model:'paladin',primary:'strength',base:{strength:22,agility:13,intelligence:17,range:110,speed:290},skills:paladinSkills,
      actions:[action('AHhb','神圣之光','Q','ally','治疗附近生命较低的守军。',{cooldownKey:'skill'}),taunt('W')]},
    {id:'Hamg',name:'大法师',role:'远程召唤',model:'archmage',primary:'intelligence',base:{strength:15,agility:17,intelligence:19,range:600,speed:320},
      skills:[blizzard,elemental,brilliance,frost,attribute],
      actions:[action('AHbz','暴风雪','Q','point',blizzard.description),action('AHwe','水元素','W','self',elemental.description),
        action('ANfa','霜冻攻击','E','toggle',frost.description),
        action('A004','群体传送','R','friendly','传送到友方单位或女神像，携带身边自己的水元素。',{skillId:null,mana:read('A004','amcs',1,100),cooldown:read('A004','acdn',1,20)})]},
    {id:'Hmkg',name:'山丘之王',role:'近战控制',model:'mountainKing',primary:'strength',base:{strength:24,agility:11,intelligence:15,range:100,speed:270},
      skills:[bolt,clap,bash,avatar,attribute],
      actions:[action('AHtb','风暴之锤','Q','enemy',bolt.description),action('AHtc','雷霆一击','W','self',clap.description),taunt('E'),
        action('AHav','天神下凡','R','self',avatar.description)]},
  ];
  for(const hero of definitions){
    const available=read(hero.id,'uhab',0,'').split(',');
    if(hero.skills.some(s=>!s||!available.includes(s.id)))throw new Error('英雄技能与地图不符 '+hero.id);
    const row=game.选人.英雄列表.find(x=>x.单位ID===hero.id);
    const [x,y]=row.选择区.中心坐标;
    hero.altar={x,y};
    for(const [name,field] of [['strength','ustr'],['agility','uagi'],['intelligence','uint'],['range','ua1r'],['speed','umvs']]){
      hero.base[name]=read(hero.id,field,0,hero.base[name]);
    }
  }
  return definitions;
}
