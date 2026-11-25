import * as THREE from 'three';

const geometry = new Map();
const transform = new THREE.Object3D();
const vertex = new THREE.Vector3();
const tint = new THREE.Color();
const teal = '#36877d';
const gilt = '#d8ab59';
const paleGold = '#ffe4a0';
const bronze = '#796342';
const marble = '#dfd7b5';
const limestone = '#abb2a6';
const basalt = '#566e71';
const deepStone = '#334a50';

function shape(key, create) {
  if (!geometry.has(key)) geometry.set(key, create().toNonIndexed());
  return geometry.get(key);
}

const boxShape = () => shape('box', () => new THREE.BoxGeometry(1, 1, 1));
const ballShape = () => shape('ball', () => new THREE.SphereGeometry(1, 10, 7));
const cylinderShape = (top, sides) => shape('c' + top + '/' + sides, () => new THREE.CylinderGeometry(top, 1, 1, sides, 1));
const leafShape = () => shape('leaf', () => new THREE.SphereGeometry(1, 5, 3));

// Bake the parts of a sculpture into one vertex-colored mesh, shared by its instances.
class Sculpture {
  constructor() { this.positions = []; this.colors = []; }
  add(g, color, x, y, z, sx=1, sy=1, sz=1, rx=0, ry=0, rz=0) {
    transform.position.set(x,y,z); transform.scale.set(sx,sy,sz);
    transform.rotation.set(rx,ry,rz); transform.updateMatrix();
    tint.set(color);
    const pos = g.getAttribute('position');
    for (let i=0; i<pos.count; i++) {
      vertex.fromBufferAttribute(pos,i).applyMatrix4(transform.matrix);
      this.positions.push(vertex.x,vertex.y,vertex.z);
      this.colors.push(tint.r,tint.g,tint.b);
    }
  }
  box(c,x,y,z,w,h,d,rx=0,ry=0,rz=0) { this.add(boxShape(),c,x,y,z,w,h,d,rx,ry,rz); }
  ball(c,x,y,z,w,h,d,rx=0,ry=0,rz=0) { this.add(ballShape(),c,x,y,z,w,h,d,rx,ry,rz); }
  leaf(c,x,y,z,w,h,d,rx=0,ry=0,rz=0) { this.add(leafShape(),c,x,y,z,w,h,d,rx,ry,rz); }
  cyl(c,x,y,z,r,h,top=1,sides=12,rx=0,ry=0,rz=0) { this.add(cylinderShape(top,sides),c,x,y,z,r,h,r,rx,ry,rz); }
  rod(c,a,b,r,top=1,sides=8) {
    const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const center=new THREE.Vector3(...a).addScaledVector(delta,.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
    const rot=new THREE.Euler().setFromQuaternion(q);
    this.cyl(c,center.x,center.y,center.z,r,delta.length(),top,sides,rot.x,rot.y,rot.z);
  }
  ring(c,x,y,z,r,thick,sides=48,rx=Math.PI/2,ry=0,rz=0) {
    const key='ring'+(thick/r).toFixed(4)+'/'+sides;
    this.add(shape(key,()=>new THREE.TorusGeometry(1,thick/r,5,sides)),c,x,y,z,r,r,r,rx,ry,rz);
  }
  // Hem, waist and shoulders have different radii. Fluting gives the stone drapery deep folds.
  robe(c,levels,folds=12) {
    const n=folds*2;
    const point=(l,j)=>{
      const [y,rx,rz,twist,offsetX=0,offsetZ=0]=l, a=Math.PI*2*j/n+twist, fac=j%2?.85:1;
      return [offsetX+Math.sin(a)*rx*fac,y,offsetZ+Math.cos(a)*rz*fac];
    };
    tint.set(c);
    for(let i=1;i<levels.length;i++)for(let j=0;j<n;j++){
      const a=point(levels[i-1],j),b=point(levels[i-1],j+1),c1=point(levels[i],j),d=point(levels[i],j+1);
      this.positions.push(...a,...b,...c1,...b,...d,...c1);
      for(let k=0;k<6;k++)this.colors.push(tint.r,tint.g,tint.b);
    }
  }
  finish() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors,3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}

function athena(s) {
  const base=0.7;
  s.cyl(deepStone,0,.10,0,1.67,.2,.96,8); s.cyl(basalt,0,.25,0,1.48,.17,.97,8);
  s.cyl(bronze,0,.35,0,1.39,.08,1,8); s.cyl(limestone,0,.49,0,1.27,.24,.94,8);
  s.cyl(gilt,0,.63,0,1.22,.045,1,8); s.cyl(marble,0,.69,0,1.19,.09,.94,8);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    s.box(gilt,Math.sin(a)*1.24,.49,Math.cos(a)*1.24,.29,.055,.045,0,a,.18);
  }
  s.ball(limestone,-.16,base+.07,.10,.23,.11,.35);
  s.ball(marble,.19,base+.07,.22,.21,.10,.34);
  s.robe(marble,[[.76,.67,.43,0],[.87,.63,.39,.04],[1.38,.49,.34,.13],[1.87,.35,.28,.28],[2.07,.30,.24,.18]]);
  s.robe('#c1bfa5',[[.79,.45,.32,0,-.14,-.13],[1.15,.44,.34,.14,-.16,-.10],[1.77,.29,.22,.02,-.15,-.14],[2.59,.40,.23,0,-.05,-.13]],9);
  s.robe('#dad5b7',[[1.91,.34,.27,.03],[2.04,.34,.28,.08],[2.35,.44,.30,.03],[2.54,.45,.23,0],[2.64,.24,.20,0]],10);
  s.add(cylinderShape(.99,14),gilt,0,1.98,.008,.355,.12,.273);
  s.ball(bronze,0,1.99,.262,.116,.10,.027);
  s.rod(gilt,[-.30,2.60,.12],[.22,2.03,.22],.064,.89);
  s.ball(marble,0,2.69,0,.15,.22,.15);
  s.ball('#998f75',.008,2.92,-.075,.268,.35,.24);
  s.ball('#e7d8b4',0,2.96,.044,.239,.295,.217);
  s.leaf(marble,0,2.94,.244,.057,.082,.063);
  s.box('#7e7f70',-.095,3.005,.236,.068,.017,.021,0,-.18,.06);
  s.box('#7e7f70',.095,3.005,.236,.068,.017,.021,0,.18,-.06);
  s.box('#aa9a80',0,2.856,.233,.068,.014,.014);
  s.ball('#b59c68',0,3.16,-.012,.268,.22,.243);
  s.ball(gilt,0,3.13,.05,.28,.085,.249);
  for(const sign of [-1,1]){
    s.leaf(gilt,sign*.222,2.99,.026,.078,.22,.12,0,0,sign*.18);
    s.leaf('#b7944f',sign*.176,3.18,.127,.084,.17,.10,0,0,sign*.34);
  }
  s.rod(bronze,[0,3.22,-.19],[0,3.33,.15],.08,.85);
  for(let i=0;i<12;i++){
    const a=i/11*Math.PI;
    s.leaf(i%2?'#a77038':'#c59350',0,3.27+Math.sin(a)*.18,-.03+Math.cos(a)*.30,.085,.16,.07,a-Math.PI*.42,0,0);
  }
  s.ball(marble,-.42,2.45,-.01,.19,.20,.21);
  s.rod(marble,[-.46,2.42,.01],[-.65,2.06,.18],.145,.76);
  s.rod(marble,[-.65,2.08,.18],[-.69,2.43,.37],.112,.83);
  s.ball('#e7d8b4',-.71,2.43,.37,.125,.12,.11);
  s.cyl(bronze,-.73,2.26,.38,.041,3.05,1,8);
  s.cyl(gilt,-.73,3.75,.38,.070,.11,.76,8);
  s.leaf(paleGold,-.73,3.98,.38,.114,.305,.058);
  s.cyl(gilt,-.73,.75,.38,.056,.18,.62,8);
  s.ball(marble,.40,2.48,.015,.19,.18,.18);
  s.rod(marble,[.44,2.43,.035],[.59,2.04,.075],.14,.77);
  s.rod(marble,[.59,2.04,.075],[.50,1.91,.27],.106,.86);
  s.ball(bronze,.59,1.86,.30,.44,.59,.105,.04,.14,-.19);
  s.ball(teal,.60,1.86,.369,.395,.537,.085,.04,.14,-.19);
  s.ball(gilt,.60,1.86,.442,.18,.20,.044);
  for(let j=0;j<14;j++){const a=j*Math.PI/7;s.ball(paleGold,.6+Math.cos(a)*.326,1.86+Math.sin(a)*.453,.416,.023,.022,.018);}
  s.leaf('#efe2ad',.60,1.86,.483,.094,.13,.026,0,0,.18);
}

