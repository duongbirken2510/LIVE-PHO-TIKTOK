import * as THREE from './vendor/three.module.js';
const urlParams=new URLSearchParams(location.search||'');
const lowPower=urlParams.get('lite')==='1';
const isStage=urlParams.get('view')==='stage'||urlParams.has('overlay')||/\.trycloudflare\.com$/i.test(location.hostname||'');
const isMutedStage=urlParams.get('mute')==='1';
const stageId=isStage?('st_'+Math.random().toString(36).slice(2,10)):'';
if(lowPower)document.documentElement?.classList?.add('lite');
if(isStage){document.documentElement?.classList?.add('is-stage');document.body?.classList?.add('overlay');}
const $=id=>document.getElementById(id);

const FAKE_NAMES=['Lan Anh','Minh Tuấn','Bé Na 🌸','Hoàng Long','Thu Trang','Quốc Bảo','Tuấn Hải Phòng','Ngọc Hà Nội'];
const pickViewer=()=>{const typed=$('viewer')?.value?.trim();if(typed)return typed;return FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)];};

// MENU CATALOG START
const dishes=[
 {name:'Bò Tái Mềm',detail:'Thịt bò thăn thái mỏng trần tái hồng ngọt, gừng nướng & hành hoa'},
 {name:'Nạm & Gầu Giòn',detail:'Nạm bò hầm mềm rục, gầu vàng giòn sần sật thơm quế hồi'},
 {name:'Bò Viên Gân',detail:'Bò viên gân dai giòn ngập trong nước dùng xương ống ngọt thanh'},
 {name:'Gà Ta Lá Chanh',detail:'Thịt gà ta xé phay da vàng giòn rắc lá chanh non thái chỉ'},
 {name:'Quẩy Giòn Nóng',detail:'Quẩy nóng vàng ươm giòn rụm chấm ngập nước phở béo ngậy'},
 {name:'Trứng Chần & Hành',detail:'Trứng gà ta chần lòng đào béo ngậy phủ hành hoa xanh mướt'}
];
const menus=[...dishes.slice(0,5).map((dish,i)=>({name:i<4?'Phở '+dish.name:dish.name,dishes:[i],detail:dish.detail})),
 {name:'Phở Đặc Biệt',dishes:[0,1,2]},
 {name:'Tô Xe Lửa VIP',dishes:[0,4,5]},
 {name:'Bao Trọn Quán Phở',dishes:[0,1,2,3,4,5]}
];
for(const menu of menus)menu.detail??=menu.dishes.map(i=>dishes[i].name).join(' + ');
const giftBindings=[['incense','🌹','Rose'],['temple','🫰','Finger Heart'],['tree','🌷','Rosa'],['fruit','🌶️','Perfume'],['lamp','🍩','Doughnut'],['lantern','🕊️','Paper Crane'],['bell','🫶','Hand Heart'],['grand','🌌','Galaxy']];
const giftArtIds=["5655", "5487", "8913", "5658", "5879", "5659", "6968", "11046"];
const gifts=giftBindings.map(([action,icon,gift],i)=>[action,icon,menus[i].name,gift]);
function giftImage(index,gift){return `<span class="tiktok-gift gift-${giftArtIds[index]}" role="img" aria-label="${gift}"></span>`;}
// MENU CATALOG END

// ORDER QUEUE START
export class OrderQueue{
 constructor(){this.pending=[];this.active=null;this.nextId=0;this.served=0;}
 enqueue(e,preview=false){const index=['incense','temple','tree','fruit','lamp','lantern','bell','grand'].indexOf(e.action),count=Number(e.count??1);if(index<0||!Number.isInteger(count)||count<1||count>100)return null;const name=String(e.name||'Khách quý').slice(0,40),same=this.pending.find(o=>o.name===name&&o.index===index&&o.preview===preview);if(same){same.count+=count;return same;}const o={id:++this.nextId,index,name,count,preview};if(preview)this.pending.push(o);else{const firstDemo=this.pending.findIndex(p=>p.preview);if(firstDemo<0)this.pending.push(o);else this.pending.splice(firstDemo,0,o);}return o;}
 next(){if(!this.active)this.active=this.pending.shift()||null;return this.active;}
 finish(){if(!this.active)return null;const o=this.active;this.served+=o.count;this.active=null;return o;}
 reset(){this.pending=[];this.active=null;this.served=0;}
 get waiting(){return this.pending.length+(this.active?1:0);}
}
// ORDER QUEUE END

const queue=new OrderQueue(),supporters=new Map(),points=[1,5,10,20,30,99,100,1000];
let demoTimer=null,serviceAge=0,now=0,last=0,celebrationTimer,isPrimarySpeaker=true,remoteStageCount=0,adminMonitor=false;
const audioCfg={masterEnabled:true,musicEnabled:true,voiceEnabled:true,musicVolume:.12,sfxVolume:.35,voiceVolume:1,orderScript:true,greetJoin:true,idleCta:true};
let lastRealNotice=-Infinity;
function notice(t,preview=false){if(preview&&Date.now()-lastRealNotice<6000)return;$('notice').textContent=t;}

