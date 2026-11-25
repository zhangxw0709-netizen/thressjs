import data from 'athena:map';
import { createMap } from './map.js';
import { Simulation } from './simulation.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { Minimap } from './minimap.js';

const canvas=document.getElementById('world');
const map=createMap(data);
const sim=new Simulation(map);
let world;
try {
  world=new World(canvas,map);
} catch (error) {
  const panel=document.createElement('div');
  panel.setAttribute('role','alert');
  panel.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-content:center;padding:2rem;background:#15201f;color:#f1dfbb;font:18px/1.7 system-ui';
  panel.textContent='无法启动 3D 画面。请使用已启用硬件加速的 Edge 或 Chrome 打开游戏，然后刷新。';
  document.body.append(panel);
  throw error;
}
let attackCursor=false;
let aimedAction=null;
function clearAim() {
  attackCursor=false;
  aimedAction=null;
  canvas.style.cursor='';
}
function finishCast(action,payload) {
  const accepted=sim.command('cast',{...payload,id:action.id});
  if(accepted)clearAim();
  ui.render(sim,map);
}
function focusUnit() {
  const unit=sim.hero||sim.wisp||map.statue;
  world.focus(unit.x,unit.y);
}
function send(action,payload={}) {
  if (action==='focusHero') { focusUnit(); return; }
  if (action==='focusBase') { world.focus(map.statue.x,map.statue.y); return; }
  if(action==='cast') {
    const ability=sim.heroDefinition.actions.find(a=>a.id===(payload.id||payload.abilityId));
    if(!ability || !sim.hero || sim.hero.hp<=0 || sim.paused) return;
    if(aimedAction?.id===ability.id || !['point','enemy','friendly'].includes(ability.targeting) ||
       (ability.skillId && !sim.hero.ranks[ability.skillId]) || sim.cooldowns[ability.cooldownKey]>0) {
      clearAim();finishCast(ability,payload);return;
    }
    attackCursor=false;aimedAction=ability;canvas.style.cursor='crosshair';
    const target={point:'施法地点',enemy:'一个敌人',friendly:'女神像或友军'}[ability.targeting];
    sim.message=ability.name+'：点击'+target+'。再按 '+ability.key+' 自动选取，Esc 取消。';
    ui.render(sim,map);return;
  }
  if (action==='attackMove') {
    if (!sim.hero || sim.paused) return;
    clearAim();
    attackCursor=true; canvas.style.cursor='crosshair';
    sim.message='点击战场上的敌人或攻击移动目的地。';
    return;
  }
  if (['restart','begin','pause'].includes(action)) clearAim();
  sim.command(action,payload);
  ui.render(sim,map);
}
const ui=new UI(send);
const minimap=new Minimap(document.getElementById('minimap'),map,(x,y)=>world.focus(x,y));
ui.render(sim,map);