function paladin(s) {
  const steel='#94b6c1', blue='#244a79', gold='#efbb62', dark='#384751',skin='#d1a084';
  for(const k of [-1,1]){
    s.ball(dark,k*.14,.13,.063,.106,.13,.18);
    s.rod(steel,[k*.15,.17,.02],[k*.12,.54,0],.105,.9);
    s.ball(gold,k*.15,.32,.087,.105,.105,.067);
  }
  s.robe(blue,[[.33,.28,.20,0],[.63,.231,.149,.02],[.88,.27,.17,0]],6);
  s.box('#2b4174',0,.6,-.17,.47,.64,.095,-.22);
  s.ball(steel,0,.72,.014,.256,.24,.171);
  s.box(gold,0,.78,.15,.064,.22,.035,0,0,-.25);
  s.box('#654b35',0,.56,0,.442,.06,.30);
  for(const k of [-1,1]){
    s.ball(gold,k*.252,.845,0,.162,.126,.189);
    s.ball(steel,k*.25,.872,.024,.137,.103,.149);
    s.rod(steel,[k*.267,.79,.03],[k*.34,.57,.11],.087,.83);
    s.ball(skin,k*.34,.57,.12,.077,.083,.08);
  }
  s.ball(skin,0,1.04,.029,.146,.174,.135);
  s.ball('#b78d57',0,.971,.089,.138,.143,.09);
  s.ball(steel,0,1.15,0,.166,.128,.156);
  s.box(gold,0,1.101,.131,.227,.044,.066);
  s.leaf(blue,0,1.275,-.038,.070,.149,.132,-.37);
  s.rod('#755739',[.28,.39,-.033],[.48,.83,.26],.037,1);
  s.box(steel,.49,.86,.267,.34,.203,.206,-.52,.28,-.32);
  s.box(gold,.49,.861,.27,.109,.218,.224,-.52,.28,-.32);
}

