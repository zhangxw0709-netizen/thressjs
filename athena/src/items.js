import {gainXp,recalculate} from './hero.js';

export function countCharges(sim,predicate) {
  return sim.inventory.reduce((sum,slot)=>sum+(slot&&predicate(sim.itemTypes.get(slot.id))?slot.charges:0),0);
}
export function removeCharge(sim,slot) {
  if(--sim.inventory[slot].charges===0) sim.inventory[slot]=null;
  recalculate(sim);
}
export function itemStock(sim,item) {
  if(!item.maxStock || !item.restockSeconds) return null;
  const state=sim.stock.get(item.id);
  if(!state) return {count:item.maxStock,next:Infinity};
  if(sim.time>=state.next) {
    const replenished=1+Math.floor((sim.time-state.next)/item.restockSeconds);
    state.count=Math.min(item.maxStock,state.count+replenished);
    state.next=state.count===item.maxStock?Infinity:state.next+replenished*item.restockSeconds;
  }
  return state;
}
export function buyItem(sim,id,shopId,complete=false) {
  const item=sim.itemTypes.get(id);
  if(!item || (shopId && item.shopId!==shopId)) return sim.hint('这家商店没有出售该物品。');
  const shop=sim.map.shops.find(s=>s.id===item.shopId);
  if(!shop || sim.gold<item.price) return sim.hint('金币不足或商店不可用。');
  const slot=sim.inventory.indexOf(null);
  const stock=itemStock(sim,item);
  if(stock && stock.count===0) return sim.hint('商店正在补货。');
  if(item.kind!=='tome' && slot<0) return sim.hint('六格背包已满。请先使用或出售物品。');
  if(item.bonus.xp && sim.hero.level>=sim.map.maxHeroLevel) return sim.hint('英雄已达到等级上限。');
  if(Math.hypot(sim.hero.x-shop.x,sim.hero.y-shop.y)>400) {
    if(complete) return false;
    if(!sim.route(sim.hero,shop).length) return sim.hint('无法抵达这家商店。');
    sim.order={type:'trade',shop,action:'buy',id};
    sim.message='前往'+shop.name+'购买'+item.name+'。';return true;
  }
  sim.order=null;
  sim.gold-=item.price;
  if(stock) {
    if(stock.count===item.maxStock)stock.next=sim.time+item.restockSeconds;
    stock.count--;sim.stock.set(item.id,stock);
  }
  if(item.kind==='tome') {
    const h=sim.hero;
    for(const [key,value] of Object.entries(item.bonus)) {
      if(key==='xp') gainXp(sim,value);
      else h.training[key]+=value;
    }
  } else sim.inventory[slot]={id,charges:item.charges};
  recalculate(sim);
  sim.message='已购入'+item.name+(item.kind==='tome'?'，立即生效。':item.kind==='equipment'?'，已装备。':'。');
  return true;
}
export function salePrice(item,charges) {
  return Math.floor(item.price*.5*charges/item.charges);
}
export function sellItem(sim,index,shopId,expected) {
  const slot=sim.inventory[index];
  if(!slot || (expected && slot!==expected)) return sim.hint('该背包格的物品已变更。');
  const shop=sim.map.shops.find(s=>s.id===(shopId||sim.shop.id));
  if(!shop||!sim.map.catalog.some(i=>i.shopId===shop.id)) return false;
  if(Math.hypot(sim.hero.x-shop.x,sim.hero.y-shop.y)>400) {
    if(!sim.route(sim.hero,shop).length) return sim.hint('无法抵达这家商店。');
    sim.order={type:'trade',shop,action:'sell',slot:index,expected:slot};
    sim.message='前往'+shop.name+'出售物品。';return true;
  }
  const item=sim.itemTypes.get(slot.id),price=salePrice(item,slot.charges);
  sim.gold+=price;sim.inventory[index]=null;sim.order=null;recalculate(sim);
  sim.message='已出售'+item.name+'，获得 '+price+' 金。';return true;
}
export function useItem(sim,index) {
  const slot=sim.inventory[index];
  const item=slot&&sim.itemTypes.get(slot.id);
  if(!item || item.kind!=='consumable') return sim.hint('该物品没有主动使用效果。');
  if(sim.cooldowns.potion>0) return sim.hint('药水正在冷却。');
  const h=sim.hero,b=item.bonus;
  if(!(b.heal && h.hp<h.maxHp) && !(b.mana && h.mana<h.maxMana))
    return sim.hint('相应的生命或魔法已经回满。');
  h.hp=Math.min(h.maxHp,h.hp+(b.heal||0));h.mana=Math.min(h.maxMana,h.mana+(b.mana||0));
  removeCharge(sim,index);sim.cooldowns.potion=30;sim.effect('heal',h,.8);
  sim.message='已使用'+item.name+'。';return true;
}