function emitTestEvent(type,data){
 if(globalThis.TestRenderer){
  if(type==='gift')receive({action:data.action||'incense',name:data.nickname,count:data.repeatCount||1},true);
  else receive({kind:'social',social:type==='member'?'join':type,name:data.nickname,comment:data.comment,likeCount:data.likeCount,force:true},true);
  return;
 }
 fetch('/api/test/emit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,data})}).catch(()=>{});
}

for(const [index,[action,icon,label,gift]] of gifts.entries()){
 const tile=document.createElement('div');
 tile.innerHTML=`${giftImage(index,gift)}<div class="gift-meta"><b>${label}</b><small>${gift}</small></div>`;
 $('gift-strip').append(tile);
 const b=document.createElement('button');
 b.type='button';
 b.innerHTML=`<strong>${giftImage(index,gift)}<span>${label}</span></strong><small>${gift} · Gọi thử món</small>`;
 b.title=menus[index].detail;tile.title=menus[index].detail;
 if(index>=5){const detail=document.createElement('small');detail.className='menu-combo-detail';detail.textContent=menus[index].detail;b.append(detail);}
 b.onclick=()=>{
  if(globalThis.TestRenderer)receive({action,name:$('viewer').value,count:1},true);
  else emitTestEvent('gift',{nickname:pickViewer(),giftName:gift,diamondCount:points[index],repeatCount:1,action});
 };
 $('actions').append(b);
}

let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:!lowPower});}catch(e){$('render-error').hidden=false;throw e;}
renderer.setSize(450,800,false);renderer.setPixelRatio(lowPower?1:Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=!lowPower;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#bda78a');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#bda78a',27,48);
const camera=new THREE.PerspectiveCamera(39,450/800,.1,60);camera.position.set(0,13.8,18.8);camera.lookAt(0,.6,1.6);
scene.add(new THREE.HemisphereLight('#fff4d4','#6b5342',3.05));const sun=new THREE.DirectionalLight('#ffdf9e',3.5);sun.position.set(-6,12,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-10,right:10,top:12,bottom:-10});scene.add(sun);
const mat=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const cream=mat('#f8ebd0'),hanoiWall=mat('#e4be70'),crimsonWood=mat('#7c241b'),wood=mat('#9c5e34'),steel=mat('#ccd3cf',.78,.24),noodleMat=mat('#fffaf0'),skin=mat('#eab58c'),hair=mat('#2c211b');
const plasticRed=mat('#cf2f25',.05,.45),plasticBlue=mat('#2864b8',.05,.45),bowlCeramic=mat('#fcfaf2',.05,.25),bowlRimBlue=mat('#2d5a88',.05,.3),brothTopMat=mat('#b87432',.1,.22),chopstickMat=mat('#c89352'),nonLaMat=mat('#e8cc8c',0,.8),burnerGlow=new THREE.MeshBasicMaterial({color:'#ff6624'});
const steamMat=new THREE.MeshBasicMaterial({color:'#fffaf2',transparent:true,opacity:.32,depthWrite:false});
const shared=new Set([cream,hanoiWall,crimsonWood,wood,steel,noodleMat,skin,hair,plasticRed,plasticBlue,bowlCeramic,bowlRimBlue,brothTopMat,chopstickMat,nonLaMat,burnerGlow,steamMat]);
function mesh(geo,m,x=0,y=0,z=0,parent=scene){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,m,x,y,z,p){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);}
function sphere(r,m,x,y,z,p){return mesh(new THREE.SphereGeometry(r,12,8),m,x,y,z,p);}
function cylinder(r,h,m,x,y,z,p){return mesh(new THREE.CylinderGeometry(r,r,h,24),m,x,y,z,p);}
box(25,.25,27,mat('#c9b598'),0,-.2,2);box(12,6,.3,hanoiWall,0,2.8,-5);box(.25,5.5,7,cream,-6,2.5,-1.7);box(.25,5.5,7,cream,6,2.5,-1.7);
const grout=mat('#ab997d');for(let x=-6;x<=6;x++)box(.025,.025,20,grout,x,-.06,3);for(let z=-5;z<=15;z++)box(12,.025,.025,grout,0,-.06,z);
const awning=mat('#b82d21');for(let i=0;i<12;i++){box(1,.16,2.2,i%2?cream:awning,-5.5+i,5.4,-3.8);box(1,.45,.1,i%2?cream:awning,-5.5+i,5.13,-2.73);}
function sign(text,w=1024,h=160,bg='#991d16',fg='#ffd966'){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);if(ctx.strokeRect){ctx.strokeStyle=fg;ctx.lineWidth=Math.max(3,Math.floor(h*.045));ctx.strokeRect(10,10,w-20,h-20);}ctx.fillStyle=fg;ctx.font=`bold ${Math.floor(h*.41)}px "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w-44);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:texture});}
const mainSignMesh=mesh(new THREE.PlaneGeometry(6.9,1.08),sign('PHỞ BÒ GIA TRUYỀN • CÔ BA'),0,3.55,-4.78);
mesh(new THREE.PlaneGeometry(2.35,1.05),sign('HẦM XƯƠNG 12H',512,220,'#6e1712','#ffe49c'),-4.3,2.55,-4.75);
mesh(new THREE.PlaneGeometry(2.35,1.05),sign('QUẨY NÓNG GIÒN',512,220,'#6e1712','#ffe49c'),4.3,2.55,-4.75);
box(11,.2,1.8,wood,0,1.15,-3.7);
cylinder(.72,.22,crimsonWood,3.05,1.36,-3.45);cylinder(.66,.08,burnerGlow,3.05,1.5,-3.45);
cylinder(.76,1.12,steel,3.05,2.08,-3.45);cylinder(.71,.04,brothTopMat,3.05,2.63,-3.45);
box(.18,.07,.12,steel,2.23,2.42,-3.45);box(.18,.07,.12,steel,3.87,2.42,-3.45);
cylinder(.5,.76,steel,-1.35,1.64,-3.55);cylinder(.46,.03,brothTopMat,-1.35,2.01,-3.55);
const steamPuffs=Array.from({length:6},(_,i)=>{const s=sphere(.22,steamMat,3.05,2.7,-3.45);s.castShadow=false;s.receiveShadow=false;s.userData.offset=i/6;return s;});
box(10.4,1.45,2.6,crimsonWood,0,.67,-.7);box(10.4,.13,.1,wood,0,.6,.65);
mesh(new THREE.PlaneGeometry(5.6,.58),sign('PHỞ TÁI • NẠM GẦU • BÒ VIÊN • GÀ TA',1024,120,'#fff3d1','#8b1e16'),0,.82,.62);

function roundedRectangle(x,y,w,h,r){const shape=new THREE.Shape();shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);quadratic(shape,x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);quadratic(shape,x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);quadratic(shape,x,y+h,x,y+h-r);shape.lineTo(x,y+r);quadratic(shape,x,y,x+r,y);return shape;}
function quadratic(s,cx,cy,x,y){s.quadraticCurveTo(cx,cy,x,y);}
const trayCenters=Array.from({length:6},(_,i)=>({x:-3.65+i%3*2.05,z:-1.35+Math.floor(i/3)*1.2}));
const counterShape=roundedRectangle(-5.35,-.75,10.7,2.9,.08);
for(const {x,z} of trayCenters)counterShape.holes.push(roundedRectangle(x-.84,-z-.44,1.68,.88,.1));
const counterSurface=mesh(new THREE.ExtrudeGeometry(counterShape,{depth:.16,bevelEnabled:false,curveSegments:6}),steel,0,1.38,0);counterSurface.rotation.x=-Math.PI/2;
function recessedTray(x,z,index){const group=new THREE.Group();group.name='recessed-food-tray-'+index;scene.add(group);group.position.set(x,0,z);
 const rimShape=roundedRectangle(-.94,-.54,1.88,1.08,.13);rimShape.holes.push(roundedRectangle(-.80,-.40,1.6,.8,.10));
 const lip=mesh(new THREE.ExtrudeGeometry(rimShape,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,curveSegments:6}),steel,0,1.60,0,group);lip.rotation.x=-Math.PI/2;
 const top=roundedRectangle(-.8,-.4,1.6,.8,.1).getSpacedPoints(48),bottom=roundedRectangle(-.69,-.29,1.38,.58,.10).getSpacedPoints(48),positions=[];
 for(let i=0;i<48;i++){const a=top[i],b=top[i+1],c=bottom[i],d=bottom[i+1];positions.push(a.x,1.61,-a.y,b.x,1.61,-b.y,c.x,1.42,-c.y,b.x,1.61,-b.y,d.x,1.42,-d.y,c.x,1.42,-c.y);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const innerSteel=steel.clone();innerSteel.side=THREE.DoubleSide;innerSteel.roughness=.32;mesh(geometry,innerSteel,0,0,0,group);
 const base=mesh(new THREE.ShapeGeometry(roundedRectangle(-.69,-.29,1.38,.58,.10),6),innerSteel,0,1.421,0,group);base.rotation.x=-Math.PI/2;
 return group;
}

// FOOD MODELS START — Vietnamese Pho ingredients in 6 stainless trays.
const foodGeometries={round:new THREE.SphereGeometry(1,12,8),block:new THREE.BoxGeometry(1,1,1),grain:new THREE.SphereGeometry(1,6,4),leaf:new THREE.SphereGeometry(1,8,5)};
const sharedGeometries=new Set(Object.values(foodGeometries));
const foodMaterials={};
for(const [name,color] of Object.entries({broth:'#9e5f28',rareBeef:'#c83832',marbling:'#fae0d8',brisket:'#824625',fatGold:'#ecc478',meatball:'#9e6e58',chicken:'#f7e6c4',chickenSkin:'#ecc15c',quay:'#d48c32',egg:'#fff7e0',yolk:'#f28c18',scallion:'#2d8a42',herb:'#3b7a38',vein:'#7ab856',chilli:'#de2b1f',ginger:'#e8c252',star:'#4d2b1a',noodle:'#fffdf7'})){foodMaterials[name]=mat(color,0,['broth','yolk'].includes(name)?.28:.68);shared.add(foodMaterials[name]);}
function foodModel(kind,parent,seed=1){
 const group=new THREE.Group();group.name='food-'+kind;parent.add(group);const batches=new Map();let state=seed+kind*391;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 function part(shape,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const key=shape+':'+color;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({x,y,z,sx,sy,sz,rx,ry,rz});}
 function herbLeaf(x,z,size=.18,y=.17){const a=rand()*6.28;part('leaf','herb',x,y,z,size*.5,.018,size,0,a,.1);part('block','vein',x,y+.016,z,.012,.007,size*1.4,0,a,0);}
 function scallionRing(x,z,y=.18){part('round','scallion',x,y,z,.048,.018,.048);}
 function chilliSlice(x,z,y=.2){const a=rand()*6.28;part('round','chilli',x,y,z,.04,.02,.12,0,a,.12);}
 if(kind===0){for(let i=0;i<11;i++){const x=-.62+(i%4)*.41+(rand()-.5)*.06,z=-.22+Math.floor(i/4)*.22,a=(rand()-.5)*.7;part('round','rareBeef',x,.09+(i%3)*.025,z,.24,.032,.15,0,a,.08);part('block','marbling',x,0.115+(i%3)*.025,z,.2,.008,.025,0,a+.2,0);}for(let i=0;i<6;i++)part('block','ginger',-.45+i*.18,.18,(rand()-.5)*.45,.02,.015,.18,0,rand()*3,0);for(let i=0;i<4;i++)herbLeaf((rand()-.5)*1.2,(rand()-.5)*.5,.15,.18);}
 if(kind===1){part('round','broth',0,.025,0,.9,.045,.48);for(let i=0;i<8;i++){const x=-.58+(i%4)*.39,z=(i<4?-.18:.18),a=(rand()-.5)*.5;part('block','brisket',x,.1,z,.27,.085,.17,0,a,.07);part('block','fatGold',x,.15,z,.25,.035,.155,0,a,.07);}for(let i=0;i<6;i++){const a=i*Math.PI/3;part('block','star',.05+Math.sin(a)*.06,.16,-.26+Math.cos(a)*.06,.025,.025,.13,0,a,0);}for(let i=0;i<6;i++)scallionRing((rand()-.5)*1.3,(rand()-.5)*.55,.18);}
 if(kind===2){part('round','broth',0,.03,0,.9,.05,.48);for(let i=0;i<12;i++){const x=-.6+(i%4)*.4+(rand()-.5)*.06,z=-.2+Math.floor(i/4)*.2;part('round','meatball',x,.14,z,.135,.125,.135);}for(let i=0;i<10;i++)scallionRing((rand()-.5)*1.35,(rand()-.5)*.58,.2);for(let i=0;i<3;i++)chilliSlice((rand()-.5)*1.1,(rand()-.5)*.5,.22);}
 if(kind===3){for(let i=0;i<14;i++){const x=(rand()-.5)*1.35,z=(rand()-.5)*.58,a=rand()*3.14;part('block','chicken',x,.09+rand()*.04,z,.24,.065,.11,0,a,.08);if(i%2===0)part('block','chickenSkin',x,.135+rand()*.03,z,.23,.022,.1,0,a,.08);}for(let i=0;i<12;i++)part('block','scallion',(rand()-.5)*1.3,.18,(rand()-.5)*.55,.014,.01,.19,0,rand()*3.14,0);chilliSlice(.2,.15,.19);chilliSlice(-.3,-.12,.19);}
 if(kind===4){for(let i=0;i<7;i++){const x=-.56+i*.19,a=(i%2?.14:-.12),y=.1+(i%2)*.07;part('block','quay',x-.035,y,0,.075,.07,.68,.06,a,0);part('block','quay',x+.035,y,0,.075,.07,.68,.06,a,0);}}
 if(kind===5){part('round','broth',0,.025,0,.88,.04,.46);for(let i=0;i<22;i++)scallionRing((rand()-.5)*1.4,(rand()-.5)*.6,.08+rand()*.04);for(const [x,z] of [[-.48,-.12],[-.14,.15],[.22,-.14],[.52,.12]]){part('round','egg',x,.13,z,.17,.09,.19,0,rand(),0);part('round','yolk',x,.195,z,.095,.05,.095);}}
 const dummy=new THREE.Object3D();for(const [key,list] of batches){const [shape,color]=key.split(':');const inst=new THREE.InstancedMesh(foodGeometries[shape],foodMaterials[color],list.length);inst.name=kind+':'+color;for(const [i,p] of list.entries()){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx,p.ry,p.rz);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.castShadow=true;inst.receiveShadow=true;group.add(inst);}return group;
}
const trayNames=dishes.map(dish=>dish.name);
for(let i=0;i<6;i++){const {x,z}=trayCenters[i];const tray=recessedTray(x,z,i);const food=foodModel(i,tray,10+i);food.position.set(0,1.455,0);food.scale.set(.74,.8,.60);const card=mesh(new THREE.PlaneGeometry(1.62,.22),sign(trayNames[i],512,96,'#fff4d2','#7d1d15'),x,1.51,z+.57);card.rotation.x=-.5;}
// FOOD MODELS END

const glass=new THREE.MeshPhysicalMaterial({color:'#e6f4f0',transparent:true,opacity:.14,roughness:.1,depthWrite:false});box(.045,1.2,2.5,glass,-5.1,2.17,-.7);box(.045,1.2,2.5,glass,5.1,2.17,-.7);
for(let i=0;i<6;i++)mesh(new THREE.CylinderGeometry(.42,.26,.14,20),bowlCeramic,4.25,1.62+i*.11,-.8);
const shirtColors=['#e14d3b','#3478c6','#e69d28','#3fa36c','#8b5cf6','#ec6b3b','#0ea5e9','#e11d48'];
const pantColors=['#23395d','#27272a','#7c5c3e','#364832','#475569','#312e81'];
const hairPalette=['#231712','#3b2316','#5c341d','#181822','#4a2e1b','#9a6328'];
const skinPalette=[skin,mat('#f6c8a4',0,.48),mat('#e4a87e',0,.52)];
const charMats={
 sclera:mat('#ffffff',0,.18),
 iris:mat('#18100c',.15,.1),
 sparkle:new THREE.MeshBasicMaterial({color:'#ffffff'}),
 blush:new THREE.MeshBasicMaterial({color:'#fb7185',transparent:true,opacity:.48}),
 mouth:mat('#cf2838',0,.35),
 gold:mat('#fbbf24',.78,.2),
 goldGlow:new THREE.MeshBasicMaterial({color:'#fde047',transparent:true,opacity:.36,side:THREE.DoubleSide,depthWrite:false}),
 ruby:mat('#ef4444',.25,.15),
 emerald:mat('#10b981',.25,.15),
 white:mat('#f8fafc',0,.35),
 darkGlass:mat('#111827',.85,.12),
 visorGlass:new THREE.MeshPhysicalMaterial({color:'#38bdf8',transparent:true,opacity:.36,roughness:.12,depthWrite:false}),
 apronCream:mat('#fde68a',0,.55),
 vipSuit:mat('#1e1b4b',.15,.38),
 ribbonRed:mat('#e11d48',.05,.35),
 bambooRing:mat('#c8a464',0,.75)
};
for(const m of [...skinPalette,...pantColors.map(c=>mat(c,0,.62)),...hairPalette.map(c=>mat(c,.08,.45)),...Object.values(charMats)])shared.add(m);
const pantMats=pantColors.map(c=>{const m=mat(c,0,.62);shared.add(m);return m;});
const hairMats=hairPalette.map(c=>{const m=mat(c,.08,.45);shared.add(m);return m;});
const charGeos={
 torso:new THREE.CylinderGeometry(.25,.31,.66,18),
 chest:new THREE.SphereGeometry(.255,16,12),
 waistBelt:new THREE.TorusGeometry(.292,.032,8,20),
 collar:new THREE.TorusGeometry(.125,.028,8,16),
 skirt:new THREE.CylinderGeometry(.29,.37,.22,18),
 neck:new THREE.CylinderGeometry(.09,.105,.15,12),
 head:new THREE.SphereGeometry(.33,20,16),
 ear:new THREE.SphereGeometry(.062,10,8),
 sclera:new THREE.SphereGeometry(.062,12,10),
 iris:new THREE.SphereGeometry(.049,12,10),
 sparkleBig:new THREE.SphereGeometry(.02,8,6),
 sparkleSm:new THREE.SphereGeometry(.011,6,6),
 brow:new THREE.CapsuleGeometry(.015,.075,4,8),
 blush:new THREE.SphereGeometry(.055,10,8),
 nose:new THREE.SphereGeometry(.031,10,8),
 mouth:new THREE.CapsuleGeometry(.021,.052,4,8),
 hairDome:new THREE.SphereGeometry(.342,18,14),
 bun:new THREE.SphereGeometry(.132,12,10),
 bunRing:new THREE.TorusGeometry(.088,.02,6,14),
 ponytail:new THREE.CapsuleGeometry(.088,.25,6,12),
 sideLock:new THREE.CapsuleGeometry(.055,.19,5,10),
 quiff:new THREE.CapsuleGeometry(.068,.16,5,10),
 headband:new THREE.TorusGeometry(.336,.022,8,20),
 capVisor:new THREE.BoxGeometry(.36,.032,.23),
 helmetShell:new THREE.SphereGeometry(.366,18,14),
 helmetVisor:new THREE.CylinderGeometry(.372,.372,.11,18,1,false,-Math.PI*.42,Math.PI*.84),
 glassFrame:new THREE.TorusGeometry(.072,.011,6,16),
 glassBridge:new THREE.BoxGeometry(.06,.014,.014),
 crownBase:new THREE.CylinderGeometry(.175,.145,.1,16),
 crownPeak:new THREE.ConeGeometry(.042,.095,8),
 crownGem:new THREE.SphereGeometry(.024,8,6),
 auraOuter:new THREE.RingGeometry(.48,.62,28),
 auraInner:new THREE.RingGeometry(.30,.38,24),
 armUpper:new THREE.CapsuleGeometry(.092,.28,6,12),
 sleeveCuff:new THREE.CylinderGeometry(.112,.116,.15,14),
 hand:new THREE.SphereGeometry(.102,12,10),
 legThigh:new THREE.CapsuleGeometry(.115,.18,6,12),
 legCalf:new THREE.CapsuleGeometry(.102,.18,6,12),
 shoeUpper:new THREE.BoxGeometry(.25,.12,.38),
 shoeSole:new THREE.BoxGeometry(.27,.05,.42),
 shoeToe:new THREE.SphereGeometry(.125,12,8),
 backpack:new THREE.BoxGeometry(.34,.36,.17),
 backpackTop:new THREE.CylinderGeometry(.17,.17,.17,14),
 button:new THREE.SphereGeometry(.024,8,6),
 nonLaCone:new THREE.ConeGeometry(.55,.28,28),
 nonLaRing1:new THREE.TorusGeometry(.19,.009,6,24),
 nonLaRing2:new THREE.TorusGeometry(.35,.009,6,24),
 nonLaRing3:new THREE.TorusGeometry(.51,.011,6,28),
 nonLaStrap:new THREE.TorusGeometry(.22,.012,6,18)
};
for(const g of Object.values(charGeos))sharedGeometries.add(g);

const FEMALE_RE=/(lan|ngọc|trang|na|hương|linh|thảo|mai|phương|hà|vy|yến|nhi|thu|hồng|hoa|cô|chị|bé|ny|my|thư|bích|diệu|quỳnh|tâm|trinh|vân|nhung|uyền|uyên|🌸|💖|🌷|🦋)/i;
const VIP_RE=/(đại gia|vip|👑|💎|chủ tịch|sếp|tổng tài)/i;
function hashStr(s=''){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}

const customGlbTemplates=new Map();
const glbMixers=new Set();

function person(color,vendor=false,opts={}){
 const root=new THREE.Group(),body=new THREE.Group();scene.add(root);root.add(body);
 const rawName=String(opts.name||'');
 const h=hashStr(rawName||String(opts.seed??color));
 const isVip=!vendor&&(Boolean(opts.isVip)||(Number(opts.menuIndex)>=5)||VIP_RE.test(rawName));
 const isFemale=vendor|| (rawName?FEMALE_RE.test(rawName):(h%2===0));
 const shirt=isVip?charMats.vipSuit:mat(color,0,.55);
 const skinMat=vendor?skinPalette[1]:skinPalette[h%skinPalette.length];
 const hairMat=vendor?hairMats[0]:hairMats[h%hairMats.length];
 const pantMat=vendor?crimsonWood:isVip?charMats.vipSuit:pantMats[h%pantMats.length];
 const shoeMat=isVip?charMats.gold:shirt;

 // 1. Sculpted Rounded Chibi Torso & Collar
 const torso=mesh(charGeos.torso,shirt,0,1.16,0,body);torso.scale.set(1.12,1,.88);
 const chest=mesh(charGeos.chest,shirt,0,1.44,0,body);chest.scale.set(1.12,.58,.86);
 const belt=mesh(charGeos.waistBelt,isVip?charMats.gold:pantMat,0,.86,0,body);belt.rotation.x=Math.PI/2;belt.scale.set(1.08,.85,1);
 const collar=mesh(charGeos.collar,isVip?charMats.gold:charMats.white,0,1.54,.02,body);collar.rotation.x=Math.PI/2+.15;

 if(isFemale&&!vendor){
  const skirt=mesh(charGeos.skirt,isVip?charMats.vipSuit:shirt,0,.84,0,body);skirt.scale.set(1.08,1,.88);
 }
 // Buttons / Tie / Backpack details so both front & back views look rich
 if(isVip){
  box(.07,.34,.04,charMats.ribbonRed,0,1.26,.27,body);
  for(const sx of [-1,1])box(.16,.05,.22,charMats.gold,sx*.32,1.52,0,body);
  for(let b=0;b<3;b++)mesh(charGeos.button,charMats.gold,0,1.02+b*.12,.28,body);
 }else if(!vendor){
  for(let b=0;b<2;b++)mesh(charGeos.button,charMats.white,0,1.26+b*.13,.27,body);
  if(h%3===0){
   const bp=mesh(charGeos.backpack,isFemale?charMats.ribbonRed:charMats.gold,0,1.2,-.25,body);
   const bpTop=mesh(charGeos.backpackTop,isFemale?charMats.ribbonRed:charMats.gold,0,1.38,-.25,body);bpTop.rotation.z=Math.PI/2;
   void bp;
  }else if(h%3===1){
   const hood=mesh(charGeos.bun,shirt,0,1.48,-.22,body);hood.scale.set(1.45,.85,1.1);
  }
 }

 // 2. Neck, Sculpted Head & Expressive 3D Face
 mesh(charGeos.neck,skinMat,0,1.62,0,body);
 const headGroup=new THREE.Group();headGroup.position.set(0,1.98,0);body.add(headGroup);
 const head=mesh(charGeos.head,skinMat,0,0,0,headGroup);head.scale.set(1.05,1.06,.98);
 for(const sx of [-1,1]){
  const ear=mesh(charGeos.ear,skinMat,sx*.33,-.02,-.02,headGroup);ear.scale.set(.65,1.05,.8);
  const blush=mesh(charGeos.blush,charMats.blush,sx*.185,-.055,.278,headGroup);blush.scale.set(1.25,.72,.35);blush.castShadow=false;
 }
 mesh(charGeos.nose,skinMat,0,-.012,.332,headGroup);

 // Eyes with white sclera, glossy dark iris & dual white catchlights
 const eyesGroup=new THREE.Group();headGroup.add(eyesGroup);
 for(const sx of [-1,1]){
  const sc=mesh(charGeos.sclera,charMats.sclera,sx*.115,.025,.282,eyesGroup);sc.scale.set(1,1.08,.52);
  const ir=mesh(charGeos.iris,charMats.iris,sx*.115,.025,.304,eyesGroup);ir.scale.set(1,1.08,.55);
  const sp1=mesh(charGeos.sparkleBig,charMats.sparkle,sx*.115-.017,.048,.342,eyesGroup);sp1.castShadow=false;
  const sp2=mesh(charGeos.sparkleSm,charMats.sparkle,sx*.115+.016,.008,.340,eyesGroup);sp2.castShadow=false;
  const brow=mesh(charGeos.brow,hairMat,sx*.115,.122,.298,headGroup);
  brow.rotation.z=Math.PI/2+(sx*-.09);
 }
 const mouth=mesh(charGeos.mouth,charMats.mouth,0,-.106,.312,headGroup);
 mouth.rotation.z=Math.PI/2;mouth.scale.set(.78,.85,.58);

 // 3. Hairstyles, Hats, Glasses & VIP Crown (positioned cleanly above forehead so face is never covered)
 const hairCap=mesh(charGeos.hairDome,hairMat,0,.135,-.055,headGroup);hairCap.scale.set(1.03,.76,.94);
 let crown=null,aura=null;
 if(vendor){
  // Cô Ba: Traditional Vietnamese Hair Bun + Jade Hairpin + Artisan Non La + Ao Ba Ba Apron
  for(const sx of [-1,1]){
   const lock=mesh(charGeos.sideLock,hairMat,sx*.31,-.02,.04,headGroup);lock.rotation.z=sx*.12;
  }
  mesh(charGeos.bun,hairMat,0,-.03,-.34,headGroup);
  const pin=box(.34,.024,.024,charMats.gold,0,-.03,-.39,headGroup);pin.rotation.z=.22;
  mesh(charGeos.crownGem,charMats.emerald,.17,.01,-.39,headGroup);

  const nonLaGroup=new THREE.Group();nonLaGroup.position.set(0,.38,-.04);nonLaGroup.rotation.x=-.22;headGroup.add(nonLaGroup);
  mesh(charGeos.nonLaCone,nonLaMat,0,0,0,nonLaGroup);
  const r1=mesh(charGeos.nonLaRing1,charMats.bambooRing,0,.04,0,nonLaGroup);r1.rotation.x=Math.PI/2;
  const r2=mesh(charGeos.nonLaRing2,charMats.bambooRing,0,-.04,0,nonLaGroup);r2.rotation.x=Math.PI/2;
  const r3=mesh(charGeos.nonLaRing3,charMats.bambooRing,0,-.13,0,nonLaGroup);r3.rotation.x=Math.PI/2;
  for(const sx of [-1,1])mesh(charGeos.crownGem,charMats.gold,sx*.34,-.08,.02,headGroup);

  // Ao Ba Ba front buttons & embroidered apron
  box(.54,.84,.055,charMats.apronCream,0,1.04,.255,body);
  box(.32,.22,.062,awning,0,1.12,.29,body);
  for(let b=0;b<3;b++)mesh(charGeos.button,charMats.gold,.12,1.34+b*.08,.26,body);
  mesh(charGeos.bun,charMats.apronCream,0,.88,-.27,body);
 }else{
  const styleIdx=h%3;
  if(isFemale){
   for(const sx of [-1,1]){
    const lock=mesh(charGeos.sideLock,hairMat,sx*.31,-.03,.05,headGroup);lock.rotation.z=sx*.12;
   }
   if(styleIdx===0){
    // F0: Double Space Buns (Tóc búi đôi Na Tra)
    for(const sx of [-1,1]){
     mesh(charGeos.bun,hairMat,sx*.25,.27,-.05,headGroup);
     const rib=mesh(charGeos.bunRing,charMats.ribbonRed,sx*.21,.22,-.05,headGroup);rib.rotation.y=sx*.6;rib.rotation.x=.5;
    }
   }else if(styleIdx===1){
    // F1: High Bouncy Ponytail (Tóc đuôi ngựa cao)
    const tie=mesh(charGeos.bunRing,charMats.gold,0,.18,-.32,headGroup);
    const tail=mesh(charGeos.ponytail,hairMat,0,.06,-.42,headGroup);tail.rotation.x=.55;
    void tie;
   }else{
    // F2: Long Bob + Red Ribbon Headband
    const hb=mesh(charGeos.headband,charMats.ribbonRed,0,.11,-.02,headGroup);hb.rotation.x=.15;
    mesh(charGeos.bun,hairMat,0,-.07,-.28,headGroup);
    box(.16,.06,.06,charMats.ribbonRed,.14,.35,.06,headGroup);
   }
  }else{
   if(styleIdx===0||isVip){
    // M0: Trendy Korean Layered Quiff
    for(let q=-1;q<=1;q++){
     const tuft=mesh(charGeos.quiff,hairMat,q*.11,.26,.16,headGroup);
     tuft.rotation.set(.55,q*.25,.35);
    }
   }else if(styleIdx===1){
    // M1: Streetwear Baseball Cap
    const capDome=mesh(charGeos.hairDome,shirt,0,.16,-.04,headGroup);capDome.scale.set(1.06,.72,.96);
    const visor=mesh(charGeos.capVisor,charMats.white,0,.15,.27,headGroup);visor.rotation.x=.10;
    mesh(charGeos.button,charMats.white,0,.39,-.03,headGroup);
   }else{
    // M2: Vietnamese Night Motorbike Half-Helmet
    const helm=mesh(charGeos.helmetShell,shirt,0,.16,-.04,headGroup);helm.scale.set(1.06,.76,.98);
    const hVisor=mesh(charGeos.helmetVisor,charMats.visorGlass,0,.15,.01,headGroup);hVisor.castShadow=false;
   }
  }

  // Eyeglasses or VIP Sunglasses
  if(isVip){
   for(const sx of [-1,1]){
    const lens=box(.14,.085,.03,charMats.darkGlass,sx*.12,.04,.335,headGroup);
    const rim=mesh(charGeos.glassFrame,charMats.gold,sx*.12,.04,.335,headGroup);
    void lens;void rim;
   }
   mesh(charGeos.glassBridge,charMats.gold,0,.05,.34,headGroup);
   // 3D Rotating Golden Crown
   crown=new THREE.Group();crown.position.set(0,.42,0);headGroup.add(crown);
   mesh(charGeos.crownBase,charMats.gold,0,0,0,crown);
   for(let p=0;p<5;p++){
    const ang=p*Math.PI*2/5,px=Math.cos(ang)*.14,pz=Math.sin(ang)*.14;
    mesh(charGeos.crownPeak,charMats.gold,px,.085,pz,crown);
    mesh(charGeos.crownGem,p%2?charMats.ruby:charMats.emerald,px,.14,pz,crown);
   }
   // VIP Golden Floor Aura
   aura=new THREE.Group();aura.position.set(0,.03,0);root.add(aura);
   const rOut=mesh(charGeos.auraOuter,charMats.goldGlow,0,0,0,aura);rOut.rotation.x=-Math.PI/2;rOut.castShadow=false;
   const rIn=mesh(charGeos.auraInner,charMats.goldGlow,0,.01,0,aura);rIn.rotation.x=-Math.PI/2;rIn.castShadow=false;
  }else if(h%3===0){
   for(const sx of [-1,1])mesh(charGeos.glassFrame,charMats.gold,sx*.12,.038,.332,headGroup);
   mesh(charGeos.glassBridge,charMats.gold,0,.045,.335,headGroup);
  }
 }

 // 4. Rounded Articulated Arms, Legs, Knees & Two-Tone Sneakers
 const arms=[],legs=[],knees=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.43,1.46,0);body.add(arm);
  mesh(charGeos.sleeveCuff,shirt,0,-.08,0,arm);
  mesh(charGeos.armUpper,skinMat,0,-.24,0,arm);
  mesh(charGeos.hand,skinMat,0,-.48,0,arm);
  arms.push(arm);

  const leg=new THREE.Group();leg.position.set(side*.175,.79,0);body.add(leg);
  mesh(charGeos.legThigh,pantMat,0,-.15,0,leg);
  const knee=new THREE.Group();knee.position.y=-.31;leg.add(knee);
  mesh(charGeos.legCalf,pantMat,0,-.15,0,knee);
  mesh(charGeos.shoeUpper,shoeMat,0,-.34,.04,knee);
  mesh(charGeos.shoeSole,charMats.white,0,-.41,.05,knee);
  const toe=mesh(charGeos.shoeToe,charMats.white,0,-.36,.20,knee);toe.scale.set(.95,.65,.85);
  legs.push(leg);knees.push(knee);
 }

 // Method B: If a custom .glb model override has been preloaded for this role, attach it
 const roleKey=vendor?'coba':isVip?'customer-vip':isFemale?'customer-female':'customer-male';
 if(customGlbTemplates.has(roleKey)){
  applyGlbTemplateToActor({root,body,headGroup},customGlbTemplates.get(roleKey));
 }

 return {root,body,headGroup,eyesGroup,mouth,crown,aura,isVip,isFemale,roleKey,phase:(h%100)*.06,arms,legs,knees};
}
const vendor=person('#c63628',true,{name:'Cô Ba'});vendor.root.position.set(.9,0,-2.6);vendor.root.scale.setScalar(1.18);
const ladle=new THREE.Group();vendor.arms[1].add(ladle);cylinder(.025,.9,steel,0,-.8,.15,ladle);const spoon=sphere(.18,steel,0,-1.25,.15,ladle);spoon.scale.y=.3;

// Method B: Hybrid GLTF/GLB Auto-Override Loader (activates automatically when .glb files are placed in assets/models/)
function applyGlbTemplateToActor(actor,gltf){
 try{
  const clone=gltf.scene.clone(true);
  clone.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  actor.body.visible=false;
  actor.root.add(clone);
  actor.glbRoot=clone;
  if(gltf.animations?.length){
   const mixer=new THREE.AnimationMixer(clone);
   const clip=gltf.animations[0];
   mixer.clipAction(clip).play();
   actor.mixer=mixer;
   glbMixers.add(mixer);
  }
 }catch{}
}
async function initHybridGlbOverrides(){
 if(globalThis.TestRenderer)return;
 try{
  const res=await fetch('/api/models');if(!res.ok)return;
  const {models={}}=await res.json();
  const activeKeys=Object.keys(models).filter(k=>models[k]);
  if(!activeKeys.length)return;
  const {GLTFLoader}=await import('./vendor/GLTFLoader.js');
  const loader=new GLTFLoader();
  for(const key of activeKeys){
   loader.load(`/assets/models/${key}.glb`,gltf=>{
    customGlbTemplates.set(key,gltf);
    if(key==='coba')applyGlbTemplateToActor(vendor,gltf);
   });
  }
 }catch{}
}
void initHybridGlbOverrides();
function clearFood(group){group.traverse(n=>{if(n.isInstancedMesh)n.dispose();else if(n.geometry&&!sharedGeometries.has(n.geometry))n.geometry.dispose();});group.removeFromParent();}
function plate(parent,menu=0){const group=new THREE.Group();group.name='meal-plate';parent.add(group);
 mesh(new THREE.CylinderGeometry(.53,.33,.22,24),bowlCeramic,0,.09,0,group);
 const rim=mesh(new THREE.TorusGeometry(.51,.022,6,28),bowlRimBlue,0,.195,0,group);rim.rotation.x=Math.PI/2;
 cylinder(.48,.025,brothTopMat,0,.15,0,group);
 const chop1=box(.022,.022,.82,chopstickMat,.28,.22,0,group);chop1.rotation.y=.18;
 const chop2=box(.022,.022,.82,chopstickMat,.33,.22,0,group);chop2.rotation.y=.14;
 group.userData.food=new THREE.Group();group.add(group.userData.food);setPlateMenu(group,menu);return group;}
function setPlateMenu(group,menu){if(group.userData.menuIndex===menu)return;const content=group.userData.food;while(content.children.length)clearFood(content.children[0]);group.userData.menuIndex=menu;
 const noodles=new THREE.InstancedMesh(foodGeometries.block,foodMaterials.noodle,18),d=new THREE.Object3D();
 for(let i=0;i<18;i++){const a=i*1.9,r=.06+(i%5)*.045;d.position.set(-.12+Math.cos(a)*r,.165+(i%3)*.008,Math.sin(a)*r);d.scale.set(.032,.012,.32);d.rotation.set(0,a*.5,0);d.updateMatrix();noodles.setMatrixAt(i,d.matrix);}content.add(noodles);
 const kinds=menus[menu].dishes;for(const [i,kind] of kinds.entries()){const food=foodModel(kind,content,menu*19+i);const columns=kinds.length>2?2:1;food.position.set(.04+(i%columns)*.16-(kinds.length>1?.08:0),.13,-.15+Math.floor(i/columns)*(kinds.length>4?.15:.2)+(kinds.length===1?.15:0));food.scale.set(kinds.length>2?.15:.26,.42,kinds.length===1?.44:kinds.length>4?.16:.22);}
 const lime=sphere(.075,foodMaterials.scallion,-.28,.175,.22,content);lime.scale.set(1,.35,1);
}
const servingPlate=plate(scene);servingPlate.position.set(2.7,1.52,.35);servingPlate.scale.setScalar(1.26);servingPlate.visible=false;
const diningSeats=[];
let stoolIndex=0;
for(const side of [-1,1])for(const z of [3.6,6.1]){
 const x=side*3.15;const table=new THREE.Group();table.name='dining-table';scene.add(table);cylinder(.78,.09,steel,x,1.05,z,table);cylinder(.08,.95,steel,x,.5,z,table);cylinder(.36,.06,steel,x,.02,z,table);
 const chairX=side*2.95,chairZ=z-.82,stoolMat=stoolIndex++%2?plasticBlue:plasticRed;box(.56,.09,.56,stoolMat,chairX,.61,chairZ);for(const dx of [-.21,.21])for(const dz of [-.21,.21])box(.055,.56,.055,stoolMat,chairX+dx,.28,chairZ+dz);
 cylinder(.055,.22,plasticRed,x+side*.28,1.2,z+.18,table);cylinder(.05,.19,hair,x+side*.15,1.18,z+.22,table);box(.17,.17,.17,cream,x-side*.24,1.18,z+.16,table);
 diningSeats.push({position:new THREE.Vector3(chairX,0,chairZ),rotation:-side*.28,occupant:null});
}
const actors=new Map();
function customer(order,index){const a=person(shirtColors[index%shirtColors.length],false,{name:order.name,menuIndex:order.index,seed:order.id});a.root.rotation.y=(index%2?-.65:.65);a.root.position.set((index%2?1:-1)*(1.1+Math.floor(index/2)*.9),0,5+Math.floor(index/2)*1.5);const label=document.createElement('div');label.className='customer-name'+(a.isVip?' is-vip':'');label.textContent=(order.preview?'Thử · ':'')+(a.isVip?'👑 ':'')+order.name;$('customer-labels').append(label);a.label=label;a.order=order;a.plate=plate(a.root,order.index);a.plate.position.set(0,1.02,.52);a.plate.visible=false;actors.set(order.id,a);return a;}
const ambient=[];for(let i=0;i<4;i++){const a=person(shirtColors[i],false,{name:FAKE_NAMES[i],menuIndex:i===2?6:i,seed:100+i});a.root.position.set(i%2?1.25:-1.25,0,5.6+Math.floor(i/2)*1.4);a.root.rotation.y=(i%2?-.62:.62);a.root.scale.setScalar(.94);ambient.push(a);}

function spawnHearts(count=5){
 const boxEl=$('floating-hearts');if(!boxEl?.append)return;
 const icons=['❤️','💖','🧡','🍜','✨'];
 for(let i=0;i<count;i++){
  const el=document.createElement('span');el.className='heart-pop';
  el.textContent=icons[i%icons.length];
  el.style.right=`${22+Math.round(Math.random()*95)}px`;
  el.style.animationDelay=`${(i*.14).toFixed(2)}s`;
  if(el.style.setProperty)el.style.setProperty('--drift',`${Math.round((Math.random()-.5)*46)}px`);
  boxEl.append(el);
  setTimeout(()=>el.remove?.(),2700);
 }
}
function handleSocial(e,preview=false){
 const name=String(e.name||'Khách quý').slice(0,40),tag=preview?'Thử · ':'';
 if(e.social==='like'){spawnHearts(6);notice(`${tag}❤️ ${name} vừa thả tim tiếp lửa cho nồi nước lèo!`,preview);}
 else if(e.social==='follow'){if(canPlayAudio())restaurantAudio.play('order');spawnHearts(4);notice(`${tag}⭐ Đa tạ ${name} vừa Follow ủng hộ quán!`,preview);}
 else if(e.social==='chat'){notice(`${tag}💬 ${name}: "${String(e.comment||'Cho 1 tô đặc biệt!').slice(0,50)}"`,preview);}
 else{notice(`${tag}👋 Chào mừng ${name} ghé quán! Ăn tái, nạm gầu hay bò viên nè?`,preview);}
 if(canPlayAudio())sellerVoice.social({...e,name,force:Boolean(e.force)});
}
function resetAll(){
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;if($('demo'))$('demo').textContent='▶ Tự động chạy khách mẫu';}
 queue.reset();supporters.clear();serviceAge=0;servingPlate.visible=false;
 for(const s of diningSeats)s.occupant=null;
 for(const [,a] of actors)disposeActor(a);
 actors.clear();
 if($('leaders'))$('leaders').textContent='Chờ vị khách đầu tiên';
 notice('Đã làm mới toàn bộ quán phở — sẵn sàng đón lượt khách mới! 🍜');
 stats();
}
function applyCaiDat(cfg={}){
 const bienHieu=cfg.bienHieu||'PHỞ BÒ GIA TRUYỀN • CÔ BA';
 const tenQuan=cfg.tenQuan||cfg.channelName||'Phở Cô Ba';
 if(mainSignMesh.material?.map)mainSignMesh.material.map.dispose();
 mainSignMesh.material.dispose?.();
 mainSignMesh.material=sign(bienHieu);
 if($('stage-title'))$('stage-title').innerHTML=`${tenQuan.replace(/</g,'&lt;')}<span>Phở Bò Gia Truyền</span>`;
 if($('lbl-channel-name'))$('lbl-channel-name').textContent=cfg.channelName||'Phở Cô Ba';
 sellerVoice.configure({shopName:cfg.channelName||'Phở Cô Ba',rate:cfg.ttsRate});
 updateRateButtons(cfg.ttsRate||1);
}
function handleControl(e){
 if(e.action==='reset'){resetAll();return;}
 if(e.action==='setRate'){const r=Number(e.text)||1;sellerVoice.configure({rate:r});updateRateButtons(r);return;}
 if(e.action==='speak'&&e.text){notice(`📢 ${e.text}`);if(canPlayAudio()&&audioCfg.voiceEnabled)sellerVoice.sayNow(e.text);return;}
 if(e.action==='custom'&&e.text==='previewVoice'){if(canPlayAudio()&&audioCfg.voiceEnabled)sellerVoice.preview();return;}
 if(e.action==='custom'&&e.text==='testChime'){if(canPlayAudio())restaurantAudio.play('celebrate');return;}
 if(e.action==='custom'&&e.text==='toggleHud'){
  const hidden=$('game')?.classList?.toggle('hud-hidden');
  if($('btn-toggle-hud')){
   $('btn-toggle-hud').textContent=hidden?'👁 Menu quà: ĐANG ẨN':'👁 Menu quà: HIỆN GỌN';
   $('btn-toggle-hud').classList?.toggle('is-active',!hidden);
  }
  return;
 }
 if(e.action==='custom'&&e.text==='tatlive'){
  if(demoTimer){clearInterval(demoTimer);demoTimer=null;if($('demo'))$('demo').textContent='▶ Tự động chạy khách mẫu';}
  queue.pending=[];
  notice('🛑 Quán Phở Đêm xin phép đóng cửa nghỉ ngơi — hẹn gặp lại cả nhà phiên LIVE tới! 🙏');
  if(canPlayAudio()&&audioCfg.voiceEnabled)sellerVoice.sayNow('Quán phở đêm xin phép dọn hàng nghỉ ngơi hôm nay ạ! Đa tạ cả nhà đã ghé ăn phở và thả tim ủng hộ, chúc mọi người ngủ ngon và hẹn gặp lại vào phiên live tới nhé!');
 }
}
function canPlayAudio(){
 if(globalThis.TestRenderer)return true;
 if(!audioCfg.masterEnabled)return false;
 if(isStage)return !isMutedStage&&isPrimarySpeaker;
 return adminMonitor&&restaurantAudio.getState().enabled;
}
function receive(e,preview=false){
 if(e?.kind==='shutdown'){
  if(demoTimer){clearInterval(demoTimer);demoTimer=null;if($('demo'))$('demo').textContent='▶ Tự động chạy khách mẫu';}
  adminMonitor=false;restaurantAudio.stop();sellerVoice.disable();refreshAudioUi();
  renderTikTokStatus({isConnected:false,isConnecting:false});
  showAdminMsg(`✅ Đã tắt Server và giải phóng hoàn toàn cổng ${e.port||4011}! Khi muốn mở lại hãy chạy BAT-LIVE.bat.`);
  notice(`🔌 Server đã tắt & giải phóng cổng ${e.port||4011} thành công!`);
  return;
 }
 if(e?.kind==='status'){renderTikTokStatus(e.status);return;}
 if(e?.kind==='caiDat'){applyCaiDat(e.caiDat);return;}
 if(e?.kind==='audioCfg'){void applyAudioCfg(e.audio,false);return;}
 if(e?.kind==='ttsStatus'){renderTtsStatus(e.tts);return;}
 if(e?.kind==='speaker'){
  remoteStageCount=Number(e.stageCount)||0;
  isPrimarySpeaker=!stageId||!e.speakerId||e.speakerId===stageId;
  if(!isStage&&remoteStageCount>0&&adminMonitor){
   adminMonitor=false;
   void syncLocalAudioEngine();
   showAdminMsg('Đã tự động tắt loa nghe thử tại trang Admin vì trang Stage (?view=stage) đang mở để tránh đè tiếng.');
  }
  refreshAudioUi();
  return;
 }
 if(e?.kind==='control'){handleControl(e);return;}
 if(e?.kind==='social'||e?.social){handleSocial(e,preview||e.preview===true);return;}
 preview=preview||e.preview===true;const order=queue.enqueue(e,preview);if(!order)return;
 if(!preview)lastRealNotice=Date.now();
 if(canPlayAudio())restaurantAudio.play('order');
 const menuName=gifts[order.index][2],giftName=e.giftLabel||gifts[order.index][3];
 notice(`${preview?'Thử · ':''}${order.name} vừa tặng ${giftName} gọi ${menuName} ×${Number(e.count)||1}`,preview);
 if(canPlayAudio()){
  if(globalThis.TestRenderer)sellerVoice.ackOrder(order,menuName,giftName);
  else setTimeout(()=>{if(canPlayAudio())sellerVoice.ackOrder(order,menuName,giftName);},220);
 }
 if(!preview){supporters.set(order.name,(supporters.get(order.name)||0)+points[order.index]*Number(order.count));$('leaders').replaceChildren(...[...supporters].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,score],i)=>{const span=document.createElement('span');span.textContent=`${i+1}. ${name} (${score.toLocaleString()}đ)`;return span;}));}
 stats();
}
function stats(){$('cooked').firstChild.textContent=queue.waiting+' ';$('bags').firstChild.textContent=queue.served.toLocaleString()+' ';}
function walk(a,target,dt,speed=2.5){a.root.position.y=0;a.knees.forEach(k=>k.rotation.x=0);const p=a.root.position,dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz);if(dist<.04){a.legs.forEach(l=>l.rotation.x=0);a.body.position.y=0;return true;}if(now-(a.lastStep??-10)>.38){if(canPlayAudio())restaurantAudio.play('step');a.lastStep=now;}const step=Math.min(dist,dt*speed);p.x+=dx/dist*step;p.z+=dz/dist*step;a.root.rotation.y=Math.atan2(dx,dz);a.legs[0].rotation.x=Math.sin(now*9)*.4;a.legs[1].rotation.x=-Math.sin(now*9)*.4;a.body.position.y=Math.abs(Math.sin(now*9))*.035;return false;}
function disposeActor(a){if(a.mixer)glbMixers.delete(a.mixer);scene.remove(a.root);a.label.remove();const geos=new Set(),mats=new Set();a.root.traverse(n=>{if(n.isInstancedMesh)n.dispose();if(n.geometry&&!sharedGeometries.has(n.geometry))geos.add(n.geometry);if(n.material&&!shared.has(n.material))mats.add(n.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}
const orderPosition=new THREE.Vector3(1.65,0,1.7),exitPosition=new THREE.Vector3(7.5,0,7);
let lastRenderTime=-Infinity;
function animateCharacterIdle(a,t,isOrdering=false,isEating=false){
 if(a.eyesGroup)a.eyesGroup.scale.y=Math.sin(t*2.1+a.phase)>.965?.12:1;
 if(a.crown)a.crown.rotation.y=t*1.8+a.phase;
 if(a.aura){a.aura.rotation.y=-t*1.2;a.aura.scale.setScalar(.93+Math.sin(t*4+a.phase)*.07);}
 if(a.mouth){
  const activeMouth=isEating||isOrdering;
  a.mouth.scale.y=activeMouth?(.75+Math.abs(Math.sin(t*14+a.phase))*1.45):1;
 }
}
function frame(time){requestAnimationFrame(frame);if(lowPower&&time-lastRenderTime<1000/30)return;lastRenderTime=time;now=time/1000;const dt=Math.min(.05,last?now-last:.016);last=now;
 for(const m of glbMixers)m.update(dt);
 for(const [i,puff] of steamPuffs.entries()){const cycle=(now*.42+puff.userData.offset)%1;puff.position.set(3.05+Math.sin(now*1.6+i)*.16,2.68+cycle*1.55,-3.45+Math.cos(now*1.3+i)*.12);puff.scale.setScalar(.55+cycle*.85);}
 const current=queue.next(),visible=[...(current?[current]:[]),...queue.pending.slice(0,6)];for(const [i,o] of visible.entries())if(!actors.has(o.id))customer(o,i);
 ambient.forEach((a,i)=>{
  a.root.visible=queue.waiting===0;
  if(a.root.visible){
   animateCharacterIdle(a,now);
   if(a.headGroup)a.headGroup.rotation.y=Math.sin(now*1.1+i)*.28;
   a.body.position.y=Math.sin(now*2.2+i)*.02;
  }
 });
 // Animate Cô Ba (lip-sync when speaking or cooking, eye blink, head tracking)
 if(vendor.eyesGroup)vendor.eyesGroup.scale.y=Math.sin(now*1.85)>.965?.12:1;
 if(vendor.mouth){
  const cobaTalking=Boolean(current)||now%8<2.5;
  vendor.mouth.scale.y=cobaTalking?(.75+Math.abs(Math.sin(now*17))*1.65):1;
 }
 if(vendor.headGroup){
  vendor.headGroup.rotation.y=current?Math.sin(serviceAge*2.4)*.24:Math.sin(now*.9)*.14;
  vendor.headGroup.rotation.x=current?.12+Math.sin(serviceAge*4)*.05:Math.sin(now*1.5)*.03;
 }
 for(const [i,o] of queue.pending.slice(0,6).entries()){
  const a=actors.get(o.id);
  if(a){
   if(walk(a,new THREE.Vector3((i%2?1:-1)*1.25,0,4.4+Math.floor(i/2)*1.45),dt,2)){
    a.root.rotation.y=(i%2?-.68:.68);
    if(a.headGroup)a.headGroup.rotation.y=(i%2?-.18:.18)+Math.sin(now*1.5+a.phase)*.22;
   }
  }
 }
 if(current){$('order')?.parentElement?.classList?.remove('is-idle');const a=actors.get(current.id);if(walk(a,orderPosition,dt)){const previousAge=serviceAge;serviceAge+=dt;if(previousAge<.8&&serviceAge>=.8&&canPlayAudio())restaurantAudio.play('scoop');if(previousAge<1.7&&serviceAge>=1.7&&canPlayAudio())restaurantAudio.play('scoop');if(previousAge<2.6&&serviceAge>=2.6&&canPlayAudio())restaurantAudio.play('plate');a.root.rotation.y=serviceAge>2.2?-.32:-.78;if(a.headGroup)a.headGroup.rotation.y=serviceAge>2.2?.12:-.24;a.arms[0].rotation.x=serviceAge<.9?-.6:0;const menu=gifts[current.index][2];setPlateMenu(servingPlate,current.index);const stepText=serviceAge<1.35?`🔥 Đang trụng bánh phở tươi & xếp ${dishes[menus[current.index].dishes[0]].name}...`:serviceAge<2.7?'🥄 Đang chan nước lèo hầm xương ống 12h sôi sùng sục...':'🌿 Rắc hành hoa, ngò gai, tiêu bắc & vắt chanh tươi...';$('dish-detail').textContent=stepText;$('order').textContent=`${current.name} · ${menu} ×${current.count}`;$('progress').style.width=Math.min(100,serviceAge/4*100)+'%';vendor.arms[1].rotation.x=-.8-Math.sin(serviceAge*5)*.45;vendor.arms[1].rotation.z=Math.sin(serviceAge*2)*.4;vendor.body.rotation.y=Math.sin(serviceAge*2)*.17;servingPlate.visible=serviceAge>2;
 if(serviceAge>4){const done=queue.finish();a.plate.visible=true;if(menus[done.index].dishes.length>=2){a.dining='waiting';a.seat=null;}else a.exiting=true;servingPlate.visible=false;serviceAge=0;notice(`${done.preview?'Thử · ':''}${done.name} đã nhận ${menu} nóng hổi! Chúc ngon miệng nha 🍜`,done.preview);if(canPlayAudio()){restaurantAudio.play('serve');if(globalThis.TestRenderer)sellerVoice.thank(done,menu);else setTimeout(()=>{if(canPlayAudio())sellerVoice.thank(done,menu);},240);}if(done.index===7){if(canPlayAudio())restaurantAudio.play('celebrate');$('celebration').hidden=false;clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>$('celebration').hidden=true,3500);}stats();}}
 }else{$('order')?.parentElement?.classList?.add('is-idle');$('order').textContent='Tặng quà để xếp hàng gọi phở nóng';$('dish-detail').textContent='Nước lèo xương ống 12h · Bánh phở tươi · Trần nóng từng tô';$('progress').style.width='0%';vendor.arms[1].rotation.x=Math.sin(now*1.2)*.08;vendor.body.rotation.y=0;}
 for(const [id,a] of actors){
 animateCharacterIdle(a,now,queue.active?.id===id,a.dining==='eating');
 if(a.dining==='waiting'){const seat=diningSeats.find(s=>s.occupant===null);if(seat){seat.occupant=id;a.seat=seat;a.dining='walking';}else{walk(a,new THREE.Vector3(id%2?2:-2,0,2.6),dt);a.label.textContent=(a.order.preview?'Thử · ':'')+a.order.name+' · Đợi bàn';}}
 if(a.dining==='walking'&&walk(a,a.seat.position,dt,2.3)){a.dining='eating';if(canPlayAudio()){restaurantAudio.play('seat');restaurantAudio.play('plate');}a.eatAge=0;a.root.rotation.y=a.seat.rotation;a.label.textContent=(a.order.preview?'Thử · ':'')+a.order.name+' · Đang xì xụp phở';}
 if(a.dining==='eating'){a.eatAge+=dt;a.root.position.y=-.1;a.body.position.y=0;a.legs.forEach(l=>l.rotation.x=-Math.PI/2);a.knees.forEach(k=>k.rotation.x=Math.PI/2);a.arms[0].rotation.x=-.75+Math.sin(a.eatAge*3)*.25;a.arms[1].rotation.x=-.55;if(a.headGroup){a.headGroup.rotation.y=Math.sin(a.eatAge*2.2)*.14;a.headGroup.rotation.x=.12+Math.sin(a.eatAge*5)*.07;}a.plate.position.set(0,1.15,.77);if(a.eatAge>=9){if(canPlayAudio())restaurantAudio.play('seat');a.seat.occupant=null;a.dining=null;a.exiting=true;a.plate.visible=false;a.arms.forEach(arm=>arm.rotation.x=0);a.legs.forEach(l=>l.rotation.x=0);a.knees.forEach(k=>k.rotation.x=0);if(a.headGroup)a.headGroup.rotation.set(0,0,0);a.root.position.y=0;a.label.textContent=(a.order.preview?'Thử · ':'')+a.order.name+' · No căng bụng!';}}
 if(a.exiting&&walk(a,exitPosition,dt,3)){disposeActor(a);actors.delete(id);continue;}a.root.updateMatrixWorld(true);const p=new THREE.Vector3(0,2.65,0).applyMatrix4(a.root.matrixWorld).project(camera);a.label.style.left=`${(p.x+1)*225}px`;a.label.style.top=`${(1-p.y)*400}px`;a.label.classList.toggle('is-ordering',queue.active?.id===id);a.label.hidden=p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;}
 renderer.render(scene,camera);
}requestAnimationFrame(frame);

// ORIGINAL RESTAURANT AUDIO START
export function createRestaurantAudio(createContext=()=>new AudioContext()){
 let ctx=null,master=null,compressor=null,musicGain=null,musicSource=null,musicBuffer=null,enabled=false,volume=.35,musicEnabled=true,musicVolume=.12,ducking=false;const sources=new Set(),lastPlayed=new Map();
 const clamp=v=>{const n=Number(v);return Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;};
 function ramp(param,target,tau=.04){if(!param||!ctx)return;param.cancelScheduledValues?.(ctx.currentTime);param.setTargetAtTime(target,ctx.currentTime,tau);}
 function startMusic(){if(!ctx||!musicEnabled||musicSource)return;if(!musicBuffer)musicBuffer=composeIdleMusic(ctx);musicSource=ctx.createBufferSource();musicSource.buffer=musicBuffer;musicSource.loop=true;musicSource.connect(musicGain);musicSource.start();}
 function stopMusic(){if(musicSource){const src=musicSource;musicSource=null;try{src.stop();}catch{}src.disconnect();}}
 function tone(frequency,at,duration=.16,level=.1,type='sine',end=frequency){if(!ctx||sources.size>=14)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,at);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(level,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain).connect(master);sources.add(osc);osc.onended=()=>{sources.delete(osc);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.02);}
 function noise(at,duration,level,frequency,type='lowpass'){if(!ctx||sources.size>=14)return;const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);const data=src.buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;filter.type=type;filter.frequency.value=frequency;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(level,at+.009);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);src.connect(filter).connect(gain).connect(master);sources.add(src);src.onended=()=>{sources.delete(src);src.disconnect();filter.disconnect();gain.disconnect();};src.start(at);src.stop(at+duration+.02);}
 function play(kind){if(!enabled||!ctx||ctx.state==='suspended')return false;
 if(ducking&&(kind==='step'||kind==='scoop'||kind==='seat'||kind==='plate'))return false;
 const t=ctx.currentTime,gaps={step:.16,scoop:.25,plate:.35,order:.2,serve:.25,seat:.3,celebrate:1};if(t-(lastPlayed.get(kind)??-100)<(gaps[kind]??.15))return false;lastPlayed.set(kind,t);
 switch(kind){case'step':noise(t,.06,.04,480);tone(110,t,.05,.018,'sine',72);break;
 case'order':tone(1046,t,.18,.055);tone(1568,t+.065,.18,.032);break;
 case'scoop':noise(t,.18,.024,820,'bandpass');tone(520,t,.09,.016,'triangle',360);break;
 case'plate':tone(1320,t,.16,.035);tone(1920,t+.025,.12,.016);break;
 case'seat':noise(t,.14,.035,580,'bandpass');tone(155,t,.09,.018,'triangle',105);break;
 case'serve':[659,880,1046].forEach((f,i)=>tone(f,t+i*.065,.18,.04));break;
 case'celebrate':[523,659,784,1046,1318].forEach((f,i)=>tone(f,t+i*.08,.24,.045));break;
 default:return false;}return true;}
 return {
  async start(){if(enabled)return;ctx=createContext();try{await ctx.resume();master=ctx.createGain();master.gain.value=volume*(ducking?.14:1);compressor=ctx.createDynamicsCompressor();master.connect(compressor).connect(ctx.destination);musicGain=ctx.createGain();musicGain.gain.value=musicVolume*(ducking?.05:1);musicGain.connect(ctx.destination);enabled=true;lastPlayed.clear();startMusic();if(volume>0)play('order');}catch(e){enabled=false;if(ctx)await ctx.close();ctx=null;throw e;}},
  async stop(){enabled=false;lastPlayed.clear();stopMusic();musicBuffer=null;for(const src of sources){try{src.stop();}catch{}}sources.clear();if(ctx)await ctx.close();ctx=null;master=null;musicGain=null;compressor=null;},
  play,
  setMusicEnabled(value){musicEnabled=Boolean(value);if(enabled){if(musicEnabled)startMusic();else stopMusic();}},
  setDucking(value){ducking=Boolean(value);const tau=ducking?.04:.25;ramp(musicGain?.gain,musicVolume*(ducking?.05:1),tau);ramp(master?.gain,volume*(ducking?.14:1),tau);},
  setMusicVolume(value){musicVolume=clamp(value);ramp(musicGain?.gain,musicVolume*(ducking?.05:1),.03);},
  setVolume(value){volume=clamp(value);ramp(master?.gain,volume*(ducking?.14:1),.03);},
  boostVoice(audioEl,vol=1){if(!ctx||ctx.state==='suspended'||!ctx.createMediaElementSource)return null;try{const src=ctx.createMediaElementSource(audioEl),g=ctx.createGain();g.gain.value=clamp(vol)*1.55;src.connect(g).connect(ctx.destination);return{setVolume(v){const c=clamp(v);g.gain.value=c*1.55;ramp(g.gain,c*1.55,.02);},disconnect(){try{src.disconnect();g.disconnect();}catch{}}};}catch{return null;}},
  getState(){return {enabled,volume,active:sources.size,musicEnabled,musicVolume,musicPlaying:musicSource!==null,ducking,suspended:ctx?.state==='suspended'};}
 };
}
export function composeIdleMusic(ctx){
 const rate=22050,beat=60/90,bars=16,length=Math.round(bars*4*beat*rate),buffer=ctx.createBuffer(2,length,rate),left=buffer.getChannelData(0),right=buffer.getChannelData(1);
 const freq=m=>440*2**((m-69)/12);let randomState=73971;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296*2-1;};
 function note(midi,start,duration,level,voice='pluck',pan=0){const f=freq(midi),offset=Math.round(start*rate),samples=Math.round(duration*rate);for(let i=0;i<samples;i++){const t=i/rate,phase=t*f*Math.PI*2,attack=Math.min(1,t/.008),tail=Math.min(1,(duration-t)/.08);let wave,envelope;if(voice==='bass'){wave=Math.sin(phase)+.12*Math.sin(phase*2);envelope=attack*Math.exp(-t*5)*tail;}else if(voice==='pad'){wave=Math.sin(phase)+.15*Math.sin(phase*2+.3);envelope=Math.min(1,t/.15)*Math.min(1,(duration-t)/.3)*.5;}else{wave=Math.sin(phase)*.75+Math.sin(phase*2)*Math.exp(-t*10)*.22+Math.sin(phase*3)*Math.exp(-t*18)*.08;envelope=attack*Math.exp(-t*4.5)*tail;}const value=wave*envelope*level,index=(offset+i)%length;left[index]+=value*(1-pan*.5);right[index]+=value*(1+pan*.5);}}
 function percussion(start,kind){const offset=Math.round(start*rate),duration=kind==='kick'?.16:.07;for(let i=0;i<duration*rate;i++){const t=i/rate;const v=kind==='kick'?Math.sin(2*Math.PI*(70*t-65*t*t))*Math.exp(-t*28)*.065:random()*Math.exp(-t*65)*(kind==='brush'?.018:.01);const index=(offset+i)%length;left[index]+=v;right[index]+=v;}}
 const chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59]];
 const melody=[[76,79,0,74,72,0,76,74],[72,0,76,79,81,79,0,76],[77,76,72,0,69,72,76,0],[74,0,79,76,74,71,0,72],[79,76,0,72,74,76,79,0],[81,0,79,76,72,0,69,72],[77,79,76,0,72,69,0,72],[74,76,79,0,74,71,72,0]];
 for(let bar=0;bar<bars;bar++){const start=bar*4*beat,chord=chords[bar%4];for(let k=0;k<4;k++){note(chord[k]+12,start+k*.035,beat*3.6,.024,'pad',(k-1.5)*.3);note(chord[k]+24,start+(k+.5)*beat,beat*.65,.025,'pluck',(k%2?.45:-.45));}note(chord[0],start,beat*.85,.09,'bass',-.1);note(chord[0]+7,start+2*beat,beat*.75,.07,'bass',.1);
 for(let step=0;step<8;step++){const midi=melody[bar%8][step],swing=step%2?.055:0;if(midi)note(midi+(bar>=8&&step===6?12:0),start+(step*.5+swing)*beat,beat*.95,.095,'pluck',Math.sin(step)*.3);percussion(start+(step*.5+swing)*beat,step%2?'hat':'brush');}percussion(start,'kick');percussion(start+2*beat,'kick');}
 return buffer;
}
// ORIGINAL RESTAURANT AUDIO END

// SELLER VOICE START
export function createSellerVoice({synth,Utterance,onlineSpeak=null,onSpeaking=()=>{},onStatus=()=>{},onVolumeChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,clock=()=>Date.now()}={}){
 let enabled=false,current=null,pending=[],overflow=0,token=0,timer=null,voiceURI='edge:vi-VN-HoaiMyNeural',volume=1,rate=1,shopName='Phở Cô Ba',line=0,ackLine=0,socialLine=0,idleLine=0,cancelOnline=null;
 let orderScript=true,greetJoin=true,idleCta=true,lastSocialAt=-Infinity;
 const SOCIAL_COOLDOWN_MS=14000;
 const servePhrases=[
  (name,dish)=>`${dish} nóng hổi của ${name} ra lò rồi đây! Chúc ${name} ăn ngon miệng nha, thấy thơm nhớ thả tim ủng hộ ${shopName} nhé!`,
  (name,dish)=>`Dạ có liền! Mời ${name} xì xụp tô ${dish} đậm đà nước xương hầm, chúc ${name} buổi tối ấm bụng vui vẻ ạ!`,
  (name,dish)=>`Xong rồi đây ạ! Cảm ơn ${name} đã ủng hộ ${dish} tại ${shopName}, ăn ngon nhớ ghé lại làm tô nữa nha!`
 ];
 const ackPhrases=[
  (name,dish,gift)=>`Á chà, cảm ơn ${name} vừa tặng ${gift} gọi ${dish}! Đợi ${shopName} trụng bánh phở tươi, đập lát gừng nướng ba giây là có liền nha!`,
  (name,dish,gift)=>`Nhận đơn ${dish} từ món quà ${gift} của ${name} nha! Nước lèo xương ống đang sôi sùng sục, làm nóng hổi liền tay đây!`
 ];
 const joinPhrases=[
  name=>`Chào mừng ${name} vừa ghé ${shopName} nha! Hôm nay ${name} muốn ăn phở bò tái, nạm gầu hay bò viên ạ? Nhấp tay thả tim sưởi ấm bếp phở nhé!`,
  name=>`Ơ kìa xin chào ${name} mới vào quán! Bàn inox ghế nhựa còn trống nè, ${name} thả tim hoặc tặng một bông hồng gọi tô phở nóng ăn khuya nha!`
 ];
 const likePhrases=[
  name=>`Cảm ơn ${name} đã thả tim rần rần tiếp lửa cho nồi nước lèo sôi bùng lên nha! Đói bụng tặng một nhành hoa hồng ${shopName} trần phở mời liền nhé!`,
  name=>`Tim bay ngập quán rồi, đa tạ ${name} dễ thương nha! Muốn ăn phở tái hay phở gà lá chanh cứ gọi ${shopName} nhé!`
 ];
 const followPhrases=[
  name=>`Đa tạ ${name} vừa bấm Follow làm khách quen ${shopName}! Chúc ${name} tối nay nhiều niềm vui, muốn ăn tô xe lửa hay tái nạm bảo quán nha!`
 ];
 const idlePhrases=[
  ()=>`${shopName} nước lèo hầm xương mười hai tiếng nóng hổi đây cả nhà ơi! Ai mới vào thả tim cho vui cửa vui nhà, tặng một bông hồng là có ngay tô phở tái nghi ngút khói nha!`,
  ()=>`Đêm khuya đói bụng ghé ${shopName} làm tô tái nạm gầu giòn, thêm cặp quẩy nóng chấm ngập nước phở cả nhà ơi! Nhấp màn hình thả tim trò chuyện cùng quán nhé!`
 ];
 const cleanGuest=raw=>{const s=String(raw||'').replace(/[<>\[\]{}]/g,'').trim().slice(0,40);return s?`bạn ${s}`:'quý khách';};
 const browserVoices=()=>synth?.getVoices().filter(v=>/^vi(?:-|_)/i.test(v.lang))||[];
 const voices=()=>{
  const list=[...browserVoices()];
  if(onlineSpeak){
   list.unshift(
    {lang:'vi-VN',name:'🌐 Microsoft Edge AI: Hoài My (Nữ · Chuẩn Cô Ba)',voiceURI:'edge:vi-VN-HoaiMyNeural'},
    {lang:'vi-VN',name:'🌐 Microsoft Edge AI: Nam Minh (Nam · Ông Chủ)',voiceURI:'edge:vi-VN-NamMinhNeural'},
    {lang:'vi-VN',name:'🌐 Google Tiếng Việt (Chị Google)',voiceURI:'google:vi'}
   );
  }
  return list;
 };
 const isServerUri=uri=>!uri||uri.startsWith('edge:')||uri.startsWith('google:')||uri.startsWith('vieneu:');
 function pump(){if(!enabled||current)return;if(!pending.length&&overflow){pending.push({text:`Cảm ơn tất cả quý khách đã tấp nập ủng hộ ${shopName} nha, chúc cả nhà ăn phở ngon miệng và nhớ thả tim cho quán nhé!`});overflow=0;}if(!pending.length)return;const item=pending.shift(),id=++token;current=item;
 onSpeaking(true);
 const finish=()=>{if(id!==token)return;clearTimer(timer);timer=null;cancelOnline=null;current=null;if(pending.length||overflow)pump();else onSpeaking(false);};
 timer=setTimer(()=>{if(id!==token)return;++token;cancelOnline?.();cancelOnline=null;synth?.cancel();current=null;if(pending.length||overflow)pump();else onSpeaking(false);},25000);
 const list=voices(),chosen=list.find(v=>v.voiceURI===voiceURI)||list.find(v=>/hoaimy|linh|an|female|nữ|google/i.test(v.name))||list[0];
 if(onlineSpeak&&(isServerUri(voiceURI)||!chosen||isServerUri(chosen.voiceURI)||!synth||!Utterance)){
  cancelOnline=onlineSpeak(item.text,volume,rate,voiceURI||'edge:vi-VN-HoaiMyNeural',{onStart:()=>{if(id===token){onSpeaking(true);onStatus(item.text);}},onEnd:finish});return;
 }
 if(!synth||!Utterance){finish();return;}
 const u=new Utterance(item.text);u.lang='vi-VN';u.voice=chosen;u.rate=rate*.98;u.pitch=1.04;u.volume=volume;
 u.onstart=()=>{if(id===token){onSpeaking(true);onStatus(item.text);}};u.onend=finish;u.onerror=finish;try{synth.speak(u);}catch{finish();}}
 return {
  voices,
  enable(){if(!onlineSpeak&&(!synth||!Utterance)){onStatus('Trình duyệt này không hỗ trợ giọng đọc');return false;}if(!voices().length){onStatus('Chưa tìm thấy giọng Tiếng Việt trong trình duyệt');return false;}enabled=true;onStatus('Đã bật giọng Cô Ba · Tự động chào khách & đọc kịch bản làm phở');return true;},
  disable(){enabled=false;++token;clearTimer(timer);timer=null;cancelOnline?.();cancelOnline=null;pending=[];overflow=0;current=null;synth?.cancel();onSpeaking(false);onStatus('Đang tắt giọng Cô Ba');},
  sayNow(text){if(!enabled||!text)return false;pending.unshift({text:String(text).slice(0,400)});pump();return true;},
  ackOrder(order,dishName='tô phở nóng',giftName='quà tặng'){if(!enabled||!orderScript||current||pending.length>0)return false;const guest=cleanGuest(order?.name);pending.push({text:ackPhrases[ackLine++%ackPhrases.length](guest,dishName,giftName)});pump();return true;},
  thank(order,dishName='tô phở nóng'){if(!enabled)return;const raw=String(order?.name||'').replace(/[<>\[\]{}]/g,'').trim().slice(0,40),guest=cleanGuest(raw);const text=order?.index===7?`Trời ơi đa tạ đại gia ${raw||'VIP'} đã bao trọn cả ${shopName} hôm nay! Chúc đại gia phát tài đại cát, cả quán vỗ tay thả tim cảm ơn đại gia nào!`:servePhrases[line++%servePhrases.length](guest,dishName);if(pending.length<5)pending.push({text});else overflow++;pump();},
  social(event={}){if(!enabled||!greetJoin)return false;if(!event.force&&(current||pending.length>0||clock()-lastSocialAt<SOCIAL_COOLDOWN_MS))return false;lastSocialAt=clock();const guest=cleanGuest(event.name),kind=event.social||'join';let text;if(kind==='like')text=likePhrases[socialLine++%likePhrases.length](guest);else if(kind==='follow')text=followPhrases[socialLine++%followPhrases.length](guest);else if(kind==='chat')text=`${shopName} đọc được bình luận của ${guest} rồi nha! Nước lèo đang sôi thơm lừng, tặng một nhành hoa hồng là múc phở liền tay ạ!`;else text=joinPhrases[socialLine++%joinPhrases.length](guest);if(event.force&&pending.length<5)pending.unshift({text});else pending.push({text});pump();return true;},
  idleCallout(){if(!enabled||!idleCta||current||pending.length>0||clock()-lastSocialAt<15000)return false;lastSocialAt=clock();pending.push({text:idlePhrases[idleLine++%idlePhrases.length]()});pump();return true;},
  preview(){if(!enabled)return;pending.unshift({text:`Xin chào cả nhà! Chào mừng đến ${shopName} nước lèo hầm xương mười hai tiếng! Ai mới vào nhấp tay thả tim, muốn ăn phở tái hay nạm gầu tặng hoa hồng quán làm liền nha!`});pump();},
  configure(options={}){if(options.voiceURI!==undefined)voiceURI=options.voiceURI;if(options.volume!==undefined){const n=Number(options.volume);volume=Number.isFinite(n)?Math.min(1,Math.max(0,n)):0;onVolumeChange(volume);}if(options.rate!==undefined&&Number(options.rate)>0)rate=Math.min(1.5,Math.max(0.6,Number(options.rate)));if(options.shopName)shopName=String(options.shopName).slice(0,40);if(options.orderScript!==undefined)orderScript=Boolean(options.orderScript);if(options.greetJoin!==undefined)greetJoin=Boolean(options.greetJoin);if(options.idleCta!==undefined)idleCta=Boolean(options.idleCta);},
  getState(){return {enabled,queued:pending.length,speaking:current!==null,volume,orderScript,greetJoin,idleCta,voiceURI,rate};}
 };
}
// SELLER VOICE END

let onAudioBlocked=()=>{},activeClipVolumeSetter=null;
function playServerVietnameseTts(text,volume,rate,voiceURI,{onStart,onEnd}){
 if(typeof Audio==='undefined'){onEnd();return ()=>{};}
 const cleanVol=v=>{const n=Number(v);return Number.isFinite(n)?Math.min(1,Math.max(0,n)):1;};
 const q=`text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voiceURI||'edge:vi-VN-HoaiMyNeural')}&rate=${encodeURIComponent(rate||1)}`;
 const audio=new Audio('/api/tts?'+q);
 audio.crossOrigin='anonymous';
 const booster=restaurantAudio.boostVoice?.(audio,cleanVol(volume));
 const applyVol=v=>{const c=cleanVol(v);if(booster){booster.setVolume(c);audio.volume=c===0?0:1;}else{audio.volume=c;}};
 applyVol(volume);
 activeClipVolumeSetter=applyVol;
 let stopped=false;
 const done=()=>{if(stopped)return;stopped=true;if(activeClipVolumeSetter===applyVol)activeClipVolumeSetter=null;booster?.disconnect();onEnd?.();};
 audio.onplay=()=>{if(!stopped)onStart?.();};
 audio.onended=done;
 audio.onerror=done;
 audio.play().catch(()=>{if(isStage)onAudioBlocked();done();});
 return ()=>{if(stopped)return;stopped=true;if(activeClipVolumeSetter===applyVol)activeClipVolumeSetter=null;booster?.disconnect();try{audio.pause();audio.src='';}catch{}};
}

const restaurantAudio=createRestaurantAudio();let changingSound=false;
const sellerVoice=createSellerVoice({
 synth:window.speechSynthesis,
 Utterance:window.SpeechSynthesisUtterance,
 onlineSpeak:typeof Audio!=='undefined'?playServerVietnameseTts:null,
 onSpeaking:value=>restaurantAudio.setDucking(value),
 onVolumeChange:vol=>activeClipVolumeSetter?.(vol),
 onStatus:text=>{if($('seller-status'))$('seller-status').textContent=text;}
});

let latestVieneuVoices=[];
function renderTtsStatus(tts={}){
 if(Array.isArray(tts.voices))latestVieneuVoices=tts.voices;
 if(tts.voice)sellerVoice.configure({voiceURI:tts.voice});
 if(tts.rate){sellerVoice.configure({rate:tts.rate});updateRateButtons(tts.rate);}
 loadSellerVoices(tts.voice);
 const badge=$('tts-badge');if(!badge)return;
 const v=tts.voice||sellerVoice.getState().voiceURI||'edge:vi-VN-HoaiMyNeural';
 if(tts.state==='loading'){badge.className='adm-badge adm-badge-amber';badge.textContent='⏳ Đang nạp model AI VieNeu (~10s)...';}
 else if(v.startsWith('vieneu:')&&tts.state==='ready'){badge.className='adm-badge adm-badge-green';badge.textContent=`🟢 VieNeu AI sẵn sàng (${v.slice(7)})`;}
 else if(v==='google:vi'){badge.className='adm-badge adm-badge-amber';badge.textContent='🌐 Đang dùng Google Tiếng Việt';}
 else{badge.className='adm-badge adm-badge-blue';badge.textContent=v.includes('NamMinh')?'🔵 Microsoft Edge (Nam Minh)':'🔵 Microsoft Edge (Hoài My)';}
}

function loadSellerVoices(preferredUri){
 const select=$('seller-voice');if(!select)return;
 const currentVal=preferredUri||select.value||sellerVoice.getState().voiceURI||'edge:vi-VN-HoaiMyNeural';
 const options=[];
 for(const v of latestVieneuVoices){
  options.push({value:'vieneu:'+v.id,label:`🎙️ VieNeu AI: ${v.name}${v.description?' — '+v.description:''}`});
 }
 for(const v of sellerVoice.voices()){
  options.push({value:v.voiceURI,label:v.name});
 }
 select.replaceChildren(...options.map(o=>{const el=document.createElement('option');el.value=o.value;el.textContent=o.label;return el;}));
 if(options.length){
  select.value=options.some(o=>o.value===currentVal)?currentVal:options[0].value;
  sellerVoice.configure({voiceURI:select.value});
 }
}

function shouldRunLocalAudio(){
 if(globalThis.TestRenderer)return false;
 if(!audioCfg.masterEnabled)return false;
 if(isStage)return !isMutedStage&&isPrimarySpeaker;
 return adminMonitor;
}

function refreshAudioUi(){
 const mOn=audioCfg.masterEnabled,musOn=audioCfg.musicEnabled,vOn=audioCfg.voiceEnabled;
 const localPlaying=restaurantAudio.getState().enabled;
 if($('sound')){
  $('sound').textContent=mOn?'🔊 Âm thanh quán: BẬT':'🔇 Âm thanh quán: TẮT';
  $('sound').classList?.toggle('is-active',mOn);
 }
 if($('sound-overlay'))$('sound-overlay').textContent=(mOn&&localPlaying)?'🔊 Đang bật tiếng':'🔇 Bật tiếng';
 if($('music-toggle')){
  $('music-toggle').textContent=musOn?'♫ Nhạc nền: BẬT':'♫ Nhạc nền: TẮT';
  $('music-toggle').classList?.toggle('is-active',mOn&&musOn);
 }
 if($('seller-toggle')){
  $('seller-toggle').textContent=vOn?'🗣 Giọng Cô Ba: BẬT':'🗣 Giọng Cô Ba: TẮT';
  $('seller-toggle').classList?.toggle('is-active',mOn&&vOn);
 }
 if($('btn-admin-monitor')){
  $('btn-admin-monitor').textContent=adminMonitor?'🔊 Tắt loa Admin':'🔈 Bật loa tại Admin';
  $('btn-admin-monitor').classList?.toggle('is-active',adminMonitor);
 }
 if($('preview-caption')){
  $('preview-caption').textContent=!mOn?'Xem trước (đã tắt âm thanh toàn quán)':adminMonitor?'Xem trước (đang phát loa tại Admin)':remoteStageCount>0?'Xem trước (im lặng · đang phát ở Stage)':'Xem trước (im lặng)';
 }
 if($('music-volume'))$('music-volume').value=String(audioCfg.musicVolume);
 if($('sound-volume'))$('sound-volume').value=String(audioCfg.sfxVolume);
 if($('seller-volume'))$('seller-volume').value=String(audioCfg.voiceVolume);
 if($('lbl-music-vol'))$('lbl-music-vol').textContent=Math.round(audioCfg.musicVolume*100)+'%';
 if($('lbl-sfx-vol'))$('lbl-sfx-vol').textContent=Math.round(audioCfg.sfxVolume*100)+'%';
 if($('lbl-voice-vol'))$('lbl-voice-vol').textContent=Math.round(audioCfg.voiceVolume*100)+'%';
 if($('opt-order-script'))$('opt-order-script').checked=audioCfg.orderScript;
 if($('opt-greet-join'))$('opt-greet-join').checked=audioCfg.greetJoin;
 if($('opt-idle-cta'))$('opt-idle-cta').checked=audioCfg.idleCta;
 if($('sound-status')){
  if(!mOn)$('sound-status').textContent='🔇 Đã TẮT toàn bộ âm thanh quán (cả Nhạc nền, Tiếng bếp & Giọng Cô Ba)';
  else{
   const parts=[musOn?`Nhạc nền ${Math.round(audioCfg.musicVolume*100)}%`:'Nhạc nền TẮT',`Tiếng bếp ${Math.round(audioCfg.sfxVolume*100)}%`,vOn?`Cô Ba ${Math.round(audioCfg.voiceVolume*100)}%`:'Cô Ba TẮT'];
   const where=localPlaying?'Đang phát tại tab này':remoteStageCount>0?'Đang đồng bộ sang Stage (?view=stage)':'Bấm "🔈 Bật loa tại Admin" hoặc mở Stage để nghe';
   $('sound-status').textContent=`${parts.join(' · ')} — ${where}`;
  }
 }
}

async function syncLocalAudioEngine(){
 restaurantAudio.setMusicVolume(audioCfg.musicVolume);
 restaurantAudio.setVolume(audioCfg.sfxVolume);
 restaurantAudio.setMusicEnabled(audioCfg.masterEnabled&&audioCfg.musicEnabled);
 sellerVoice.configure({
  volume:audioCfg.voiceVolume,
  orderScript:audioCfg.orderScript,
  greetJoin:audioCfg.greetJoin,
  idleCta:audioCfg.idleCta
 });
 if(!shouldRunLocalAudio()){
  sellerVoice.disable();
  if(restaurantAudio.getState().enabled)await restaurantAudio.stop();
  refreshAudioUi();
  return;
 }
 if(changingSound)return;
 changingSound=true;
 try{
  if(!restaurantAudio.getState().enabled)await restaurantAudio.start();
  restaurantAudio.setMusicEnabled(audioCfg.masterEnabled&&audioCfg.musicEnabled);
  if(audioCfg.voiceEnabled)sellerVoice.enable();else sellerVoice.disable();
  if(isStage&&restaurantAudio.getState().suspended)onAudioBlocked();
  else if($('stage-unblock'))$('stage-unblock').hidden=true;
 }catch{
  if(isStage)onAudioBlocked();
  if($('sound-status'))$('sound-status').textContent='Trình duyệt chờ thao tác chuột — hãy bấm vào trang để kích hoạt loa';
 }finally{
  changingSound=false;
  refreshAudioUi();
 }
}

let audioPatchTimer=null;
function pushAudioPatch(patch,immediate=true){
 Object.assign(audioCfg,patch);
 if(globalThis.TestRenderer)return;
 const send=()=>fetch('/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)}).catch(()=>{});
 if(immediate)send();
 else{clearTimeout(audioPatchTimer);audioPatchTimer=setTimeout(send,60);}
}

async function applyAudioCfg(next={},fromUser=false){
 if(!next)return;
 for(const k of ['masterEnabled','musicEnabled','voiceEnabled','orderScript','greetJoin','idleCta']){
  if(next[k]!==undefined)audioCfg[k]=Boolean(next[k]);
 }
 for(const k of ['musicVolume','sfxVolume','voiceVolume']){
  if(next[k]!==undefined&&Number.isFinite(Number(next[k])))audioCfg[k]=Math.min(1,Math.max(0,Number(next[k])));
 }
 if(fromUser&&!isStage&&audioCfg.masterEnabled&&remoteStageCount===0)adminMonitor=true;
 await syncLocalAudioEngine();
}

onAudioBlocked=()=>{if(isStage&&$('stage-unblock'))$('stage-unblock').hidden=false;};
if($('stage-unblock'))$('stage-unblock').onclick=()=>{void syncLocalAudioEngine();};
if(isStage&&!isMutedStage&&!globalThis.TestRenderer){
 document.addEventListener('click',()=>{if(audioCfg.masterEnabled&&(!restaurantAudio.getState().enabled||restaurantAudio.getState().suspended))void syncLocalAudioEngine();},{passive:true});
 void syncLocalAudioEngine();
}
if($('btn-admin-monitor'))$('btn-admin-monitor').onclick=async()=>{
 if(!audioCfg.masterEnabled){
  pushAudioPatch({masterEnabled:true},true);
 }
 adminMonitor=!adminMonitor;
 await syncLocalAudioEngine();
};

$('sound').onclick=async()=>{
 const next=!audioCfg.masterEnabled;
 if(next&&!isStage&&remoteStageCount===0)adminMonitor=true;
 pushAudioPatch({masterEnabled:next},true);
 await syncLocalAudioEngine();
};
$('sound-overlay').onclick=async()=>{
 if(!isStage){
  if(!audioCfg.masterEnabled)pushAudioPatch({masterEnabled:true},true);
  adminMonitor=!adminMonitor;
  await syncLocalAudioEngine();
 }else{
  pushAudioPatch({masterEnabled:!audioCfg.masterEnabled},true);
  await syncLocalAudioEngine();
 }
};
$('music-toggle').onclick=async()=>{
 const next=!audioCfg.musicEnabled;
 if(next&&!isStage&&audioCfg.masterEnabled&&remoteStageCount===0)adminMonitor=true;
 pushAudioPatch({musicEnabled:next},true);
 await syncLocalAudioEngine();
};
$('seller-toggle').onclick=async()=>{
 const next=!audioCfg.voiceEnabled;
 if(next&&!isStage&&audioCfg.masterEnabled&&remoteStageCount===0)adminMonitor=true;
 pushAudioPatch({voiceEnabled:next},true);
 await syncLocalAudioEngine();
};

$('seller-preview').onclick=async()=>{
 if(!audioCfg.masterEnabled){if($('sound-status'))$('sound-status').textContent='⚠️ Âm thanh quán đang TẮT — hãy bấm "🔊 Âm thanh quán" để bật trước!';return;}
 if(!audioCfg.voiceEnabled){if($('seller-status'))$('seller-status').textContent='⚠️ Giọng Cô Ba đang TẮT — hãy bấm "🗣 Giọng Cô Ba" để bật trước!';return;}
 if(!isStage&&remoteStageCount>0){
  fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'custom',text:'previewVoice'})}).catch(()=>{});
  return;
 }
 if(!isStage){adminMonitor=true;await syncLocalAudioEngine();}
 sellerVoice.preview();
};

$('sound-test').onclick=async()=>{
 if(!audioCfg.masterEnabled){if($('sound-status'))$('sound-status').textContent='⚠️ Âm thanh quán đang TẮT — hãy bấm "🔊 Âm thanh quán" để bật trước!';return;}
 if(audioCfg.sfxVolume<=0){if($('sound-status'))$('sound-status').textContent='⚠️ Âm lượng Tiếng bếp đang ở 0% — hãy kéo thanh Tiếng bếp lên!';return;}
 if(!isStage&&remoteStageCount>0){
  fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'custom',text:'testChime'})}).catch(()=>{});
  return;
 }
 if(!isStage){adminMonitor=true;await syncLocalAudioEngine();}
 restaurantAudio.play('celebrate');
};

$('music-volume').oninput=e=>{
 const v=Math.min(1,Math.max(0,Number(e.target.value)||0));
 audioCfg.musicVolume=v;restaurantAudio.setMusicVolume(v);
 refreshAudioUi();pushAudioPatch({musicVolume:v},false);
};
$('sound-volume').oninput=e=>{
 const v=Math.min(1,Math.max(0,Number(e.target.value)||0));
 audioCfg.sfxVolume=v;restaurantAudio.setVolume(v);
 refreshAudioUi();pushAudioPatch({sfxVolume:v},false);
};
$('seller-volume').oninput=e=>{
 const v=Math.min(1,Math.max(0,Number(e.target.value)||0));
 audioCfg.voiceVolume=v;sellerVoice.configure({volume:v});
 refreshAudioUi();pushAudioPatch({voiceVolume:v},false);
};

$('seller-voice').onchange=e=>{
 const voice=e.target.value;
 sellerVoice.configure({voiceURI:voice});
 fetch('/api/tts/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice})}).then(r=>r.json()).then(renderTtsStatus).catch(()=>{});
};
window.speechSynthesis?.addEventListener('voiceschanged',()=>loadSellerVoices());
loadSellerVoices();

if($('opt-order-script'))$('opt-order-script').onchange=e=>{const v=Boolean(e.target.checked);sellerVoice.configure({orderScript:v});pushAudioPatch({orderScript:v},true);};
if($('opt-greet-join'))$('opt-greet-join').onchange=e=>{const v=Boolean(e.target.checked);sellerVoice.configure({greetJoin:v});pushAudioPatch({greetJoin:v},true);};
if($('opt-idle-cta'))$('opt-idle-cta').onchange=e=>{const v=Boolean(e.target.checked);sellerVoice.configure({idleCta:v});pushAudioPatch({idleCta:v},true);};

refreshAudioUi();
$('demo').onclick=()=>{
 if(demoTimer){clearInterval(demoTimer);demoTimer=null;$('demo').textContent='▶ Tự động chạy khách mẫu';return;}
 let n=0;
 const add=()=>{const g=gifts[n%8];emitTestEvent('gift',{nickname:FAKE_NAMES[n%FAKE_NAMES.length],giftName:g[3],diamondCount:points[n%8],repeatCount:1,action:g[0]});n++;};
 add();demoTimer=setInterval(add,4800);$('demo').textContent='■ Dừng khách tự động';
};
$('full').onclick=()=>$('game').requestFullscreen?.();
if($('btn-toggle-hud'))$('btn-toggle-hud').onclick=()=>{
 fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'custom',text:'toggleHud'})}).catch(()=>handleControl({action:'custom',text:'toggleHud'}));
};

// ---------- Wiring Unified LIVE-TRANGNGUYEN Dashboard Controls ----------
function showAdminMsg(msg){const el=$('tiktok-msg');if(!el)return;el.textContent=msg||'';el.hidden=!msg;}
function renderTikTokStatus(st={}){
 const el=$('tiktok-status');if(!el)return;
 if(st.isConnected){el.className='text-emerald-400';el.textContent=`Đang live @${st.username} · ${st.viewerCount||0} người xem · ${st.totalLikes||0} tim`;}
 else if(st.isConnecting){el.className='text-amber-400';el.textContent=`Đang kết nối @${st.username}...`;}
 else{el.className='text-slate-400';el.textContent='Chưa kết nối';}
 if(st.error)showAdminMsg(st.error);
}
function updateRateButtons(rate){
 if(!document.querySelectorAll)return;
 for(const btn of document.querySelectorAll('.rate-btn')){
  btn.classList.toggle('is-active',Math.abs(Number(btn.dataset.rate)-Number(rate))<.03);
 }
}

if(!globalThis.TestRenderer){
 const port=location.port||'4011';
 if($('stage-url-text'))$('stage-url-text').textContent=`http://lvh.me:${port}/?view=stage`;
 try{const saved=localStorage.getItem('tiktokUser');if(saved&&$('tiktok-user'))$('tiktok-user').value=saved;}catch{}

 const killServer=async()=>{
  try{
   if($('btn-kill-server')){$('btn-kill-server').disabled=true;$('btn-kill-server').textContent='Đang tắt Server...';}
   if($('btn-kill-server-2'))$('btn-kill-server-2').disabled=true;
   const r=await fetch('/api/server/shutdown',{method:'POST'}).then(x=>x.json());
   adminMonitor=false;restaurantAudio.stop();sellerVoice.disable();refreshAudioUi();
   showAdminMsg(r.message||`Đã tắt Server & giải phóng cổng ${port}!`);
  }catch{
   showAdminMsg(`Server đã dừng và cổng ${port} đã được giải phóng.`);
  }
 };
 if($('btn-kill-server'))$('btn-kill-server').onclick=killServer;
 if($('btn-kill-server-2'))$('btn-kill-server-2').onclick=killServer;

 if($('btn-copy-stage'))$('btn-copy-stage').onclick=async()=>{
  const link=`http://lvh.me:${port}/?view=stage`;
  try{await navigator.clipboard.writeText(link);$('btn-copy-stage').textContent='✅ Đã chép link';setTimeout(()=>$('btn-copy-stage').textContent='📋 Sao chép link',2000);}catch{}
 };
 if($('btn-connect'))$('btn-connect').onclick=async()=>{
  const username=$('tiktok-user')?.value?.trim()||'';if(!username)return;
  try{localStorage.setItem('tiktokUser',username);}catch{}
  $('btn-connect').disabled=true;$('btn-connect').textContent='Đang nối...';showAdminMsg('');
  try{
   const r=await fetch('/api/tiktok/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})}).then(x=>x.json());
   showAdminMsg(r.success?'Đã kết nối phòng LIVE thành công!':r.error);
  }catch(e){showAdminMsg(String(e));}
  $('btn-connect').disabled=false;$('btn-connect').textContent='Kết nối';
 };
 if($('btn-disconnect'))$('btn-disconnect').onclick=()=>{fetch('/api/tiktok/disconnect',{method:'POST'}).catch(()=>{});showAdminMsg('Đã ngắt kết nối TikTok LIVE');};
 if($('tiktok-user'))$('tiktok-user').onkeydown=e=>{if(e.key==='Enter')$('btn-connect')?.click();};

 const sendControl=(action,text='')=>fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,text})}).then(r=>r.json());
 if($('btn-save-channel'))$('btn-save-channel').onclick=async()=>{
  const val=$('inp-channel-name')?.value?.trim();if(!val)return;
  const r=await sendControl('setName',val);
  if(r.success){$('inp-channel-name').value='';showAdminMsg(`Đã lưu tên kênh: ${val}`);}
 };
 if($('inp-channel-name'))$('inp-channel-name').onkeydown=e=>{if(e.key==='Enter')$('btn-save-channel')?.click();};

 if($('btn-speak-now'))$('btn-speak-now').onclick=async()=>{
  const val=$('inp-speak-now')?.value?.trim();if(!val)return;
  if(!audioCfg.masterEnabled||!audioCfg.voiceEnabled){
   showAdminMsg('⚠️ Hãy bật "Âm thanh quán" và "Giọng Cô Ba" trước khi bấm Đọc ngay.');
   return;
  }
  if(!isStage&&remoteStageCount===0&&!adminMonitor){adminMonitor=true;await syncLocalAudioEngine();}
  await sendControl('speak',val);
  $('inp-speak-now').value='';
 };
 if($('inp-speak-now'))$('inp-speak-now').onkeydown=e=>{if(e.key==='Enter')$('btn-speak-now')?.click();};

 if(document.querySelectorAll){
  for(const btn of document.querySelectorAll('.rate-btn')){
   btn.onclick=()=>sendControl('setRate',btn.dataset.rate);
  }
 }
 if($('btn-reset-game'))$('btn-reset-game').onclick=()=>sendControl('reset');

 // Giả lập buttons (Card 3)
 if($('sim-join'))$('sim-join').onclick=()=>emitTestEvent('member',{nickname:pickViewer()});
 if($('sim-chat-order'))$('sim-chat-order').onclick=()=>emitTestEvent('chat',{nickname:pickViewer(),comment:'Cô Ba ơi cho 1 tô phở tái nạm nhiều hành!'});
 if($('sim-chat-praise'))$('sim-chat-praise').onclick=()=>emitTestEvent('chat',{nickname:pickViewer(),comment:'Nhìn nồi nước lèo bốc khói thèm quá'});
 if($('sim-rose5'))$('sim-rose5').onclick=()=>emitTestEvent('gift',{nickname:pickViewer(),giftName:'Hoa hồng',giftId:5655,diamondCount:1,repeatCount:5});
 if($('sim-special'))$('sim-special').onclick=()=>emitTestEvent('gift',{nickname:pickViewer(),giftName:'Hạc giấy',giftId:5659,diamondCount:99,repeatCount:1});
 if($('sim-big-gift'))$('sim-big-gift').onclick=()=>emitTestEvent('gift',{nickname:pickViewer(),giftName:'Galaxy',giftId:11046,diamondCount:1000,repeatCount:1});
 if($('sim-combo3'))$('sim-combo3').onclick=()=>{const who=pickViewer();for(let i=0;i<3;i++)setTimeout(()=>emitTestEvent('gift',{nickname:who,giftName:'Hoa hồng',giftId:5655,diamondCount:1,repeatCount:1}),i*900);};
 if($('sim-follow'))$('sim-follow').onclick=()=>emitTestEvent('follow',{nickname:pickViewer()});
 if($('sim-like'))$('sim-like').onclick=()=>emitTestEvent('like',{nickname:pickViewer(),likeCount:100});

 // Card 4: Lưu biển hiệu + Hẹn giờ tắt Live
 fetch('/api/cai-dat').then(r=>r.json()).then(c=>{
  if($('inp-bien-hieu'))$('inp-bien-hieu').value=c.bienHieu||'';
  if($('inp-ten-quan'))$('inp-ten-quan').value=c.tenQuan||'';
  applyCaiDat(c);
 }).catch(()=>{});
 fetch('/api/audio').then(r=>r.json()).then(a=>applyAudioCfg(a,false)).catch(()=>{});
 fetch('/api/tts/status').then(r=>r.json()).then(renderTtsStatus).catch(()=>{});

 if($('btn-save-sign'))$('btn-save-sign').onclick=async()=>{
  const bienHieu=$('inp-bien-hieu')?.value||'',tenQuan=$('inp-ten-quan')?.value||'';
  const r=await fetch('/api/cai-dat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bienHieu,tenQuan})});
  if($('lbl-save-sign'))$('lbl-save-sign').textContent=r.ok?'Đã lưu, biển hiệu 3D đổi ngay!':'Lưu không được';
 };
 if($('btn-stop-live'))$('btn-stop-live').onclick=()=>{stopAt=null;renderTimer();sendControl('custom','tatlive');};

 let stopAt=null;
 function renderTimer(){
  const lbl=$('lbl-timer-status'),cancelBtn=$('btn-cancel-timer');
  if(!lbl)return;
  if(!stopAt){lbl.className='text-xs text-slate-500';lbl.textContent='Chưa hẹn giờ';if(cancelBtn)cancelBtn.hidden=true;return;}
  const left=Math.max(0,Math.ceil((stopAt-Date.now())/1000));
  const m=Math.floor(left/60),s=left%60;
  lbl.className='text-xs adm-timer-active';
  lbl.textContent=`⏳ Tự kết thúc sau ${m}:${String(s).padStart(2,'0')}`;
  if(cancelBtn)cancelBtn.hidden=false;
  if(left<=0){stopAt=null;renderTimer();sendControl('custom','tatlive');}
 }
 if(document.querySelectorAll){
  for(const pill of document.querySelectorAll('.adm-timer-pill')){
   pill.onclick=()=>{stopAt=Date.now()+Number(pill.dataset.min)*60_000;renderTimer();};
  }
 }
 if($('btn-cancel-timer'))$('btn-cancel-timer').onclick=()=>{stopAt=null;renderTimer();};
 setInterval(()=>{if(stopAt)renderTimer();},1000);
}