function troll(s) {
  const moss='#699462',skin='#76a96e',leather='#79513b';
  s.ball(leather,0,.33,-.026,.126,.158,.14);
  s.ball(moss,0,.51,.014,.19,.21,.138,-.2);
  for(const k of [-1,1]){
    s.rod(moss,[k*.09,.34,0],[k*.12,.14,.04],.067,.84);
    s.ball(leather,k*.12,.074,.086,.078,.061,.13);
    s.rod(skin,[k*.16,.56,.031],[k*.26,.35,.13],.08,.67);
    s.leaf(skin,k*.144,.69,-.004,.106,.05,.05,0,0,k*.45);
  }
  s.ball(skin,0,.697,.081,.147,.143,.136);
  s.leaf('#b15c40',0,.824,.009,.056,.146,.11,-.32);
  s.leaf('#eee0b1',-.079,.657,.205,.027,.058,.025,-.35);
  s.leaf('#eee0b1',.079,.657,.205,.027,.058,.025,-.35);
  s.box('#e99e50',0,.723,.203,.144,.018,.018);
  s.rod('#7d6147',[.218,.20,.03],[.35,.69,.33],.028,1);
  s.leaf('#a0b5aa',.352,.735,.36,.051,.12,.043,-.43);
}

function mage(s,blood) {
  const cloth=blood?'#783d43':'#39667e',trim=blood?gilt:'#c4cbb8';
  const skin=blood?'#dcb188':'#cca789',hair=blood?'#d6a551':'#e0dbc6';
  s.robe(cloth,[[.05,.28,.22,0],[.39,.23,.20,.09],[.68,.17,.13,.14],[.88,.254,.15,.02]],8);
  s.robe(trim,[[.14,.10,.045,0,0,.17],[.62,.075,.035,0,0,.13],[.86,.13,.04,0,0,.13]],5);
  s.ball(skin,0,1.02,.025,.143,.18,.126);s.ball(hair,0,1.11,-.032,.15,.13,.135);
  if(blood){
    for(const k of [-1,1])s.leaf(skin,k*.14,1.06,-.007,.098,.044,.05,0,0,k*.48);
    s.leaf(hair,0,.987,-.09,.14,.22,.065);
  }else{
    s.leaf(hair,0,.926,.112,.126,.18,.064,-.26);
    s.cyl(cloth,0,1.22,0,.173,.30,.065,9,0,0,-.11);
  }
  for(const k of [-1,1]){
    s.ball(trim,k*.23,.86,0,.111,.078,.143);
    s.rod(cloth,[k*.22,.84,0],[k*.305,.63,.095],.092,.81);
    s.ball(skin,k*.304,.62,.10,.06,.068,.06);
  }
  s.rod(bronze,[.33,.06,.10],[.33,1.39,.1],.03,.80);
  s.ring(gilt,.33,1.42,.1,.107,.027,12,0);
  s.leaf(blood?'#e3b269':'#80bfc1',.33,1.44,.1,.062,.097,.062);
}
function mountainKing(s){
  const mail='#758f9a',leather='#705742',beard='#d29c64';
  for(const k of [-1,1])s.ball(leather,k*.14,.111,.065,.121,.116,.16);
  s.ball(mail,0,.42,0,.28,.29,.20);
  s.ball('#c1a085',0,.742,.049,.185,.176,.146);
  s.ball(beard,0,.651,.144,.16,.183,.102);s.leaf(beard,0,.55,.187,.096,.14,.065);
  s.ball(mail,0,.858,.012,.194,.125,.161);s.box(gilt,0,.836,.134,.27,.033,.043);
  for(const k of [-1,1]){
    s.leaf('#dfd3a3',k*.173,.869,0,.06,.129,.065,0,0,k*.58);
    s.ball(gilt,k*.247,.535,.015,.137,.113,.155);
    s.rod(leather,[k*.265,.52,.02],[k*.34,.36,.10],.079,.76);
    s.rod(bronze,[k*.3,.23,.09],[k*.43,.57,.23],.029,1);
    s.leaf(mail,k*.45,.61,.23,.136,.113,.052,-.32,0,-k*.44);
  }
}

