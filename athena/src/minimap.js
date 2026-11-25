const terrainColors = {
  Ldrt: '#725e48', Ldro: '#7a6d51', Ldrg: '#687448',
  Lrok: '#83837a', Lgrs: '#405e46', Lgrd: '#335542',
};

export class Minimap {
  constructor(canvas,map,onFocus) {
    this.canvas=canvas;
    this.map=map;
    this.ctx=canvas.getContext('2d');
    this.background=document.createElement('canvas');
    const {bounds:b,terrain:t}=map;
    const step=t.worldUnitsPerTile;
    const x0=(b.minX-t.originXY[0])/step, y0=(b.minY-t.originXY[1])/step;
    const w=(b.maxX-b.minX)/step, h=(b.maxY-b.minY)/step;
    this.background.width=w; this.background.height=h;
    const bg=this.background.getContext('2d');
    for (let j=0;j<h;j++) for (let i=0;i<w;i++) {
      const v=t.corners[y0+j][x0+i];
      bg.fillStyle=v[4]&4?'#426c79':terrainColors[t.groundTiles[v[3]]];
      bg.fillRect(i,h-1-j,1,1);
    }
    canvas.addEventListener('pointerdown',e=>{
      if (e.button!==0) return;
      const r=canvas.getBoundingClientRect(), box=this.frame(r.width,r.height);
      const u=(e.clientX-r.left-box.x)/box.w,v=(e.clientY-r.top-box.y)/box.h;
      if (u<0 || u>1 || v<0 || v>1) return;
      onFocus(b.minX+u*(b.maxX-b.minX), b.maxY-v*(b.maxY-b.minY));
    });
  }
  frame(w,h) {
    const ratio=this.background.width/this.background.height;
    const fh=Math.min(w/ratio,h),fw=fh*ratio;
    return {x:(w-fw)/2,y:(h-fh)/2,w:fw,h:fh};
  }
  draw(sim,world) {
    const {canvas,ctx,map}=this;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if (!w || !h) return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if (canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)) {
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#141e1d'; ctx.fillRect(0,0,w,h);
    const f=this.frame(w,h),b=map.bounds;
    const xy=p=>[f.x+(p.x-b.minX)/(b.maxX-b.minX)*f.w, f.y+(b.maxY-p.y)/(b.maxY-b.minY)*f.h];
    ctx.drawImage(this.background,f.x,f.y,f.w,f.h);
    ctx.save(); ctx.beginPath(); ctx.rect(f.x,f.y,f.w,f.h); ctx.clip();
    const dot=(p,r,color)=>{ if (!p) return; const [x,y]=xy(p);ctx.beginPath();ctx.fillStyle=color;ctx.arc(x,y,r,0,Math.PI*2);ctx.fill(); };
    for (const p of map.lanes) {
      const [x,y]=xy(p);ctx.strokeStyle='#e39b77';ctx.lineWidth=1;ctx.strokeRect(x-2.5,y-2.5,5,5);
    }
    for (const p of sim.enemies) if (p.hp>0) dot(p,p.boss?2.6:1.45,p.illusion?'#b4a1ca':p.boss?'#ffb547':'#fa785e');
    for (const p of sim.allies||[]) if (p.hp>0) dot(p,1.7,'#9ebbc4');
    for (const shop of map.shops||[map.shop]) dot(shop,2,'#d4a766');
    for (const hero of map.roster||[{altar:map.altar}]) dot(hero.altar,2,'#acdedb');
    dot(sim.statue,3.5,'#f0cb72');
    const unit=sim.hero||sim.wisp;
    if (unit && unit.hp>0) { dot(unit,4,'#263b31');dot(unit,2.7,'#baee96'); }
    const corners=world.footprint?.()||[];
    if (corners.length>=3) {
      ctx.beginPath(); corners.forEach((p,i)=>{const [x,y]=xy(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      ctx.closePath();ctx.lineWidth=1;ctx.strokeStyle='#f6f1cdbb';ctx.stroke();
    }
    ctx.restore();
  }
}