const held=new Set();
let drag=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if (ui.modalOpen || sim.paused) return;
  if (e.button===1 || (e.button===0 && e.shiftKey)) {
    e.preventDefault();
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:true};canvas.setPointerCapture(e.pointerId);return;
  }
  if (e.button===0 || e.button===2) drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:false};
});
canvas.addEventListener('pointermove',e=>{
  if (!drag || drag.id!==e.pointerId || !drag.pan) return;
  const a=world.pick(drag.x,drag.y),b=world.pick(e.clientX,e.clientY);
  if (a && b) world.pan(a.x-b.x,a.y-b.y);
  drag.x=e.clientX;drag.y=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  const start=drag;drag=null;
  if (!start || start.pan || start.id!==e.pointerId || sim.paused || ui.modalOpen) return;
  if (Math.hypot(e.clientX-start.x,e.clientY-start.y)>12) return;
  if (sim.phase==='ready' || sim.phase==='won' || sim.phase==='lost') return;
  const p=world.pick(e.clientX,e.clientY);
  if (!p) return;
  if(aimedAction) {
    if(e.button===2) {clearAim();sim.message='已取消施法。';return;}
    const aim=aimedAction;
    if(aim.targeting==='point') finishCast(aim,{x:p.x,y:p.y});
    else {
      const units=aim.targeting==='enemy'?sim.enemies:[sim.statue,...sim.allies];
      const alive=units.filter(unit=>unit.hp>0);
      const target=alive.find(unit=>unit.id===p.id) || alive.filter(unit=>Math.hypot(unit.x-p.x,unit.y-p.y)<=90)
        .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
      if(target)finishCast(aim,{targetId:target.id});
      else sim.message=aim.targeting==='enemy'?'请点击一个存活的敌人。':'请点击女神像或存活的友军。';
    }
    return;
  }
  const pad=sim.wisp && (map.roster.find(r=>p.id==='altar-'+r.id) ||
    map.roster.find(r=>Math.hypot(p.x-r.altar.x,p.y-r.altar.y)<85));
  if(pad) send('select',{id:pad.id});
  else if (sim.hero && sim.enemies.some(u=>u.id===p.id && u.hp>0)) send('attack',{id:p.id});
  else if(sim.hero && p.kind==='shop') {
    if(map.catalog.some(i=>i.shopId===p.id)) ui.sheet.open('shop',p.id);
    else sim.message='本章尚未开放佣兵招募。';
  }
  else if (e.button===2 || attackCursor || sim.wisp || e.pointerType==='touch') send(attackCursor?'attackMoveTo':'move',p);
  clearAim();
});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if (!ui.modalOpen) world.zoom(Math.sign(e.deltaY));},{passive:false});
const hotkeys={KeyF:['potion'],KeyB:['buy'],Space:['focusHero'],Home:['focusBase'],KeyM:['attackMove'],KeyA:['attackMove']};
window.addEventListener('keydown',e=>{
  if (e.ctrlKey||e.altKey||e.metaKey||ui.modalOpen||e.defaultPrevented) return;
  if (e.code==='Escape' && (attackCursor||aimedAction)) {clearAim();sim.message='已取消指令。';e.preventDefault();return;}
  if (['KeyP','Escape'].includes(e.code)) {
    if (!e.repeat) send('pause'); e.preventDefault(); return;
  }
  if (sim.paused || ['ready','won','lost'].includes(sim.phase)) return;
  if(sim.hero && /^Key[QWER]$/.test(e.code)) {
    const ability=sim.heroDefinition.actions.find(a=>a.key===e.code.slice(3));
    if(ability && !e.repeat)send('cast',{id:ability.id});
    e.preventDefault();return;
  }
  const panel={KeyK:'skills',KeyG:'shop',KeyI:'bag'}[e.code];
  if(panel && sim.hero) {e.preventDefault();if(!e.repeat)ui.sheet.open(panel);return;}
  if(sim.hero && /^Digit[1-6]$/.test(e.code)){
    e.preventDefault();if(!e.repeat)send('useItem',{slot:Number(e.code.at(-1))-1});return;
  }
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
    e.preventDefault();held.add(e.code);return;
  }
  if (e.code==='Space' && e.target instanceof HTMLButtonElement && e.detail===0) {
    // During play Space always recalls the selected unit, including after clicking an ability.
    e.target.blur();
  }
  const hot=hotkeys[e.code];
  if (hot) { e.preventDefault(); if (!e.repeat) send(...hot); }
});
window.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',()=>{held.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{
  if (document.hidden && !sim.paused && ['choose','prep','wave'].includes(sim.phase)) send('pause');
});

const step=1/30;
let last=performance.now(),acc=0,uiTime=0;
function frame(now) {
  const dt=Math.min(.25,(now-last)/1000);
  last=now;acc+=dt;uiTime+=dt;
  while (acc>=step) {sim.update(step);acc-=step;}
  if(aimedAction && (sim.hero?.hp<=0 || !['wave','prep'].includes(sim.phase) || ui.modalOpen))clearAim();
  if (!sim.paused && !ui.modalOpen && held.size) {
    const dx=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft'));
    const dy=Number(held.has('ArrowUp'))-Number(held.has('ArrowDown'));
    world.pan(dx*1800*dt,dy*1800*dt);
  }
  world.render(sim,dt);
  if (uiTime>=.1) {
    uiTime=0;ui.render(sim,map);minimap.draw(sim,world);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
