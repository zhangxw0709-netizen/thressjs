import * as THREE from 'three';
import { makeArt } from './art.js';

const TILE = 128;
const heroModels={Hamg:'archmage',Hblm:'bloodMage',Hmkg:'mountainKing',Hpal:'paladin'};
const altarColors={Hpal:'#ffda85',Hamg:'#8bd3eb',Hmkg:'#e0a08a'};
const enemyModels={nftr:'troll',nogr:'ogre',nkog:'skeleton',nfrb:'furbolg',nsel:'elemental',ndmu:'ogre',nrvl:'archmage',nepl:'treant',Hlgr:'paladin',
  nfpe:'shaman',nlkl:'seaLord',nane:'tempest',ntrd:'ironGolem',nsgb:'tideGiant',nsoc:'orcBones',nhrh:'harpy',nfra:'wolfRider',Nbbc:'bladeMaster'};
const enemyTints={ndmu:new THREE.Color('#8eca87'),nrvl:new THREE.Color('#aca0d7'),Hlgr:new THREE.Color('#ed9e76')};
const neutralTint=new THREE.Color(0xffffff);
const mirrorTint=new THREE.Color('#83aace');
const colForEnemy=id=>enemyTints[id]||neutralTint;
const effectRadius={blizzard:2.05,clap:2.35,bladestorm:1.85,mirror:1.3,teleport:1.35,avatar:.90,summon:.95};
const effectColor={blizzard:'#91d7ff',storm:'#b4d9ff',frost:'#9edbe9',clap:'#ffc681',bladestorm:'#f6a260',mirror:'#b190e8',crit:'#ff977f',teleport:'#91d7ec',avatar:'#edc16e',summon:'#93c8dc'};
const TAU = Math.PI * 2;
const matrixObject = new THREE.Object3D();
const v = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const viewDir = new THREE.Vector3(.36, .96, 1).normalize();
const playDirection = new THREE.Vector3(-.32, 1.04, 1).normalize();
const palette = {Ldrt:'#ac9d7e', Ldro:'#747f66', Ldrg:'#6e8466', Lrok:'#818980', Lgrs:'#65865c', Lgrd:'#486e55'};