function tree(s, variant) {
  const trunk=variant===1?'#685746':'#5d5142';
  s.rod(trunk,[0,0,0],[.055,1.51,.036],.145,.61,7);
  for(let i=0;i<4;i++){const a=i*1.571+.36;s.rod(trunk,[0,.76,0],[Math.cos(a)*.54,1.52,Math.sin(a)*.52],.078,.45,6);}
  if(variant===2){
    for(let i=0;i<4;i++)s.cyl(['#325849','#386b53','#477956','#588460'][i],0,1.04+i*.46,0,.88-i*.151,.98-i*.076,.025,8,0,i*.49);
  }else{
    const colors=variant===1?['#557a58','#729465','#859e68','#64865a']:['#325f52','#43745b','#4f805c','#5d8865'];
    for(let j=0;j<6;j++){
      const a=j*2.4;s.leaf(colors[j%4],Math.cos(a)*.47,1.65+(j%3)*.19,Math.sin(a)*.44,.72,.67,.65,.13,a,.16);
    }
    s.leaf(colors[2],.01,2.31,.01,.7,.58,.73,0,.43);
  }
  for(let i=0;i<4;i++){const a=i*1.57;s.rod(trunk,[0,.35,0],[Math.cos(a)*.31,.035,Math.sin(a)*.31],.086,.54,5);}
}

