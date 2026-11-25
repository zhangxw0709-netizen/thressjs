import {buildWaveDefinitions} from './waves.mjs';
// Fields omitted from an object override come from its base Warcraft object.
// Keep the supported item behaviours explicit so shops never sell inert items.
export function chapterData(game, objects) {
  const db = Object.fromEntries(Object.values(objects).flatMap(group =>
    [...group.原生覆盖, ...group.新增对象].map(o => [o.id, o])));
  const field = (id,key,rank=0) => db[id]?.modifications.find(m =>
    m.field===key && (m.level??0)===rank)?.value;
  const first=(id,key,fallback)=>field(id,key,1)??fallback;
  const heal=first('AIh1','Ihpg',500), mana=first('AIm2','Impg',800);
  const recovery={heal:first('AIre','Ihps',2000),mana:first('AIre','Imps',800)};
  const itemDefinitions={
    pghe:['大生命药水','consumable',{heal}], pgma:['大魔法药水','consumable',{mana}],
    ankh:['重生十字章','revive',{}],
    I000:['','consumable',{heal}], I001:['','consumable',{mana}], I002:['','consumable',recovery],
    I00D:['','consumable',{heal:first('AIh2','Ihpg',700)}], I00E:['','consumable',{mana}], I00F:['','consumable',recovery],
    I004:['','equipment',{attack:40,armor:10}], I003:['','equipment',{attack:55,speed:60}],
    I006:['','equipment',{attack:first('A005','Iatt',100),haste:first('AIsx','Isx1',.1)}],
    srtl:['瑟拉思尔','equipment',{attack:2*first('A005','Iatt',100),haste:first('A006','Isx1',.3)}],
    hlst:['医疗石','consumable',{heal:first('AIh2','Ihpg',700),regen:first('Arel','Ihpr',4)}],
    mnst:['魔法石','consumable',{mana:500,manaRegen:.5}],
    I007:['','equipment',{armor:10,spellResistance:.33}],
    I00I:['','tome',{strength:first('A00T','Istr',50),agility:first('A00T','Iagi',50),intelligence:first('A00T','Iint',50)}],
    texp:['经验之书','tome',{xp:200}], tstr:['力量之书','tome',{strength:1}],
    tdex:['敏捷之书','tome',{agility:1}], tint:['智力之书','tome',{intelligence:1}],
    I009:['','tome',{strength:first('A00M','Istr',50)}], I00K:['','tome',{agility:first('A00O','Iagi',50)}],
    I00J:['','tome',{intelligence:first('A00N','Iint',50)}], I00L:['','tome',{health:first('A00P','Ilif',500)}],
  };
  const labels={heal:'使用恢复生命',mana:'使用恢复魔法',attack:'攻击',armor:'护甲',speed:'移动速度',haste:'攻击速度',regen:'携带时每秒回血',manaRegen:'携带时魔法回复速度',spellResistance:'法术减伤',xp:'经验',strength:'力量',agility:'敏捷',intelligence:'智力',health:'生命上限'};
  const catalog=[];
  for(const shop of game.有显式销售清单的预放商店及佣兵营) {
    for(const id of shop.物品ID列表) {
      if(!itemDefinitions[id]) continue;
      const [fallback,kind,bonus]=itemDefinitions[id];
      const price=field(id,'igol');
      if(!Number.isFinite(price)) throw Error('商品缺少价格 '+id);
      const description=kind==='revive'?'阵亡时自动消耗，在原地复活。':
        Object.entries(bonus).map(([k,v])=>labels[k]+' +'+(['haste','manaRegen','spellResistance'].includes(k)?Math.round(v*100)+'%':v)).join(' · ');
      catalog.push({id,name:db[id]?.nameOverride||fallback,shopId:shop.单位ID,kind,bonus,description,price,
        charges:field(id,'iuse')||1,maxStock:field(id,'isto'),restockSeconds:field(id,'istr')});
    }
  }
  const skills=[
    ['AHhb','神圣之光','Hhb1','治疗友军'],
    ['Aamk','属性附加','Istr','增加三项属性'],
    ['A00I','神圣武器','nca1','近战攻击溅射'],
    ['AHad','专注光环','Had1','附近友军护甲'],
    ['A001','圣光盾','Uts3','提高护甲，减轻近战伤害'],
  ].map(([id,name,key,description])=>{
    const max=field(id,'alev')??3;
    const ranks=Array.from({length:max},(_,i)=>({
      value:field(id,key,i+1)??0, radius:field(id,'aare',i+1)??900,
      reduction:field(id,'Uts2',i+1)??1,
    }));
    return {id,name,description,ranks,minLevel:field(id,'arlv')??1,skip:field(id,'alsk')||Number(game.全局游戏常量覆盖.HeroAbilityLevelSkip)};
  });
  const waves=buildWaveDefinitions(game,objects);
  return {catalog,skills,waves,maxHeroLevel:Number(game.全局游戏常量覆盖.MaxHeroLevel),xpFactor:game.开局.经验倍率百分比/100};
}
