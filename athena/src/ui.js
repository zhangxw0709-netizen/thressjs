import {HeroMenu} from './hero-menu.js';
// All interface artwork is local. The filled helmet silhouette also appears on the hero portrait.
const helmet = '<path fill="currentColor" stroke="none" d="M5.2 11.8c.2-5 2.8-8.2 6.6-8.6 4.2-.5 7.8 2.7 8.2 7.2l.1 2.3-1.7 4.7-4.5 4.1.5-7.1 3.1-2-4.1.8-1.1 4.1-1.1-4.1-4.1-.8 3.1 2 .5 7.1-4.5-4.1-1.7-4.7z"/><path d="M7.2 8.6c1.1-2.4 3.1-3.6 5.2-3.6M7.5 10.2l2.4.7m7.6-.7-2.4.7" stroke="#665d43" stroke-width=".9"/>';
const icons = {
  helmet,
  staff: '<path d="M6 21 15 6m-3.2.2L15 2l3.6 1.5-.1 5.1-3.6 1.7z"/><path d="m5 4 .5 1.4L7 6l-1.5.6L5 8l-.5-1.4L3 6l1.5-.6z" fill="currentColor"/>',
  hammer: '<path d="m4 18 9-9 2.2 2.2-9 9z" fill="currentColor"/><path d="m10 5 4-3 8.2 8.2-3 4-3.4-1.5-5.2-5.2z"/><path d="m12.8 4.4 6.8 6.9"/>',
  frost: '<path d="M12 2v20M3.4 7l17.2 10M3.4 17l17.2-10M9.6 4.8 12 7l2.4-2.2m-4.8 14.4L12 17l2.4 2.2M4.4 10l3.3-.3L7 6.5m10 11-.7-3.2 3.3-.3m-15.2 0 3.3.3-.7 3.2m10-11-.7 3.2 3.3.3"/>',
  gate: '<path d="M4 21V9a8 8 0 0 1 16 0v12M7 21V9a5 5 0 0 1 10 0v12m-8-6 3-4 3 4-3 4z"/>',
  seal: '<circle cx="12" cy="12" r="10.25" stroke-width=".65"/><circle cx="12" cy="12" r="8.7" stroke-width=".65" stroke-dasharray="1 2"/><g transform="translate(3.7 3.5) scale(.69)">' + helmet + '</g>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 6.9v5.3l3.5 2"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9a2.45 2.45 0 0 1 4.8.6c0 1.8-2.5 2-2.5 4.1m0 2.3v.2"/>',
  pause: '<path d="M8.4 5v14m7.2-14v14" stroke-width="3"/>',
  routes: '<path d="M12 21V6m-3 3 3-4 3 4M12 16c-1-3-4-4-7-5m.6 3.2L4 10l4.5-.6M12 16c1-3 4-4 7-5m-.6 3.2L20 10l-4.5-.6"/>',
  swords: '<path d="m3 3 3.1 1.1 11.4 11.4-1.8 1.8L4.3 5.9zM14.7 18.3l3.9-3.9m-1.8 2.2 3.3 3.3m-1 1 2-2M20.8 3l-3.1 1.1-6 6M7.7 14.4l-1.9 2.1 1.7 1.7 2.2-2.1m-.4 2.3-3.9-3.9m1.8 2.2L4 20m1 1-2-2"/>',
  temple: '<path d="m2 8 10-5 10 5-1 1H3zM4 20h16m-17 2h18M6 10v9m4-9v9m4-9v9m4-9v9"/>',
  focus: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/><circle cx="12" cy="12" r="2"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.3-2 5.6-5.6 2 2-5.6z"/>',
  heart: '<path fill="currentColor" stroke="none" d="M12 20.4 3.8 12a5.1 5.1 0 0 1 7.4-7L12 6l.9-1a5.1 5.1 0 0 1 7.3 7z"/>',
  drop: '<path fill="currentColor" stroke="none" d="M12 2c-.6 4.1-6.4 9-6.4 13a6.4 6.4 0 0 0 12.8 0c0-4-5.8-8.9-6.4-13z"/>',
  coins: '<ellipse cx="9" cy="8" rx="5.8" ry="2.6"/><path d="M3.2 8v3.6c0 1.4 2.6 2.6 5.8 2.6.8 0 1.5-.1 2.2-.2m-8-3v3.2c0 1.4 2.6 2.6 5.8 2.6"/><ellipse cx="15.8" cy="13.5" rx="5.1" ry="2.3"/><path d="M10.7 13.5v3.6c0 1.3 2.3 2.3 5.1 2.3s5.1-1 5.1-2.3v-3.6"/>',
  ankh: '<path d="M12 11c-2.4 0-4.2-2.2-4.2-4.4S9.4 3 12 3s4.2 1.4 4.2 3.6S14.4 11 12 11Zm0 0v10m-5.5-7.8h11" stroke-width="2"/>',
  sun: '<path fill="currentColor" stroke="none" d="m12 4 .9 5.7 4.8-2.1-3 4.1 5.7.8-5.7.9 2.5 3.8-4.3-1.9L12 21l-.9-5.7-4.3 1.9 2.5-3.8-5.7-.9 5.7-.8-3-4.1 4.8 2.1z"/><path d="m4 5 .9 1m13.9 12 .8 1M20 5l-.9 1M4 19l.9-1" stroke-width="1.1"/>',
  shield: '<path d="m12 2 7.5 3v6.2c0 4.6-3 7.4-7.5 10.2-4.5-2.8-7.5-5.6-7.5-10.2V5z"/><path d="m12 5 4.7 1.8v4.7c0 2.9-1.8 5-4.7 7.1z" fill="currentColor" stroke="none"/><path d="M6.8 7.3v3.9" stroke-width=".8"/>',
  potion: '<path d="M9 3h6v2H9zM10 5v3.6c0 1.2-5.2 4.5-5.2 8 0 3.1 2.7 4.4 7.2 4.4s7.2-1.3 7.2-4.4c0-3.5-5.2-6.8-5.2-8V5"/><path d="M6.7 15c2.4 1.2 4-.8 6.3-.1 1.4.5 2.6 1 4.2.5.5 2.3-.8 3.8-5.2 3.8-4.2 0-5.8-1.2-5.3-4.2Z" fill="currentColor" stroke="none"/>',
  pouch: '<path d="m8 3 2.5 1.3L12 3l1.5 1.3L16 3l-2.4 5.2c2.6 2.8 6.5 5.4 6.2 9.1-.2 2.6-3.7 3.7-7.8 3.7s-7.6-1.1-7.8-3.7c-.3-3.7 3.6-6.3 6.2-9.1zM9.5 8h5.2"/><path d="M15 12.2h-3.8a1.4 1.4 0 0 0 0 2.8h1.6a1.4 1.4 0 0 1 0 2.8H9m3-6.7v7.7" stroke-width="1.2"/>',
  restart: '<path d="M4.5 11.5A7.5 7.5 0 1 1 6.7 17m-2.2-5.5V6m0 5.5H10"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
};