function rock(s) {
  s.leaf('#657b77',0,.29,0,.65,.44,.52,0,.34,.03);
  s.leaf('#879491',-.32,.22,.17,.34,.3,.40,.12,-.26,.04);
  s.leaf('#718767',.04,.54,0,.48,.13,.31,-.16,.2);
}
function fern(s) {
  for(let i=0;i<7;i++){
    const a=i*2.4;
    s.leaf(['#4b7957','#799562','#577f60'][i%3],Math.sin(a)*.14,.16,Math.cos(a)*.14,.052,.27,.043,Math.cos(a)*.64,a,-Math.sin(a)*.62);
  }
}
function flowers(s) {
  fern(s);for(let i=0;i<4;i++){const a=i*2.4;s.ball(i%2?'#dfbc7b':'#d8ab96',Math.cos(a)*.16,.27+(i%2)*.06,Math.sin(a)*.16,.061,.045,.058);}
}
function torch(s) {
  s.cyl(basalt,0,.09,0,.25,.18,.87,8);
  s.cyl(bronze,0,.55,0,.093,.84,.8,8);s.cyl(gilt,0,.77,0,.12,.075,1,8);
  s.cyl(bronze,0,1.01,0,.15,.28,1.65,8);s.cyl(gilt,0,1.17,0,.27,.053,1,8);
  s.leaf('#ff993d',0,1.35,0,.144,.31,.144,0,0,-.15);s.leaf('#ffe79c',-.02,1.31,.076,.082,.214,.077);
}
function column(s) {
  s.box(basalt,0,.095,0,.83,.19,.83);s.box(limestone,0,.23,0,.69,.09,.69);
  s.cyl(basalt,0,.32,0,.32,.14,.91,12);
  s.cyl(limestone,0,.87,0,.252,1.02,.91,12);
  s.cyl(gilt,0,1.36,0,.278,.08,1,12);s.box(marble,0,1.47,0,.68,.155,.68);
  s.cyl(bronze,0,1.62,0,.155,.19,1.44,8);
  s.leaf('#ffe292',0,1.84,0,.12,.23,.12,.09);
}
function shop(s) {
  s.box(deepStone,0,.10,0,1.52,.18,1.04);
  s.box('#827159',0,.46,0,1.28,.60,.82);s.box('#c9b895',0,.76,-.07,1.30,.60,.72);
  for(const k of [-1,1])s.box('#665947',k*.58,.69,0,.095,1.03,.85);
  s.box(teal,0,1.17,-.215,1.6,.12,.72,-.52);s.box('#438c80',0,1.17,.24,1.6,.12,.72,.52);
  s.box(gilt,0,1.33,.01,1.62,.075,.10);
  s.box('#625446',0,.53,.55,1.30,.08,.36);
  s.box('#2d3633',0,.69,.307,.65,.37,.04);
  for(let i=0;i<4;i++)s.ball(['#b88243','#d2b45f','#5296a4','#9d695e'][i],-.38+i*.24,.62,.55,.071,.105,.07);
}

function brute(s,fur=false) {
  const hide=fur?'#614539':'#b78767';
  s.ball(hide,0,.66,0,.45,.51,.35);
  s.ball(hide,0,1.10,.06,.27,.28,.23);
  s.ball(fur?'#a6815d':'#c49d7e',0,1.04,.23,.16,.11,.11);
  s.cyl('#664932',0,.45,0,.35,.13,1,8);
  for(const side of [-1,1]) {
    s.ball('#584b40',side*.18,.23,0,.155,.25,.15);
    s.ball(hide,side*.43,.70,.06,.18,.30,.17);
    s.ball('#e5cba1',side*.10,1.14,.26,.037,.028,.025);
    if(fur)s.ball(hide,side*.20,1.32,0,.085,.09,.08);
  }
  s.rod('#61412e',[.46,.37,.15],[.51,.88,.32],.055);
  s.ball('#87705c',.51,.94,.33,.14,.20,.15);
}
function revenant(s,fire=true) {
  const bone='#e0cfac';
  s.ball(bone,0,1.06,0,.17,.19,.16);
  s.box('#4b332c',0,1.06,.13,.22,.065,.045);
  s.rod(bone,[0,.34,0],[0,.92,0],.043);
  for(const sign of [-1,1]) {
    for(let i=0;i<3;i++)s.rod(bone,[0,.63+i*.085,0],[sign*(.17+i*.018),.60+i*.08,.02],.032);
    s.rod(bone,[sign*.09,.44,0],[sign*.17,.06,.05],.043);
    s.rod(bone,[sign*.19,.85,0],[sign*.27,.49,.08],.04);
    if(fire) s.leaf('#ec8736',sign*.15,1.17,-.03,.08,.19,.08);
    else s.leaf(bone,sign*.085,.98,.15,.033,.054,.03,-.35);
  }
  s.rod('#b8b9b2',[.28,.47,.09],[.40,.91,.19],.05,.15);
}
function elemental(s) {
  s.robe('#347f9c',[[.04,.17,.12,0],[.35,.26,.23,.14],[.87,.37,.24,-.07],[1.05,.20,.17,.1]],7);
  s.ball('#77c4d3',0,1.14,0,.20,.22,.19);
  for(const sign of [-1,1]) {
    s.leaf('#87cfda',sign*.31,.81,.04,.17,.32,.14,.15,0,sign*.32);
    s.ball('#e1f5e7',sign*.071,1.17,.17,.038,.027,.024);
  }
}