setInterval(()=>{if(queue.waiting===0&&canPlayAudio())sellerVoice.idleCallout();},40000);

function resize(){
 const full=isStage||Boolean(document.fullscreenElement);
 $('game').style.transform=full?`scale(${Math.min(innerWidth/450,innerHeight/800)})`:'';
 $('game').style.transformOrigin=full?'center center':'';
}
addEventListener('resize',resize);document.addEventListener?.('fullscreenchange',resize);resize();

/* CURRY POLL TRANSPORT START */
function createCurryPoll({fetchFn,onEvent,onError=()=>{},timer=setTimeout}){
 let cursor=null,epoch=null,stopped=false;
 async function poll(){if(stopped)return;try{
  const query=cursor===null?'':`?after=${cursor}&epoch=${encodeURIComponent(epoch)}`;
  const response=await fetchFn('/api/poll'+query,{cache:'no-store'});if(!response.ok)throw Error('poll unavailable');
  const data=await response.json();if(!data.ready)throw Error('not ready');
  if(!data.reset)for(const event of data.events||[])onEvent(event);
  cursor=data.cursor;epoch=data.epoch;
 }catch(error){onError(error);}if(!stopped)timer(poll,650);}
 return {start:poll,stop(){stopped=true;}};
}
/* CURRY POLL TRANSPORT END */
if(urlParams.get('transport')==='poll'||/\.trycloudflare\.com$/i.test(location.hostname||'')){
 createCurryPoll({fetchFn:fetch,onEvent:receive,onError:()=>$('connection').textContent='○ Đang kết nối lại bếp phở…'}).start();
}else{
 const sseUrl='/api/events'+(stageId?`?stage=${encodeURIComponent(stageId)}`:'');
 const events=new EventSource(sseUrl);
 events.onmessage=e=>{try{receive(JSON.parse(e.data));}catch(err){console.error(err);}};
 events.onerror=()=>$('connection').textContent='○ Đang kết nối lại bếp phở…';
}
async function bridgeStatus(){
 try{
  const s=await(await fetch('/api/bridge')).json(),connected=s.connection==='connected';
  if($('bridge'))$('bridge').textContent=connected?`TikFinity: ● (${s.forwardedEvents})`:'';
  if($('connection'))$('connection').textContent=connected?'● Đã nối TikFinity · Tặng quà để gọi phở nóng!':'● Bếp Phở Sẵn Sàng · Tặng quà hoặc bình luận để gọi phở!';
 }catch{}
}
bridgeStatus();setInterval(bridgeStatus,5000);
notice('Cô Ba đã dọn hàng xong! Tặng quà để vào xì xụp phở nóng nha 🍜');
window.kitchenState=()=>({seated:[...actors.values()].filter(a=>a.dining==='eating').length,dining:[...actors.values()].filter(a=>a.dining).map(a=>({menu:a.order.index,state:a.dining})),tables:diningSeats.length,menu:servingPlate.userData.menuIndex,waiting:queue.waiting,served:queue.served,visibleCustomers:actors.size,webgl:renderer.info.render.calls>0});