function random(seed) {
  let a = seed >>> 0;
  return () => { a = (Math.imul(1664525,a)+1013904223)>>>0; return a/4294967296; };
}
function makeTexture(paint,size=256) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  paint(canvas.getContext('2d'),size);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function groundTexture(stone) {
  const rng=random(stone?342:727);
  const texture=makeTexture((c,size)=>{
    c.fillStyle=stone?'#ecebe3':'#f1f1e8'; c.fillRect(0,0,size,size);
    for(let i=0;i<2200;i++){
      const x=rng()*size,y=rng()*size,r=rng();
      c.fillStyle=r>.48?'rgba(88,96,74,.085)':'rgba(255,255,255,.22)';
      c.beginPath();c.moveTo(x,y);c.lineTo(x+rng()*7+1,y-rng()*3);c.lineTo(x+rng()*5,y+rng()*3+1);c.fill();
    }
    if(stone){
      for(let row=-1;row<7;row++)for(let col=-1;col<6;col++){
        const x=col*51+(row%2)*25,y=row*42,h=37+rng()*3,w=46+rng()*4;
        c.beginPath();c.moveTo(x+3,y+2);c.lineTo(x+w-5,y);c.lineTo(x+w,y+6);
        c.lineTo(x+w-1,y+h-4);c.lineTo(x+w-8,y+h);c.lineTo(x+3,y+h-1);c.lineTo(x,y+h-7);c.closePath();
        c.strokeStyle='rgba(78,83,73,.19)';c.lineWidth=2.2;c.stroke();
        c.fillStyle=rng()>.5?'rgba(131,127,106,.09)':'rgba(255,255,250,.28)';c.fill();
      }
    }
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  return texture;
}
function glowTexture() {
  return makeTexture((c,s)=>{
    const m=s/2,g=c.createRadialGradient(m,m,0,m,m,m);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.13,'rgba(255,255,255,.86)');
    g.addColorStop(.37,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.fillRect(0,0,s,s);
  },64);
}
function clipWaterPolygon(vertices,field,minimum) {
  const output=[];
  for(let n=0;n<vertices.length;n++){
    const a=vertices[n],b=vertices[(n+1)%vertices.length];
    if(a[field]>=minimum)output.push(a);
    if((a[field]>=minimum)!==(b[field]>=minimum)){
      const t=(minimum-a[field])/(b[field]-a[field]);
      output.push(a.map((val,i)=>val+(b[i]-val)*t));
    }
  }
  return output;
}
function waterTexture(){
  const texture=makeTexture((ctx,s)=>{
    const rng=random(827);ctx.fillStyle='#dce5df';ctx.fillRect(0,0,s,s);
    for(let i=0;i<145;i++){
      const a=rng()*s,b=rng()*s,len=3+rng()*15;
      ctx.beginPath();ctx.moveTo(a,b);
      ctx.bezierCurveTo(a+len*.3,b-1.8,a+len*.7,b+.8,a+len,b-.6);
      ctx.strokeStyle=i%4?'rgba(58,101,97,.16)':'rgba(255,255,244,.67)';
      ctx.lineWidth=.5+rng()*1.05;ctx.stroke();
    }
  });texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
const rawId = d => d.typeId ?? d.rawId ?? d.type ?? d.id;
const xOf = d => d.x ?? d.xyz?.[0];
const yOf = d => d.y ?? d.xyz?.[1];
const point = (d, fallback) => Array.isArray(d) ? {x:d[0],y:d[1]} : (d || fallback);

export class World {
  constructor(canvas,map) {
    this.canvas=canvas; this.map=map; this.phase=null; this.time=0;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#95ab9d');
    this.scene.fog=new THREE.Fog('#a7b7a5',47,100);
    this.camera=new THREE.OrthographicCamera(-8,8,8,-8,.05,170);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.08;
    this.scene.add(new THREE.HemisphereLight(0xfff4cf,0x517a78,1.78));
    this.sun=new THREE.DirectionalLight(0xffedc2,2.65);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);
    Object.assign(this.sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:82});
    this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.022;
    this.scene.add(this.sun,this.sun.target);
    const rim=new THREE.DirectionalLight(0x99d8cf,1.1);rim.position.set(8,8,-15);this.scene.add(rim);
    this.art=makeArt();
    this.solid=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.06});
    this.matCache=new Map();
    this.glow=glowTexture();
    this.staticGroups=new Map();
    this.glows=[];this.selectables=[];this.entities=[];this.dynamic={};
    this.statue=point(map.statue,{x:3840,y:-4288});
    this.altar=point(map.altar,{x:-2448,y:2752});
    this.roster=map.roster || [{id:'Hpal',model:'paladin',altar:this.altar}];
    this.center={x:this.statue.x,y:this.statue.y};
    this.span=13;this.aspect=1;
    this.terrain=this.makeTerrain();
    this.scene.add(this.terrain);
    this.placeScenery();
    this.makeShrine();
    this.makeAltar();
    this.finishStatics();
    this.makeDynamics();
    this.ray=new THREE.Raycaster();this.groundPlane=new THREE.Plane(up,0);
    this.occlusionRay=new THREE.Raycaster();this.occlusionRay.far=12;
    this.resize();this.positionCamera();
  }
  ground(x,y) {
    const h=this.map.height?.(x,y);
    return Number.isFinite(h)?h/TILE:0;
  }
  wet(x,y) {
    const t=this.map.terrain,gx=(x-t.originXY[0])/TILE,gy=(y-t.originXY[1])/TILE;
    const i=Math.floor(gx),j=Math.floor(gy);
    if(i<0||j<0||i+1>=t.columns||j+1>=t.rows)return false;
    const fx=gx-i,fy=gy-j;
    const corners=[t.corners[j][i],t.corners[j][i+1],t.corners[j+1][i],t.corners[j+1][i+1]];
    const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
    let mask=0,level=0;
    for(let k=0;k<4;k++){mask+=weights[k]*Number(Boolean(corners[k][4]&4));level+=weights[k]*(corners[k][1]-8192)/512;}
    return mask>=.48&&level>this.ground(x,y)+.015;
  }
  surface(x,y){
    const h=this.ground(x,y);
    if(!this.shrine)return h;
    const radius=Math.hypot(x-this.statue.x,y-this.statue.y)/TILE;
    return radius<2.98*this.shrine.scale.x?Math.max(h,this.shrine.position.y+.18*this.shrine.scale.x):h;
  }
  material(c,metal=.1) {
    const key=c+':'+metal;
    if(!this.matCache.has(key))this.matCache.set(key,new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:.72}));
    return this.matCache.get(key);
  }
  makeTerrain() {
    const t=this.map.terrain;
    const {corners,columns,rows,groundTiles,originXY}=t;
    const positions=[],colors=[],uv=[],indices=[[],[]],waterPositions=[],waterColors=[],waterUV=[];
    const rng=random(991),c=new THREE.Color();
    const shallow=new THREE.Color('#8ca69b'),deep=new THREE.Color('#326660');
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const wx=originXY[0]+x*TILE,wy=originXY[1]+y*TILE,corner=corners[y][x];
      const tile=groundTiles[corner[3]];
      positions.push(wx/TILE,this.ground(wx,wy),-wy/TILE);uv.push(x*.36,y*.36);
      c.set(palette[tile]||'#7c8e60').multiplyScalar(.94+rng()*.14);
      colors.push(c.r,c.g,c.b);
      if(x+1>=columns||y+1>=rows)continue;
      const i=y*columns+x,j=i+columns;
      indices[tile==='Lrok'?1:0].push(i,i+1,j,j,i+1,j+1);
      const near=[corner,corners[y][x+1],corners[y+1][x],corners[y+1][x+1]];
      if(near.some(q=>(q[4]&4)!==0)){
        const pts=near.map((q,n)=>{
          const px=wx/TILE+n%2,pz=-wy/TILE-Math.floor(n/2),level=(q[1]-8192)/512;
          return [px,level,pz,level-this.ground(px*TILE,-pz*TILE),Number(Boolean(q[4]&4))];
        });
        for(const tri of [[0,1,2],[2,1,3]]){
          const polygon=clipWaterPolygon(clipWaterPolygon(tri.map(k=>pts[k]),3,.012),4,.48);
          for(let k=1;k<polygon.length-1;k++)for(const q of [polygon[0],polygon[k],polygon[k+1]]){
            waterPositions.push(q[0],q[1],q[2]);waterUV.push(q[0]*.28,q[2]*.28);
            c.copy(shallow).lerp(deep,Math.min(1,q[3]*.82));
            waterColors.push(c.r,c.g,c.b);
          }
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex([...indices[0],...indices[1]]);
    geo.addGroup(0,indices[0].length,0);geo.addGroup(indices[0].length,indices[1].length,1);
    geo.computeVertexNormals();geo.computeBoundingSphere();
    const ground=new THREE.Mesh(geo,[false,true].map(stone=>new THREE.MeshStandardMaterial({map:groundTexture(stone),vertexColors:true,roughness:1})));
    ground.receiveShadow=true;
    if(waterPositions.length){
      const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(waterPositions,3));wg.setAttribute('color',new THREE.Float32BufferAttribute(waterColors,3));wg.setAttribute('uv',new THREE.Float32BufferAttribute(waterUV,2));wg.computeVertexNormals();
      this.waterMap=waterTexture();
      const water=new THREE.Mesh(wg,new THREE.MeshStandardMaterial({map:this.waterMap,vertexColors:true,roughness:.37,metalness:.19,transparent:true,opacity:.91,depthWrite:false}));water.receiveShadow=true;this.scene.add(water);
    }
    return ground;
  }
  place(name,x,y,angle=0,scale=1,height=0) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(['fern','flowers','oak','birch','pine'].includes(name)&&this.wet(x,y))return;
    const key=name+'/'+Math.floor(x/1300)+'/'+Math.floor(y/1300);
    if(!this.staticGroups.has(key))this.staticGroups.set(key,{name,matrices:[]});
    matrixObject.position.set(x/TILE,this.ground(x,y)+height,-y/TILE);
    matrixObject.rotation.set(0,angle,0);matrixObject.scale.setScalar(scale);matrixObject.updateMatrix();
    this.staticGroups.get(key).matrices.push(matrixObject.matrix.clone());
  }
  finishStatics() {
    for(const {name,matrices} of this.staticGroups.values()){
      const mesh=new THREE.InstancedMesh(this.art[name],this.solid,matrices.length);
      matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
      mesh.castShadow=!['fern','flowers'].includes(name);mesh.receiveShadow=true;
      mesh.computeBoundingSphere();this.scene.add(mesh);
    }
    this.staticGroups.clear();
  }
  placeScenery() {
    const rng=random(1781);
    for(const d of this.map.doodads||[]){
      const id=rawId(d),x=xOf(d),y=yOf(d),s=Array.isArray(d.scale)?d.scale[0]:d.scale||1, a=d.angle??d.angleRadians??rng()*TAU;
      if(id==='LTlt'){this.place(rng()>.55?'oak':'birch',x,y,a,s*(.85+rng()*.30));continue;}
      if(['LOtz','LOt1','LOo1','NWwh','AObd','LOpg'].includes(id)){this.place('rock',x,y,a,s*(.50+rng()*.4));continue;}
      if(['NOfp','LObz','LOlp'].includes(id)){this.place('torch',x,y,a,s*.77);continue;}
      if(['ZPfw','LPfp','LOsk','ZWsf','AWfs','IWbg','ZWsw','ZWfs','NObt'].includes(id))this.place(id==='ZPfw'?'flowers':'fern',x,y,a,s*(.75+rng()*.42));
    }
    const t=this.map.terrain;
    // Decorative vegetation follows the terrain palette. Keep traversable paths open.
    for(let i=0;i<7300;i++){
      const tx=1+rng()*(t.columns-3),ty=1+rng()*(t.rows-3);
      const corner=t.corners[ty|0][tx|0],tile=t.groundTiles[corner[3]];
      if(!['Lgrs','Lgrd','Ldro'].includes(tile)||(corner[4]&4))continue;
      const x=t.originXY[0]+tx*TILE,y=t.originXY[1]+ty*TILE;
      if(Math.hypot(x-this.statue.x,y-this.statue.y)<550||this.roster.some(({altar})=>Math.hypot(x-altar.x,y-altar.y)<190))continue;
      const f=rng(),walk=this.map.walkable?.(x,y)??true;
      if(!walk&&f>.50)this.place(['oak','birch','pine'][Math.floor(rng()*3)],x,y,rng()*TAU,.64+rng()*.85);
      else if(f>.83)this.place('rock',x,y,rng()*TAU,.28+rng()*.38);
      else if(f>.65)this.place('fern',x,y,rng()*TAU,.68+rng()*.74);
    }
    for(const [index,d] of (this.map.shops||[]).entries()){
      const x=xOf(d),y=yOf(d),id=d.id??'shop-'+index;
      this.place('shop',x,y,Math.atan2(this.statue.x-x,y-this.statue.y),1.08);
      this.selectables.push({id,x,y,height:1.04,radius:88,kind:'shop'});
    }
  }
  baseMesh(g,mat,x,y,z,angle=0,group=this.scene) {
    const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.rotation.y=angle;
    m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  }
  makeShrine() {
    const {x,y}=this.statue;
    let h=this.ground(x,y);
    for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++)if(i*i+j*j<=9)h=Math.max(h,this.ground(x+TILE*i,y+TILE*j));
    h+=.065;
    const shrine=new THREE.Group();shrine.position.set(x/TILE,h,-y/TILE);this.shrine=shrine;
    this.scene.add(shrine);
    const stone=this.material('#738285'),lightStone=this.material('#a8afa3'),dark=this.material('#42575a'),gold=this.material('#c39b56',.46);
    const disk=(r,height,y,mat,sides=32)=>this.baseMesh(new THREE.CylinderGeometry(r,r+.045,height,sides),mat,0,y,0,Math.PI/sides,shrine);
    disk(3.14,.55,-.205,dark,12);disk(3.02,.10,.107,stone,12);
    const rng=random(162);
    // Individually shaped voussoirs leave fine joints in the circular paving.
    for(const [inner,outer,n,stagger] of [[1.66,2.14,19,0],[2.16,2.64,22,.08],[2.66,3.00,26,.015]]){
      const positions=[],colors=[],c=new THREE.Color();
      for(let j=0;j<n;j++){
        const a=TAU*j/n+stagger+.006,b=TAU*(j+1)/n+stagger-.006;
        const p=(ang,r)=>[Math.cos(ang)*r,.175,Math.sin(ang)*r];
        const verts=[p(a,inner),p(a,outer),p(b,inner),p(b,outer)];
        c.set(['#899790','#96a097','#82938f','#a6aba0'][Math.floor(rng()*4)]);
        for(const k of [0,2,1,1,2,3]){positions.push(...verts[k]);colors.push(c.r,c.g,c.b);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();this.baseMesh(g,this.solid,0,0,0,0,shrine);
    }
    for(const radius of [1.65,2.13,2.65,2.98]){
      const ring=this.baseMesh(new THREE.TorusGeometry(radius,.017,5,96),gold,0,.19,0,0,shrine);ring.rotation.x=Math.PI/2;
    }
    this.athena=this.baseMesh(this.art.athena,this.solid,0,.17,0,.25,shrine);
    for(let i=0;i<12;i++){
      if(i%3===0)continue;
      const a=TAU*i/12,dx=Math.sin(a),dz=Math.cos(a);
      const m=this.baseMesh(new THREE.BoxGeometry(.10,.028,.205),gold,dx*2.80,.192,dz*2.80,a,shrine);
      m.rotation.y=a+Math.PI*.25;
    }
    // Back of the shrine carries an open astronomical dial and two votive pillars.
    const dial=new THREE.Group();dial.position.set(0,2.09,-1.22);dial.rotation.y=.22;shrine.add(dial);
    const r=1.58;
    for(const radius of [r,r-.085]){
      this.baseMesh(new THREE.TorusGeometry(radius,.023,6,96,Math.PI*1.44),gold,0,0,0,0,dial).rotation.z=-Math.PI*.22;
    }
    for(let i=0;i<=20;i++){
      const a=-Math.PI*.22+Math.PI*1.44*i/20;
      const marker=this.baseMesh(new THREE.BoxGeometry(i%5===0?.060:.028,i%5===0?.21:.10,.037),gold,Math.cos(a)*(r+.036),Math.sin(a)*(r+.036),0,0,dial);marker.rotation.z=a-Math.PI/2;
    }
    for(const k of [-1,1]){
      this.baseMesh(this.art.column,this.solid,k*1.29,.16,-1.04,0,shrine);
      for(const side of [-1,1]){
        const dx=k*2.47,dz=side*1.50;
        this.baseMesh(this.art.torch,this.solid,dx,.15,dz,0,shrine).scale.setScalar(.70);
        this.lightGlow(shrine,dx,1.13,dz,.72,'#ffc063');
      }
      const bx=k*3.40,bz=-1.84;
      this.baseMesh(this.art.column,this.solid,bx,-.03,bz,0,shrine).scale.setScalar(1.32);
      this.lightGlow(shrine,bx,2.40,bz,.8,'#ffbd66');
      const pole=this.baseMesh(new THREE.CylinderGeometry(.031,.042,2.82,7),gold,bx,1.41,bz-.15,0,shrine);
      const cross=this.baseMesh(new THREE.CylinderGeometry(.030,.030,.92,7),gold,bx+k*.37,2.62,bz-.15,0,shrine);cross.rotation.z=Math.PI/2;
      const pts=[0,0,.015,k*.70,0,.015,k*.65,-1.03,.11,k*.36,-1.20,.13,k*.05,-1.01,.07];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setIndex([0,1,2,0,2,3,0,3,4]);g.computeVertexNormals();
      const cloth=new THREE.MeshStandardMaterial({color:'#216e68',side:THREE.DoubleSide,roughness:.92});
      this.baseMesh(g,cloth,pole.position.x+k*.025,2.60,bz-.14,0,shrine);
      this.baseMesh(new THREE.OctahedronGeometry(.088),gold,bx+k*.37,2.20,bz-.057,0,shrine).scale.set(1,1.8,.27);
    }
    const near=[[-4.6,-3.7],[-4.0,-5.6],[-2.5,-6.1],[2.7,-6.2],[4.7,-3.9],[5.7,-1.4],[-5.9,1.5],[-4.8,4.5],[5.5,3.9]];
    for(let i=0;i<near.length;i++){
      const [dx,dz]=near[i],wx=x+dx*TILE,wy=y-dz*TILE;
      this.place(i%3?'oak':'birch',wx,wy,i*1.74,1.02+rng()*.38);
      this.place('rock',wx+28,wy-24,i,.55+rng()*.24);
      this.place('fern',wx-34,wy+19,-i,1.22);
    }
    this.lightGlow(shrine,0,.27,.02,3.0,'#f5c975',.12);
    this.statueRing=this.makeRing(1.72,'#e9cf82',.052);this.statueRing.position.set(0,.22,0);shrine.add(this.statueRing);
    this.statueRing.visible=false;
    this.makeMotes(shrine);
  }
  lightGlow(group,x,y,z,size,color,intensity=.55){
    const mat=new THREE.SpriteMaterial({map:this.glow,color,opacity:intensity,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
    const sprite=new THREE.Sprite(mat);sprite.position.set(x,y,z);sprite.scale.setScalar(size);group.add(sprite);
    this.glows.push({sprite,size,phase:this.glows.length*1.56});
  }
  makeMotes(shrine) {
    const rng=random(123),positions=[],colors=[];
    for(let i=0;i<85;i++){const a=rng()*TAU,r=1.0+Math.sqrt(rng())*3.35;positions.push(Math.cos(a)*r,.38+rng()*3.15,Math.sin(a)*r);colors.push(1,.78+rng()*.14,.36+rng()*.31);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.motes=new THREE.Points(g,new THREE.PointsMaterial({map:this.glow,size:.048,vertexColors:true,transparent:true,opacity:.76,blending:THREE.AdditiveBlending,depthWrite:false}));
    shrine.add(this.motes);
  }
  makeRing(radius,color,width=.055) {
    const m=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,56),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));
    m.rotation.x=-Math.PI/2;return m;
  }
  makeAltar() {
    const circle=new THREE.CylinderGeometry(.61,.66,.09,16);
    const choiceMat=this.material('#879a85'),borderMat=this.material('#b8ae85');
    const placements=this.map.placements||[];
    for(const d of placements){
      if(rawId(d)!=='ncop')continue;
      const wx=xOf(d),wy=yOf(d);
      if(this.roster.some(({altar})=>Math.hypot(altar.x-wx,altar.y-wy)<65))continue;
      this.baseMesh(circle,choiceMat,wx/TILE,this.ground(wx,wy)+.035,-wy/TILE);
      const ring=this.makeRing(.54,'#c7be94',.024);ring.position.set(wx/TILE,this.ground(wx,wy)+.087,-wy/TILE);this.scene.add(ring);
    }
    const platform=new THREE.CylinderGeometry(.65,.71,.12,16);
    this.altarRings=[];
    for(const def of this.roster){
      const {x,y}=def.altar,wx=x/TILE,wz=-y/TILE,h=this.ground(x,y);
      const color=altarColors[def.id]||'#ffd782';
      this.baseMesh(platform,borderMat,wx,h+.065,wz);
      const ring=this.makeRing(.61,color,.055);
      ring.position.set(wx,h+.14,wz);this.scene.add(ring);this.altarRings.push(ring);
      this.baseMesh(this.art[def.model]||this.art.paladin,this.solid,wx,h+.13,wz,-.28).scale.setScalar(1.05);
      this.lightGlow(this.scene,wx,h+.34,wz,1.23,color,.30);
      this.selectables.push({id:'altar-'+def.id,x,y,height:.61,radius:83,kind:'altar'});
    }
  }
  makeDynamics() {
    const sphere=new THREE.SphereGeometry(1,12,8);
    this.hero=this.baseMesh(this.art.paladin,this.solid,0,0,0);this.hero.visible=false;
    this.heroMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.09),new THREE.MeshBasicMaterial({color:'#ffe0a0',depthWrite:false,depthTest:false}));
    this.heroMarker.scale.set(1,1.6,1);this.heroMarker.renderOrder=12;this.scene.add(this.heroMarker);this.heroMarker.visible=false;
    const silhouette=new THREE.MeshBasicMaterial({color:'#ffe59c',transparent:true,opacity:.35,depthFunc:THREE.GreaterDepth,depthWrite:false});
    this.heroOutline=new THREE.Mesh(this.art.paladin,silhouette);this.heroOutline.renderOrder=6;this.scene.add(this.heroOutline);this.heroOutline.visible=false;
    this.wisp=new THREE.Group();
    const orb=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:'#e2ffca'}));orb.scale.setScalar(.19);this.wisp.add(orb);
    this.lightGlow(this.wisp,0,0,0,1.05,'#adffd2',.88);
    for(let k=0;k<3;k++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.015,5,28),new THREE.MeshBasicMaterial({color:'#bddf98'}));ring.rotation.set(k*.8,k*.88,.4);this.wisp.add(ring);
    }
    this.scene.add(this.wisp);this.wisp.visible=false;
    this.selection=this.makeRing(.54,'#bfea8f',.055);this.scene.add(this.selection);this.selection.visible=false;
    this.hpShape=new THREE.PlaneGeometry(1,1);
    this.darkBar=new THREE.MeshBasicMaterial({color:0x24372d,depthWrite:false,depthTest:false});
    this.fillBar=new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false,depthTest:false});
    this.markerGeo=new THREE.RingGeometry(.75,1,24);
    this.markerGeo.rotateX(-Math.PI/2);
    this.markerMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.83,side:THREE.DoubleSide,depthWrite:false});
    this.trailGeo=new THREE.SphereGeometry(1,8,5);
    this.iceGeo=new THREE.OctahedronGeometry(1,0);
    this.trailMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.94,depthWrite:false});
  }
  instances(key,count,g,mat,cast=false) {
    let mesh=this.dynamic[key];
    if(!mesh||mesh.instanceMatrix.count<count){
      if(mesh){this.scene.remove(mesh);mesh.dispose();}
      mesh=new THREE.InstancedMesh(g,mat,Math.max(16,2**Math.ceil(Math.log2(count||1))));
      mesh.castShadow=cast;mesh.receiveShadow=cast;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);this.dynamic[key]=mesh;
    }
    mesh.count=count;mesh.visible=count>0;return mesh;
  }
  entityPose(object,e,scale=1,offset=0) {
    const move=e.moving||e.state==='moving';
    const step=Math.sin(this.simTime*10+e.x*.025);
    const strike=Math.sin(Math.PI*THREE.MathUtils.clamp(((e.attackUntil||0)-this.simTime)/.35,0,1));
    object.position.set(e.x/TILE,this.surface(e.x,e.y)+offset+(move?Math.abs(step)*.036:0),-e.y/TILE);
    const angle=Number.isFinite(e.angle)?e.angle:0;
    object.rotation.set(0,Math.PI/2+angle,0);
    object.rotateX(strike*.27+(move?.055:0));object.rotateZ(move?step*.065:0);
    object.translateZ(strike*.13);
    object.scale.setScalar(scale);
  }
  frameEntities(sim) {
    this.entities=[];
    this.simTime=sim.time??this.time;
    const valid=e=>e&&e.hp!==0&&e.alive!==false&&Number.isFinite(e.x)&&Number.isFinite(e.y);
    const enlisted=[];
    const groups={paladin:[],archmage:[],bloodMage:[],mountainKing:[],elemental:[]};
    for(const model of Object.values(enemyModels)) groups['enemy-'+model]=[];
    for(const e of sim.enemies) if(valid(e)) groups['enemy-'+(enemyModels[e.rawcode]||'troll')].push(e);
    for(const ally of sim.allies||[])if(valid(ally))groups[ally.summoned?'elemental':heroModels[ally.rawcode]||'paladin'].push(ally);
    for(const [model,people] of Object.entries(groups)){
      const type=model.startsWith('enemy-')?'enemies':'allies';
      const batch=this.instances(model,people.length,this.art[model.replace(/^enemy-/,'')],this.solid,true);
      people.forEach((e,i)=>{
        const altitude=e.rawcode==='nhrh'?.36+.07*Math.sin(this.time*3+e.x*.1):0;
        this.entityPose(matrixObject,e,e.boss||e.illusion?1.45:type==='enemies'?1.09:.84,altitude);
        if(e.bladesUntil>sim.time)matrixObject.rotateY(this.time*13);
        matrixObject.updateMatrix();
        batch.setMatrixAt(i,matrixObject.matrix);
        if(type==='enemies')batch.setColorAt(i,e.illusion?mirrorTint:colForEnemy(e.rawcode));
        this.entities.push({id:e.id,x:e.x,y:e.y,height:.48,radius:54,kind:type});
        if(e.hp<e.maxHp)enlisted.push({e,height:type==='enemies'?1.09:1.32,color:type==='enemies'?'#e87962':'#8dd493'});
      });batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
    }
    const hasHero=valid(sim.hero)&&!['ready','choose'].includes(sim.phase);
    this.hero.visible=this.heroOutline.visible=this.heroMarker.visible=!!hasHero;
    this.wisp.visible=!!valid(sim.wisp);
    if(hasHero){
      const model=sim.heroDefinition?.model || heroModels[sim.hero.rawcode] || 'paladin';
      this.hero.geometry=this.heroOutline.geometry=this.art[model];
      const avatar=sim.hero.avatar?.until>sim.time;
      this.entityPose(this.hero,sim.hero,avatar?1.60:1.12);this.hero.updateMatrix();
      this.heroOutline.matrixAutoUpdate=false;this.heroOutline.matrix.copy(this.hero.matrix);this.heroOutline.matrixWorldNeedsUpdate=true;
      this.heroOutline.visible=false;
      if(Math.hypot(sim.hero.x-this.statue.x,sim.hero.y-this.statue.y)<4*TILE){
        const chest=this.hero.position.clone();chest.y+=.82;
        this.occlusionRay.set(chest.addScaledVector(playDirection,12),v.copy(playDirection).negate());
        this.heroOutline.visible=this.occlusionRay.intersectObject(this.athena,false).length>0;
      }
      this.heroMarker.position.copy(this.hero.position);this.heroMarker.position.y+=1.97+Math.sin(this.time*3)*.055;this.heroMarker.rotation.y=this.time*.78;
      this.entities.push({id:sim.hero.id,x:sim.hero.x,y:sim.hero.y,height:.69,radius:71,kind:'hero'});
      enlisted.push({e:sim.hero,height:1.69,color:'#b7e78c'});
    }
    if(this.wisp.visible){
      const w=sim.wisp;this.wisp.position.set(w.x/TILE,this.ground(w.x,w.y)+.48+Math.sin(this.time*2.6)*.09,-w.y/TILE);this.wisp.rotation.y=this.time*.81;
      this.entities.push({id:w.id,x:w.x,y:w.y,height:.50,radius:62,kind:'wisp'});
    }
    const selected=hasHero?sim.hero:this.wisp.visible?sim.wisp:null;
    this.selection.visible=!!selected;
    if(selected)this.selection.position.set(selected.x/TILE,this.surface(selected.x,selected.y)+.06,-selected.y/TILE);
    const st=sim.statue||this.statue;
    this.entities.push({id:st.id??'statue',x:st.x,y:st.y,height:1.85,radius:198,kind:'statue'});
    this.statueRing.visible=sim.phase==='wave'&&st.hp<st.maxHp;
    const bg=this.instances('bar-bg',enlisted.length,this.hpShape,this.darkBar);
    const fill=this.instances('bar-fill',enlisted.length,this.hpShape,this.fillBar);
    bg.renderOrder=8;fill.renderOrder=9;
    const right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion),front=new THREE.Vector3(0,0,1).applyQuaternion(this.camera.quaternion);
    const col=new THREE.Color();
    enlisted.forEach(({e,height,color},i)=>{
      const w=e===sim.hero?.80:.58,h=.065,fraction=THREE.MathUtils.clamp(e.hp/e.maxHp,0,1);
      matrixObject.position.set(e.x/TILE,this.surface(e.x,e.y)+height,-e.y/TILE);matrixObject.quaternion.copy(this.camera.quaternion);matrixObject.scale.set(w+.035,h+.026,1);matrixObject.updateMatrix();bg.setMatrixAt(i,matrixObject.matrix);
      matrixObject.position.addScaledVector(right,-w*(1-fraction)/2).addScaledVector(front,.014);
      matrixObject.scale.set(Math.max(.001,w*fraction),h,1);matrixObject.updateMatrix();fill.setMatrixAt(i,matrixObject.matrix);fill.setColorAt(i,col.set(color));
    });
    bg.instanceMatrix.needsUpdate=fill.instanceMatrix.needsUpdate=true;if(fill.instanceColor)fill.instanceColor.needsUpdate=true;
    this.frameEffects(sim.effects||[]);
  }
  frameEffects(effects) {
    const visible=effects.filter(e=>Number.isFinite(e.x)&&Number.isFinite(e.y));
    const rings=this.instances('effects',visible.length,this.markerGeo,this.markerMat);
    const projectiles=visible.filter(e=>Number.isFinite(e.tx)&&Number.isFinite(e.ty));
    const bolts=this.instances('bolts',projectiles.length,this.trailGeo,this.trailMat);
    const snow=visible.filter(e=>e.type==='blizzard');
    const shards=this.instances('snow',snow.length*10,this.iceGeo,this.trailMat);
    const color=new THREE.Color();
    visible.forEach((e,i)=>{
      const t=THREE.MathUtils.clamp(1-(e.life??.25)/(e.maxLife||1),0,1),type=String(e.type||'');
      const attack=/attack|hit|slash|axe|strike/i.test(type),heal=/heal|light|potion/i.test(type);
      const size=(effectRadius[type]??(type==='taunt'?2.1:heal?.97:.48))*(.35+.90*t);
      matrixObject.position.set(e.x/TILE,this.ground(e.x,e.y)+.09,-e.y/TILE);
      matrixObject.rotation.set(0,0,0);matrixObject.scale.setScalar(size);matrixObject.updateMatrix();rings.setMatrixAt(i,matrixObject.matrix);
      rings.setColorAt(i,color.set(effectColor[type]|| (attack?'#eba276':heal?'#e3df8a':type==='taunt'?'#edbb68':'#b2e8a3')));
    });
    projectiles.forEach((e,i)=>{
      const t=THREE.MathUtils.clamp(1-(e.life??0)/(e.maxLife||1),0,1),x=THREE.MathUtils.lerp(e.x,e.tx,t),y=THREE.MathUtils.lerp(e.y,e.ty,t);
      matrixObject.position.set(x/TILE,this.ground(x,y)+.62+Math.sin(t*Math.PI)*.34,-y/TILE);matrixObject.rotation.set(0,0,0);matrixObject.scale.setScalar(e.type==='storm'?.16:.096);matrixObject.updateMatrix();bolts.setMatrixAt(i,matrixObject.matrix);bolts.setColorAt(i,color.set(/heal|light/i.test(e.type)?'#ffeea6':/frost|storm/.test(e.type)?'#a5dbf1':'#e0aa63'));
    });
    snow.forEach((effect,index)=>{
      const t=1-effect.life/effect.maxLife;
      for(let n=0;n<10;n++){
        const drift=(t+n*.13)%1,angle=n*2.4+effect.id,r=.32+1.6*Math.sqrt(n/10);
        const x=effect.x/TILE+Math.cos(angle)*r+.25*(1-drift),z=-effect.y/TILE+Math.sin(angle)*r;
        matrixObject.position.set(x,this.ground(x*TILE,-z*TILE)+.08+(1-drift)*2.4,z);
        matrixObject.rotation.set(.09,0,.17);matrixObject.scale.set(.075,.24,.075);matrixObject.updateMatrix();
        const i=index*10+n;shards.setMatrixAt(i,matrixObject.matrix);shards.setColorAt(i,color.set(n%2?'#8dc9eb':'#d7edfc'));
      }
    });
    for(const m of [rings,bolts,shards]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  }
  resize() {
    const w=Math.max(1,this.canvas.clientWidth||window.innerWidth),h=Math.max(1,this.canvas.clientHeight||window.innerHeight);
    if(w===this.width&&h===this.height)return;
    this.width=w;this.height=h;this.aspect=w/h;
    this.renderer.setSize(w,h,false);this.positionCamera();
  }
  positionCamera() {
    const span=this.span,aspect=this.aspect||1;
    Object.assign(this.camera,{left:-span*aspect/2,right:span*aspect/2,top:span/2,bottom:-span/2});
    const h=this.ground(this.center.x,this.center.y);
    const aim=new THREE.Vector3(this.center.x/TILE,h+(this.phase==='ready'?1.40:.28),-this.center.y/TILE);
    if(this.phase==='ready'){
      const right=new THREE.Vector3(viewDir.z,0,-viewDir.x).normalize();
      aim.addScaledVector(right,-span*aspect*(aspect>1.1?.145:.05));
    }
    this.camera.position.copy(aim).addScaledVector(this.phase==='ready'?viewDir:playDirection,32);
    this.camera.lookAt(aim);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.sun.target.position.copy(aim);this.sun.position.copy(aim).add(new THREE.Vector3(-14,23,9));
  }
  focus(x,y) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const b=this.map.bounds||{};
    this.center={x:THREE.MathUtils.clamp(x,b.minX??-6144,b.maxX??6144),y:THREE.MathUtils.clamp(y,b.minY??-6144,b.maxY??6144)};
    this.positionCamera();
  }
  pan(dx,dy) { this.focus(this.center.x+dx,this.center.y+dy); }
  zoom(delta) {
    if(!Number.isFinite(delta))return;
    const factor=Math.abs(delta)<=2?delta*.075:Math.sign(delta)*Math.min(.24,Math.abs(delta)*.001);
    this.span=THREE.MathUtils.clamp(this.span*Math.exp(factor),5.6,32);this.positionCamera();
  }
  groundAt(ndcX,ndcY,precise=false) {
    this.ray.setFromCamera(new THREE.Vector2(ndcX,ndcY),this.camera);
    if(precise){
      const hit=this.ray.intersectObject(this.terrain,false)[0];
      if(hit)return {x:hit.point.x*TILE,y:-hit.point.z*TILE};
    }
    this.groundPlane.constant=-this.ground(this.center.x,this.center.y);
    const hit=this.ray.ray.intersectPlane(this.groundPlane,new THREE.Vector3());
    return hit?{x:hit.x*TILE,y:-hit.z*TILE}:null;
  }
  footprint() { return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>this.groundAt(x,y)).filter(Boolean); }
  pick(clientX,clientY) {
    const r=this.canvas.getBoundingClientRect(),u=(clientX-r.left)/r.width,w=(clientY-r.top)/r.height;
    if(u<0||u>1||w<0||w>1)return null;
    const pos=this.groundAt(u*2-1,1-2*w,true);
    if(!pos)return null;
    let closest=null,best=Infinity;
    for(const target of [...this.entities,...this.selectables]){
      if(target.kind==='altar'&&!this.wisp.visible)continue;
      v.set(target.x/TILE,this.ground(target.x,target.y)+target.height,-target.y/TILE).project(this.camera);
      const px=((v.x+1)/2-u)*r.width,py=((1-v.y)/2-w)*r.height;
      const radius=Math.max(10,(target.radius/TILE)*r.height/this.span);
      const score=Math.hypot(px,py)/radius;
      if(score<1&&score<best){closest=target;best=score;}
    }
    return closest?{x:closest.x,y:closest.y,id:closest.id,kind:closest.kind}:pos;
  }
  render(sim,dt=0) {
    this.time+=Number.isFinite(dt)?Math.min(dt,.12):0;
    this.resize();
    if(sim.phase!==this.phase){
      const previous=this.phase;this.phase=sim.phase;
      this.shrine.scale.setScalar(this.phase==='ready'?1:.49);
      if(sim.phase==='ready'){this.span=this.aspect>1?7.7:9.8;this.focus(this.statue.x,this.statue.y);}
      else if(sim.phase==='choose'){
        this.span=this.aspect>1?11.4:14;
        const points=[sim.wisp||this.altar,...this.roster.map(h=>h.altar)];
        const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
        this.focus((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2);
      }else if(!sim.wisp&&(previous==='choose'||previous==='ready'||previous===null)){this.span=this.aspect>1?13.8:16;this.focus(sim.hero?.x??this.statue.x,sim.hero?.y??this.statue.y);}
    }
    if(this.hadWisp&&sim.hero&&!sim.wisp){
      this.span=this.aspect>1?13.8:16;
      this.focus(sim.hero.x,sim.hero.y);
    }
    this.hadWisp=!!sim.wisp;
    this.frameEntities(sim);
    this.motes.rotation.y=Math.sin(this.time*.09)*.12;this.motes.position.y=Math.sin(this.time*.55)*.14;
    if(this.waterMap)this.waterMap.offset.set(this.time*.007,this.time*.002);
    for(const {sprite,size,phase} of this.glows)sprite.scale.setScalar(size*(1+Math.sin(this.time*3.5+phase)*.06));
    this.altarRings.forEach((ring,i)=>{ring.material.opacity=.68+Math.sin(this.time*3.4+i*.7)*.25;});
    this.renderer.render(this.scene,this.camera);
  }
}