function polarShaman(s) {
  const fur='#d6d4be', leather='#665c51';
  s.leaf(fur,0,.64,0,.40,.50,.33);
  s.ball(fur,0,1.04,.06,.25,.24,.24);
  s.leaf('#aaae9b',0,.99,.26,.16,.10,.14);
  s.robe('#526b72',[[.21,.32,.22,0],[.52,.29,.21,.13],[.80,.35,.26,0]],6);
  for(const side of [-1,1]){
    s.leaf(fur,.20*side,1.23,0,.082,.088,.065);
    s.leaf(fur,.36*side,.71,.05,.15,.26,.14);
    s.leaf(leather,.17*side,.15,.05,.13,.16,.14);
  }
  s.rod(leather,[.42,.06,.16],[.47,1.47,.14],.047,.68);
  s.leaf('#95d1d9',.47,1.49,.14,.083,.14,.08);
}

function treant(s) {
  s.rod('#66503b',[0,.22,0],[0,.97,.03],.23,.72,7);
  for(const k of [-1,1]){
    s.rod('#5b4d38',[k*.08,.41,0],[k*.23,.03,.11],.10,.48);
    s.rod('#71593d',[k*.11,.81,0],[k*.40,.61,.04],.097,.71);
    s.rod('#71593d',[k*.40,.61,.04],[k*.48,.49,.14],.070,.24);
    s.leaf('#59795a',k*.19,1.07,-.02,.24,.24,.20,.14,0,k*.34);
    s.leaf('#ceab64',k*.066,.87,.17,.033,.025,.025);
  }
  s.leaf('#798c5c',0,1.19,0,.25,.23,.21);
}

function tideGiant(s) {
  const skin='#658b86';
  s.ball(skin,0,.69,0,.42,.46,.31);
  s.leaf('#82a397',0,1.12,.05,.25,.24,.21);
  for(const k of [-1,1]){
    s.leaf('#54746e',k*.18,.23,0,.16,.23,.16);
    s.leaf(skin,k*.39,.70,.06,.18,.27,.17);
    s.leaf('#a4b7a1',k*.24,1.03,-.04,.09,.19,.08,0,0,k*.7);
    s.leaf('#b5b5a0',k*.30,.87,-.09,.08,.11,.07);
  }
  s.rod('#756143',[.40,.33,.11],[.61,.98,.24],.054,1);
  s.leaf('#869b8c',.61,.99,.24,.13,.20,.14);
}

function seaLord(s) {
  const shell='#936d59',claw='#b58263',trim='#cbb995';
  s.leaf(shell,0,.56,0,.39,.29,.45);
  s.leaf(claw,0,.80,.16,.21,.18,.21);
  for(const side of [-1,1]){
    for(const z of [-.22,.03,.26]){
      s.rod(shell,[side*.25,.56,z],[side*.47,.34,z-.06],.065);
      s.rod(trim,[side*.47,.34,z-.06],[side*.53,.04,z+.04],.057,.23);
    }
    s.rod(shell,[side*.28,.65,.16],[side*.51,.82,.32],.092);
    s.leaf(claw,side*.54,.88,.40,.17,.16,.24,-.15);
    s.leaf(trim,side*.59,.91,.57,.048,.076,.15,.24,side*.4);
    s.leaf('#a7ead4',side*.095,.88,.31,.036,.033,.03);
  }
}

function tempest(s) {
  const mist=['#617e91','#7aaabd','#b1d4dc','#d6e8e3'];
  for(let i=0;i<5;i++){
    const radius=.10+i*.058,angle=i*1.16;
    s.ring(mist[i%4],Math.cos(angle)*.045,.22+i*.22,Math.sin(angle)*.05,radius,.044+i*.006,11,1.39,.12,angle);
    s.leaf(mist[(i+1)%4],Math.cos(angle)*radius,.25+i*.22,Math.sin(angle)*radius,.10,.12,.09,0,angle,.42);
  }
}

function ironGolem(s) {
  const plate='#717f81',shade='#4c5c5b',trim='#ac934e';
  s.box(shade,0,.63,0,.45,.48,.31);
  s.box(plate,0,.94,0,.50,.36,.36);
  s.box(plate,0,1.27,.02,.26,.25,.24);
  s.box('#e5c177',0,1.28,.146,.17,.04,.024);
  for(const k of [-1,1]){
    s.box(plate,k*.17,.26,0,.22,.48,.24);
    s.box(shade,k*.17,.075,.055,.25,.14,.33);
    s.leaf(trim,k*.35,1.04,0,.20,.15,.18);
    s.box(plate,k*.41,.72,.055,.23,.43,.24,0,0,k*.10);
    s.box(shade,k*.43,.47,.08,.25,.18,.26);
  }
}