const phaseNames = { choose: '英雄选择', prep: '备战', won: '章节完成', lost: '失守' };
const heroIcons = { Hpal: 'helmet', Hamg: 'staff', Hmkg: 'hammer' };
const spellIcons = { AHhb:'sun', Atau:'shield', AHbz:'frost', AHwe:'drop', ANfa:'swords', A004:'gate', AHtb:'hammer', AHtc:'routes', AHav:'helmet' };
const aimHints = {ally:'目标：友军',point:'目标：地面位置',enemy:'目标：敌人',friendly:'目标：友方单位或女神像',self:'直接施放',toggle:'点击切换'};
function setIcon(el, name) {
  if (el.dataset.drawnIcon === name) return;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<svg class="art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">' + icons[name] + '</svg>';
  el.dataset.drawnIcon = name;
}
const number = value => Math.max(0, Math.ceil(value || 0));
const formatTime = seconds => {
  const time = Math.floor(Math.max(0, seconds || 0));
  return String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0');
};

export class UI {
  get modalOpen() {
    return this.helpOpen || !!this.sheet?.page;
  }

  constructor(send) {
    this.send = send;
    this.ids = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
    this.textCache = new Map();
    this.lastMessage = '';
    this.messageUntil = 0;
    this.helpOpen = false;
    this.resumeAfterHelp = false;
    this.modal = null;
    this.sheet=new HeroMenu(this);
    this.sim = null;
    this.choiceId = 'Hpal';
    this.rosterRef = null;
    this.actionRef = null;
    this.actionButtons = [];
    this.skills = Object.fromEntries([...document.querySelectorAll('.ability')].map(el => [el.dataset.send, el]));
    this.selectButton = document.querySelector('[data-send="select"]');
    this.selectText = this.selectButton.querySelector('span');
    this.meters = {
      statue: this.ids['statue-meter'].firstElementChild,
      hero: document.querySelector('.hp > i'),
      mana: document.querySelector('.mp > i'),
    };
    for (const el of document.querySelectorAll('[data-icon]')) setIcon(el, el.dataset.icon);
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      const { local, send: action } = button.dataset;
      if (local === 'help') this.openHelp();
      else if (local === 'closeHelp') this.closeHelp();
      else if (button.dataset.heroChoice) { this.choiceId = button.dataset.heroChoice; this.drawChoices(this.sim); }
      else if (button.dataset.spell) this.send('cast', { id:button.dataset.spell });
      else if (action === 'select') this.send('select', { id:this.choiceId });
      else if (action === 'buyAnkh') this.send('buy', { item: 'ankh' });
      else if (action) this.send(action);
    });
    document.addEventListener('keydown', event => this.handleModalKey(event), true);
  }

  setText(id, text) {
    const value = String(text);
    if (this.textCache.get(id) === value) return;
    this.ids[id].textContent = value;
    this.textCache.set(id, value);
  }

  show(id, visible) {
    if (this.ids[id].hidden === visible) this.ids[id].hidden = !visible;
  }

  openHelp() {
    if (this.helpOpen) return;
    const phase = this.sim?.phase;
    this.resumeAfterHelp = Boolean(phase && !['ready', 'won', 'lost'].includes(phase) && !this.sim.paused);
    this.helpOpen = true;
    if (this.resumeAfterHelp) this.send('pause');
    this.show('help-layer', true);
    this.show('pause-layer', false);
    this.setModal('help-layer');
  }

  closeHelp() {
    this.helpOpen = false;
    this.show('help-layer', false);
    if (this.resumeAfterHelp && this.sim?.paused) this.send('pause');
    this.resumeAfterHelp = false;
    if (this.sim) this.render(this.sim);
    if (!this.modal) this.ids['help-button'].focus({ preventScroll: true });
  }

  setModal(id) {
    if (id === this.modal) return;
    const oldModal = this.modal;
    this.modal = id;
    if (id) {
      this.ids[id].querySelector('.gold-button')?.focus({ preventScroll: true });
    } else if (oldModal && this.ids[oldModal].contains(document.activeElement)) {
      this.ids.world.focus({ preventScroll: true });
    }
  }

  handleModalKey(event) {
    if (!this.modal) return;
    if(this.sheet.page && event.key==='Escape') {
      event.preventDefault();event.stopImmediatePropagation();this.sheet.close();return;
    }
    if (this.helpOpen && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.closeHelp();
      return;
    }
    if (event.key === 'Tab') {
      const els = this.ids[this.modal].querySelectorAll('button:not(:disabled)');
      const next = event.shiftKey ? els[els.length - 1] : els[0];
      const edge = event.shiftKey ? els[0] : els[els.length - 1];
      if (document.activeElement === edge || !this.ids[this.modal].contains(document.activeElement)) {
        event.preventDefault();
        next.focus();
      }
    }
    if (this.helpOpen) event.stopImmediatePropagation();
  }

  meter(key, value, max) {
    const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
    const transform = 'scaleX(' + fraction.toFixed(4) + ')';
    if (this.meters[key].style.transform !== transform) this.meters[key].style.transform = transform;
  }

  drawChoices(sim) {
    const roster = sim.map.roster;
    if (!roster?.length) return;
    if (this.rosterRef !== roster) {
      const buttons = roster.map(def => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.heroChoice = def.id; b.textContent = def.name;
        return b;
      });
      this.ids['roster-options'].replaceChildren(...buttons);
      this.rosterRef = roster;
    }
    const def = roster.find(d => d.id === (sim.selecting ? sim.selectionId : this.choiceId)) || roster[0];
    this.choiceId = def.id;
    for (const b of this.ids['roster-options'].children) {
      const picked = b.dataset.heroChoice === this.choiceId;
      if (b.getAttribute('aria-pressed') !== String(picked)) b.setAttribute('aria-pressed', String(picked));
      b.disabled = !!sim.selecting;
    }
    this.setText('choose-title', def.name);
    this.setText('hero-role', [def.role, def.actions.map(a=>a.name).join('、')].filter(Boolean).join(' · '));
    setIcon(this.ids['choice-icon'], heroIcons[def.id] || 'helmet');
    const label = sim.selecting ? '小精灵正在前往法阵…' : '选择' + def.name;
    if (this.selectText.textContent !== label) this.selectText.textContent = label;
    this.selectButton.disabled = !!sim.selecting;
  }

  drawHeroActions(sim) {
    const def = sim.heroDefinition || sim.map.roster.find(entry=>entry.id===sim.hero.rawcode);
    const actions = def?.actions || [];
    setIcon(this.ids['portrait-icon'], heroIcons[sim.hero.rawcode] || 'helmet');
    if (this.actionRef !== actions) {
      this.actionButtons = actions.map(action => {
        const b = document.createElement('button');
        b.type='button'; b.className='ability hero-spell'; b.dataset.spell=action.id;
        b.innerHTML='<span class="key"></span><i></i><span class="spell-name"></span><b class="cooldown"></b>';
        b.querySelector('.key').textContent=action.key;
        b.querySelector('.spell-name').textContent=action.name;
        setIcon(b.querySelector('i'),spellIcons[action.id] || 'sun');
        return b;
      });
      this.ids['hero-actions'].replaceChildren(...this.actionButtons);
      this.actionRef=actions;
    }
    actions.forEach((action,index)=>{
      const b=this.actionButtons[index], seconds=number(sim.cooldowns[action.cooldownKey || action.id]);
      const skill=(def.skills || []).find(s=>s.id===(action.skillId || action.id));
      const rank=sim.hero.ranks[skill?.id] || 0;
      const locked=!!skill && rank===0;
      b.disabled=sim.hero.hp<=0 || seconds>0 || locked;
      const description = skill?.ranks?.[rank-1]?.text || action.description || '';
      const title=action.name+' ('+action.key+') · '+(locked?'先在技能面板学习。':'')+description+' '+(aimHints[action.targeting]||'');
      if (b.title!==title) b.title=title;
      if(action.targeting==='toggle') b.setAttribute('aria-pressed',String(!!sim.hero.frostEnabled));
      if (b.dataset.seconds!==String(seconds)) {
        b.querySelector('.cooldown').textContent=seconds?seconds+'s':'';
        b.dataset.seconds=String(seconds);
      }
    });
  }

  render(sim, map) {
    this.sim = sim;
    const { phase, hero, statue } = sim;
    const ready = phase === 'ready';
    const ended = phase === 'won' || phase === 'lost';
    const inBattle = !ready && !ended;
    const wave = sim.wave, waveLabel=wave ? '第 '+wave.number+' 波' : '';
    if (ready) this.choiceId='Hpal';
    const waveTotal=sim.waveTotal || sim.map.waves.length;
    this.setText('chapter-range','第 1–'+waveTotal+' 波 · 首领防守');
    if (document.body.dataset.phase !== phase) document.body.dataset.phase = phase;
    this.setText('brand-name', ready ? '战役地图' : '守卫雅典娜');
    this.show('landing', ready);
    this.show('status', !ready);
    this.show('chooser', inBattle && !!sim.wisp);
    this.show('pause-button', inBattle);
    this.show('objective', inBattle);
    this.show('map-hud', inBattle);
    this.show('command-dock', inBattle && !!hero);
    this.show('hero-tools',inBattle && !!hero);
    this.show('pause-layer', inBattle && sim.paused && !this.modalOpen);
    this.show('result', ended);
    this.setModal(this.sheet.page?'hero-menu':this.helpOpen ? 'help-layer' : ended ? 'result' : sim.paused ? 'pause-layer' : null);
    this.setText('phase-name',phase==='wave'?waveLabel+' · '+wave.name:phaseNames[phase]||'');
    this.setText('elapsed', formatTime(sim.time));
    if (sim.wisp) {
      this.drawChoices(sim);
    }
    if (inBattle && statue) {
      this.meter('statue', statue.hp, statue.maxHp);
      this.setText('statue-hp', number(statue.hp).toLocaleString() + ' / ' + number(statue.maxHp).toLocaleString());
      const statueBar = this.ids['statue-meter'];
      const percent = String(Math.round(100 * statue.hp / statue.maxHp));
      if (statueBar.getAttribute('aria-valuenow') !== percent) statueBar.setAttribute('aria-valuenow', percent);
      this.setText('wave-caption',sim.spawned?waveLabel+(wave.boss?'剩余首领':'剩余敌兵'):sim.granted?waveLabel+'来袭':'援助金币抵达');
      this.setText('wave-stat', sim.spawned ? number(sim.remaining) : formatTime(Math.ceil(sim.countdown)));
    }
    if (inBattle && hero) {
      this.drawHeroActions(sim);
      this.setText('level-badge',hero.name+' · Lv.'+hero.level);
      this.setText('xp-label',hero.xp+' / '+hero.xpNext+' XP');
      this.ids['xp-bar'].max=hero.xpNext||1;this.ids['xp-bar'].value=hero.xpNext?hero.xp:1;
      this.setText('skills-entry',hero.skillPoints?'技能 K · '+hero.skillPoints:'技能 K');
      this.setText('unit-name', hero.name);
      this.setText('hero-status', hero.hp > 0 ? '' : hero.reviveIn > 0 ? number(hero.reviveIn) + ' 秒后复活' : '已阵亡');
      this.setText('hero-hp', number(hero.hp) + '/' + number(hero.maxHp));
      this.setText('hero-mp', number(hero.mana) + '/' + number(hero.maxMana));
      this.meter('hero', hero.hp, hero.maxHp);
      this.meter('mana', hero.mana, hero.maxMana);
      this.setText('gold', number(sim.gold).toLocaleString());
      this.setText('ankhs', number(sim.ankhs));
      const canBuyAnkh = hero.hp > 0 && sim.gold >= 100;
      if (this.ids['buy-ankh'].disabled === canBuyAnkh) this.ids['buy-ankh'].disabled = !canBuyAnkh;
      this.setText('kills', number(sim.kills));
      this.setText('potion-count', number(sim.potions));
      for (const [action, el] of Object.entries(this.skills)) {
        const seconds = number(sim.cooldowns[action]);
        const disabled = hero.hp <= 0 || seconds > 0 || (action === 'potion' && sim.potions <= 0) || (action === 'buy' && sim.gold < 50);
        if (el.disabled !== disabled) el.disabled = disabled;
        if (el.dataset.seconds !== String(seconds)) {
          const label = el.querySelector('.cooldown');
          if (label) label.textContent = seconds ? seconds + 's' : '';
          el.dataset.seconds = String(seconds);
        }
      }
    }
    if (ended) {
      this.setText('result-title', phase === 'won' ? '第 '+waveTotal+' 波已守住' : '女神像已陷落');
      this.setText('result-detail', phase === 'won' ? wave.name+'已被击退，本章防守完成。' : '防守止于'+waveLabel+'。');
      this.setText('result-time', formatTime(sim.time));
      this.setText('result-kills', number(sim.teamKills));
    }
    const now = performance.now();
    if (sim.message !== this.lastMessage) {
      this.lastMessage = sim.message;
      this.setText('toast', sim.message || '');
      this.messageUntil = now + 4000;
    }
    this.show('toast', !!sim.message && inBattle && !sim.paused && !this.helpOpen && now < this.messageUntil);
  }
}
