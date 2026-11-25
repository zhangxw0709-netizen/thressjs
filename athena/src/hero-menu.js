import {itemStock,salePrice} from './items.js';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(key,id,label,disabled=false)=>'<button data-sheet="'+key+'" data-value="'+escape(id)+'"'+(disabled?' disabled':'')+'>'+escape(label)+'</button>';
const kinds={consumable:'消耗品',tome:'购买即读',equipment:'装备',revive:'阵亡时生效'};
const names={skills:'英雄技能',shop:'驻地商店',bag:'六格背包'};
const stat=(s,v)=>'<span>'+s+' <b>'+v+'</b></span>';
function rankSummary(skill, rank) {
  const data=skill.ranks[rank-1];
  if (data.text) return data.text;
  if (skill.id==='A00I') return '范围 '+data.radius+'，溅射 '+Math.round(data.value*100)+'%';
  if (skill.id==='A001') return '护甲 +'+data.value+'，近战减伤 '+Math.round((1-data.reduction)*100)+'%';
  return skill.description+(data.value==null?'':' +'+data.value);
}

export class HeroMenu {
  constructor(ui) {
    this.ui=ui;this.page=null;this.shopId=null;this.selected=0;
    document.addEventListener('click',event=>{
      const b=event.target.closest('button');
      if(!b || b.disabled) return;
      if(b.dataset.panel) this.open(b.dataset.panel);
      else if(b.dataset.sheet) this.action(b.dataset.sheet,b.dataset.value);
    });
  }
  open(page,shopId) {
    const sim=this.ui.sim;
    if(!sim?.hero || !['prep','wave'].includes(sim.phase) || this.ui.helpOpen || (sim.paused&&!this.page)) return;
    this.page=page;this.swapping=false;this.shopId=shopId||this.shopId||sim.shop.id;
    if(!sim.paused) this.ui.send('pause');
    this.ui.show('hero-menu',true);this.ui.setModal('hero-menu');
    this.draw();
    document.querySelector('#hero-menu [data-sheet=close]').focus({preventScroll:true});
  }
  close() {
    this.page=null;this.ui.show('hero-menu',false);this.ui.setModal(null);
    if(this.ui.sim.paused) this.ui.send('pause');
    this.ui.ids.world.focus({preventScroll:true});
  }
  action(action,value) {
    const sim=this.ui.sim;
    if(!this.page) return;
    if(action==='close') return this.close();
    if(action==='merchant') {this.shopId=value;return this.draw();}
    if(action==='swap') {this.swapping=true;return this.draw('请选择目标格进行交换。');}
    if(action==='slot') {
      const dest=Number(value);
      if(this.swapping){sim.command('pause');sim.command('swapItems',{from:this.selected,to:dest});sim.command('pause');this.swapping=false;}
      this.selected=dest;return this.draw();
    }
    const commands={
      buy:['buy',{item:value,shopId:this.shopId}],learn:['learn',{id:value}],
      use:['useItem',{slot:this.selected}],sell:['sellItem',{slot:this.selected,shopId:this.shopId}],
    };
    const cmd=commands[action];if(!cmd) return;
    // Panel interaction is atomic; pause and resume do not advance a simulation tick.
    sim.command('pause');sim.command(...cmd);
    if(sim.order?.type==='trade' && (action==='sell'||action==='buy')) {
      this.page=null;this.ui.show('hero-menu',false);this.ui.setModal(null);
      this.ui.ids.world.focus({preventScroll:true});
    } else {sim.command('pause');this.draw(sim.message);}
    this.ui.render(sim);
  }
  draw(notice='') {
    const sim=this.ui.sim,h=sim.hero,d=this.ui.ids;
    this.ui.setText('hero-sheet-title',names[this.page]);
    this.ui.setText('sheet-summary',h.name+' Lv.'+h.level+'　·　'+sim.gold.toLocaleString()+' 金');
    for(const el of d['hero-menu'].querySelectorAll('[data-panel]')) el.setAttribute('aria-pressed',String(el.dataset.panel===this.page));
    const stats='<div class="character-stats">'+[
      stat('力量',h.strength),stat('敏捷',h.agility),stat('智力',h.intelligence),
      stat('基础攻击',Math.round(h.attackBase)),stat('护甲',h.armor.toFixed(1)),
    ].join('')+'</div>';
    if(this.page==='skills') {
      const rows=(sim.heroDefinition?.skills || sim.map.skills).map(s=>{
        const rank=h.ranks[s.id]||0,total=s.ranks.length,need=s.minLevel+rank*s.skip;
        const done=rank>=total;
        const details=[];
        if(rank) details.push('当前 '+rank+' 级 · '+rankSummary(s,rank));
        if(!done) details.push((rank?'下一级':'学习后')+' · '+rankSummary(s,rank+1));
        const label=done?'已满级':need>h.level?'需 '+need+' 级':rank?'提升':'学习';
        return '<article><div><strong>'+escape(s.name)+'</strong><small>'+rank+' / '+total+'</small>'+details.map(text=>'<p>'+escape(text)+'</p>').join('')+'</div>'+
          button('learn',s.id,label,done||h.skillPoints<1||need>h.level||h.hp<=0)+'</article>';
      }).join('');
      d['sheet-content'].innerHTML=stats+'<div class="sheet-meta">经验 '+h.xp+' / '+h.xpNext+'　·　可用技能点 '+h.skillPoints+'</div><div class="shop-grid">'+rows+'</div>';
    } else if(this.page==='shop') {
      const merchants=sim.map.shops.filter(s=>sim.map.catalog.some(i=>i.shopId===s.id));
      if(!merchants.some(s=>s.id===this.shopId))this.shopId=sim.shop.id;
      const tabs=merchants.map(s=>'<button aria-pressed="'+(s.id===this.shopId)+'" data-sheet="merchant" data-value="'+escape(s.id)+'">'+escape(s.name)+'</button>').join('');
      const full=sim.inventory.every(Boolean);
      const rows=sim.map.catalog.filter(i=>i.shopId===this.shopId).map(i=>{
        const stock=itemStock(sim,i);
        const disabled=h.hp<=0||sim.gold<i.price||(full&&i.kind!=='tome')||stock?.count===0;
        return '<article><div><small>'+kinds[i.kind]+(i.charges>1?' · '+i.charges+' 次':'')+(stock?' · 库存 '+stock.count:'')+'</small><strong>'+escape(i.name)+'</strong><p>'+escape(i.description)+'</p></div>'+
          button('buy',i.id,i.price+' 金',disabled)+'</article>';
      }).join('');
      d['sheet-content'].innerHTML='<div class="merchant-tabs">'+tabs+'</div><div class="shop-grid">'+rows+'</div>';
      notice||='选择商品后，英雄会前往对应商店，到店时扣款。背包 '+sim.inventory.filter(Boolean).length+' / 6 格。';
    } else {
      const slots=sim.inventory.map((slot,n)=>{
        const i=slot&&sim.itemTypes.get(slot.id);
        return '<button class="bag-slot" aria-pressed="'+(n===this.selected)+'" data-sheet="slot" data-value="'+n+'"><small>格 '+(n+1)+'</small><strong>'+escape(i?.name||'空位')+'</strong><span>'+(i?(i.kind==='equipment'?'已装备':slot.charges+' 次'):'')+'</span></button>';
      }).join('');
      const slot=sim.inventory[this.selected],i=slot&&sim.itemTypes.get(slot.id);
      const detail=i?'<div class="item-detail"><strong>'+escape(i.name)+'</strong><p>'+escape(i.description)+'</p>'+
        (i.kind==='consumable'?button('use','',sim.cooldowns.potion>0?'冷却中':'使用一次',h.hp<=0||sim.cooldowns.potion>0):'')+
        button('swap','','换位',h.hp<=0)+button('sell','','出售 · '+salePrice(i,slot.charges)+' 金',h.hp<=0)+'</div>':'';
      d['sheet-content'].innerHTML=stats+'<div class="bag-slots">'+slots+'</div>'+detail;
      notice||='装备随携带生效。消耗品可用数字 1–6 使用，出售时自动前往商店。';
    }
    this.ui.setText('sheet-notice',notice||'升级获得技能点。选择技能后立即生效。');
  }
}