function harpy(s) {
  s.leaf('#7c686c',0,.76,.02,.14,.25,.17);
  s.leaf('#c2a28b',0,1.03,.11,.112,.14,.11);
  for(const k of [-1,1]){
    s.rod('#735a71',[k*.09,.90,0],[k*.43,1.11,-.035],.072,.63);
    for(let i=0;i<4;i++) s.leaf(i%2?'#947c88':'#655a72',k*(.25+i*.115),.90+i*.076,-.07,.13,.28-i*.028,.078,-.32,0,-k*.66);
    s.rod('#b09569',[k*.07,.60,-.02],[k*.095,.40,.12],.035,.6);
    s.leaf('#61575f',k*.085,.65,-.18,.10,.20,.081,-.92);
  }
}

function wolfRider(s) {
  const hide='#6c6764', armor='#796456';
  s.leaf(hide,0,.49,0,.23,.23,.48);
  s.leaf('#898078',0,.67,.34,.18,.20,.22);
  s.leaf(hide,0,.63,.51,.123,.095,.18);
  for(const k of [-1,1]){
    s.leaf(hide,k*.11,.84,.36,.056,.11,.05,0,0,k*.27);
    for(const z of [-.27,.25]) s.rod(hide,[k*.15,.38,z],[k*.19,.055,z+.045],.067,.55);
    s.leaf(armor,k*.19,.58,.02,.091,.17,.10);
  }
  s.leaf('#95867a',0,.42,-.47,.076,.22,.09,-1.02);
  s.ball('#985c48',0,.87,-.04,.15,.21,.13);
  s.ball('#af7056',0,1.11,-.035,.118,.13,.11);
  s.rod(armor,[.12,.91,0],[.25,.75,.11],.061);
  s.rod('#b3b6a8',[.25,.76,.11],[.35,1.24,.26],.062,.08);
}

function bladeMaster(s) {
  const skin='#a75742',iron='#514b43',gold='#c79953',edge='#d9d2c3';
  s.robe('#433e35',[[.14,.24,.19,0],[.51,.20,.15,.1],[.65,.24,.16,0]],6);
  s.leaf(skin,0,.80,.025,.27,.31,.19);
  s.ball(skin,0,1.13,.065,.175,.18,.16);
  s.leaf('#473b33',0,1.32,-.03,.092,.15,.07,-.42);
  s.box('#ebbf60',0,1.16,.206,.16,.026,.022);
  for(const k of [-1,1]){
    s.leaf('#d6c4a2',k*.088,1.066,.199,.034,.054,.031,-.25);
    s.ball(iron,k*.26,.93,-.01,.14,.12,.15);
    s.rod(skin,[k*.26,.91,0],[k*.35,.69,.14],.105,.64);
    s.leaf(iron,k*.13,.12,.05,.105,.12,.15);
  }
  s.rod(iron,[.27,.47,.11],[.41,.79,.21],.042);
  s.rod(gold,[.30,.80,.23],[.51,.73,.18],.032);
  s.rod(edge,[.42,.79,.21],[.60,1.32,.26],.095,.79,4);
  s.rod(edge,[.60,1.32,.26],[.60,1.61,.32],.072,.04,4);
  s.rod(iron,[-.17,.47,-.17],[-.20,1.64,-.20],.031);
  s.box('#a94337',-.35,1.48,-.21,.31,.22,.04,0,0,-.10);
}

export function makeArt() {
  const result={};
  for(const [name,build] of Object.entries({athena,paladin,troll,archmage:s=>mage(s,false),bloodMage:s=>mage(s,true),mountainKing,rock,fern,flowers,torch,column,shop,oak:s=>tree(s,0),birch:s=>tree(s,1),pine:s=>tree(s,2)})){
    const s=new Sculpture();build(s);result[name]=s.finish();
  }
  for(const [name,build] of Object.entries({ogre:brute,furbolg:s=>brute(s,true),skeleton:revenant,elemental,
    shaman:polarShaman,treant,tideGiant,seaLord,tempest,ironGolem,harpy,wolfRider,bladeMaster,orcBones:s=>revenant(s,false)})){
    const s=new Sculpture();build(s);result[name]=s.finish();
  }
  return result;
}
