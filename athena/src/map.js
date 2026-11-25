// World coordinates retain Warcraft's east-positive X and north-positive Y.
export function createMap(data) {
  const { pathing, terrain, bounds } = data;
  const { width, height, cell } = pathing;
  const [ox, oy] = terrain.originXY;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let at = y * width;
    for (const [flag, length] of pathing.rows[y]) {
      mask.fill(flag, at, at + length);
      at += length;
    }
    if (at !== (y + 1) * width) throw new Error('寻路网格长度异常');
  }
  const minI = Math.floor((bounds.minX - ox) / cell);
  const minJ = Math.floor((bounds.minY - oy) / cell);
  const maxI = Math.ceil((bounds.maxX - ox) / cell) - 1;
  const maxJ = Math.ceil((bounds.maxY - oy) / cell) - 1;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ix = x => Math.floor((x - ox) / cell);
  const iy = y => Math.floor((y - oy) / cell);
  const isOpen = (i,j) => i >= minI && j >= minJ && i <= maxI && j <= maxJ && (mask[j * width + i] & 2) === 0;
  const point = k => ({ x: ox + ((k % width) + .5) * cell, y: oy + (Math.floor(k / width) + .5) * cell });
  const walkable = (x,y) => isOpen(ix(x), iy(y));
  function nearestWalkable(x, y) {
    const a = clamp(ix(x), minI, maxI), b = clamp(iy(y), minJ, maxJ);
    if (walkable(x,y)) return {x,y};
    let best, distance = Infinity;
    for (let r = 0; r < Math.max(width,height); r++) {
      const consider = (i,j) => {
        if (!isOpen(i,j)) return;
        const p = point(j * width + i);
        const d = (p.x-x)**2 + (p.y-y)**2;
        if (d < distance) { best = p; distance = d; }
      };
      for (let i = a-r; i <= a+r; i++) { consider(i,b-r); if (r) consider(i,b+r); }
      for (let j = b-r+1; j < b+r; j++) { consider(a-r,j); consider(a+r,j); }
      if (best) return best;
    }
    return null;
  }
  // Grid traversal checks both sides of exact corner crossings.
  function canTraverse(x, y, tx, ty) {
    let a = ix(x), b = iy(y);
    const endA = ix(tx), endB = iy(ty);
    if (!isOpen(a,b) || !isOpen(endA,endB)) return false;
    const dx=tx-x, dy=ty-y, sx=Math.sign(dx), sy=Math.sign(dy);
    const stepX=dx ? cell/Math.abs(dx) : Infinity, stepY=dy ? cell/Math.abs(dy) : Infinity;
    let tX=dx ? (ox+(a+(sx>0?1:0))*cell-x)/dx : Infinity;
    let tY=dy ? (oy+(b+(sy>0?1:0))*cell-y)/dy : Infinity;
    while (a!==endA || b!==endB) {
      if (a===endA) { b+=sy; tY+=stepY; }
      else if (b===endB) { a+=sx; tX+=stepX; }
      else if (Math.abs(tX-tY)<1e-9) {
        if (!isOpen(a+sx,b) || !isOpen(a,b+sy)) return false;
        a+=sx; b+=sy; tX+=stepX; tY+=stepY;
      } else if (tX<tY) { a+=sx; tX+=stepX; }
      else { b+=sy; tY+=stepY; }
      if (!isOpen(a,b)) return false;
    }
    return true;
  }
  // Shared reverse search: the four attacking groups all order towards the same objective.
  const fields = new Map();
  const offsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  function directionsTo(goal) {
    if (fields.has(goal)) return fields.get(goal);
    const next=new Int32Array(mask.length).fill(-1), queue=new Int32Array(mask.length);
    next[goal]=goal; queue[0]=goal;
    let head=0, tail=1;
    while (head<tail) {
      const k=queue[head++], a=k%width, b=Math.floor(k/width);
      for (const [di,dj] of offsets) {
        const i=a+di,j=b+dj,n=j*width+i;
        if (!isOpen(i,j) || next[n]!==-1) continue;
        if (di && dj && (!isOpen(a+di,b) || !isOpen(a,b+dj))) continue;
        next[n]=k; queue[tail++]=n;
      }
    }
    if (fields.size>=8) fields.delete(fields.keys().next().value);
    fields.set(goal,next);
    return next;
  }
  function route(x,y,tx,ty) {
    const s=nearestWalkable(x,y), t=nearestWalkable(tx,ty);
    if (!s || !t) return [];
    if (canTraverse(s.x,s.y,t.x,t.y)) return [t];
    const start=iy(s.y)*width+ix(s.x), goal=iy(t.y)*width+ix(t.x);
    const next=directionsTo(goal);
    if (next[start]<0) return [];
    let anchor=s, previous=s;
    const result=[];
    for (let k=next[start]; ; k=next[k]) {
      const p=k===goal?t:point(k);
      if (!canTraverse(anchor.x,anchor.y,p.x,p.y)) {
        result.push(previous);
        anchor=previous;
      }
      previous=p;
      if (k===goal) break;
    }
    result.push(t);
    return result;
  }
  function groundHeight(x,y) {
    const gx=clamp((x-ox)/terrain.worldUnitsPerTile,0,terrain.columns-1.00001);
    const gy=clamp((y-oy)/terrain.worldUnitsPerTile,0,terrain.rows-1.00001);
    const i=Math.floor(gx), j=Math.floor(gy), fx=gx-i, fy=gy-j;
    const z=(a,b) => {
      const c=terrain.corners[b][a];
      return (c[0]-8192)/4 + (c[8]-2)*128;
    };
    return (z(i,j)*(1-fx)+z(i+1,j)*fx)*(1-fy)+(z(i,j+1)*(1-fx)+z(i+1,j+1)*fx)*fy;
  }
  return {...data, height:groundHeight, walkable, canTraverse, nearestWalkable, route};
}
