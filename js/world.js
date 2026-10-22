// ============ Игровой мир: трасса, скейд-пад, трамплины, объекты ============
import * as THREE from 'three';
import { Cone } from './physics.js';
import { asphaltTexture, roadTexture, curbTexture, skidpadTexture, buildingTexture, billboardTexture, dirtTexture } from './textures.js';

const MAP_R = 300;

export class World {
  constructor(scene){
    this.scene = scene;
    this.colliders = [];
    this.cones = [];
    this.ramps = [];
    this.checkpoints = [];
    this.trackSamples = [];
    this.time = 0;

    // ---- points трассы (замкнутая петля) ----
    const pts = [
      [0,168],[64,158],[118,116],[132,44],[112,-16],[140,-72],[122,-128],[66,-160],
      [0,-172],[-64,-160],[-124,-124],[-140,-64],[-118,-8],[-140,44],[-118,112],[-58,160],
    ];
    this.curve = new THREE.CatmullRomCurve3(
      pts.map(p=>new THREE.Vector3(p[0], 0, p[1])), true, 'catmullrom', 0.5);
    this.roadHalf = 7.2;
    this.trackLen = this.curve.getLength();

    this.build();
  }

  // ---------- постройка ----------
  build(){
    const scene = this.scene;

    // земля
    const groundMat = new THREE.MeshStandardMaterial({
      map: dirtTexture(70), color: 0x8a7f6d, roughness: 0.98, metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(620, 72), groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    this.buildRoad();
    this.buildCurbs();
    this.buildTireWalls();
    this.buildSkidpad();
    this.buildRamps();
    this.buildCones();
    this.buildGantry();
    this.buildCheckpoints();
    this.buildBuildings();
    this.buildLights();
    this.buildTrees();
    this.buildBillboards();

    // внешняя граница арены
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.9, metalness: 0.1 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(MAP_R, MAP_R, 3.2, 96, 1, true), wallMat);
    wall.position.y = 1.6;
    scene.add(wall);
  }

  buildRoad(){
    const N = 420;
    const pos = [], uv = [], idx = [];
    const hw = this.roadHalf;
    const len = this.trackLen;
    for(let i=0;i<=N;i++){
      const t = i/N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      pos.push(p.x + nx*hw, 0.02, p.z + nz*hw);
      pos.push(p.x - nx*hw, 0.02, p.z - nz*hw);
      const v = (i/N)*len/16;
      uv.push(0, v, 1, v);
      if(i<N){
        const a = i*2;
        idx.push(a, a+1, a+2, a+1, a+3, a+2);
      }
      this.trackSamples.push({ x:p.x, z:p.z, tx:tan.x, tz:tan.z, t });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.94, metalness: 0.02 });
    const road = new THREE.Mesh(geo, mat);
    road.receiveShadow = true;
    this.scene.add(road);
    this.roadMesh = road;
  }

  buildCurbs(){
    const N = 420;
    const hw = this.roadHalf;
    for(const side of [-1, 1]){
      const pos = [], uv = [], idx = [];
      for(let i=0;i<=N;i++){
        const t = i/N;
        const p = this.curve.getPointAt(t);
        const tan = this.curve.getTangentAt(t);
        const nx = -tan.z, nz = tan.x;
        const off = hw + 0.55;
        pos.push(p.x + nx*(off+0.55*side), 0.055, p.z + nz*(off+0.55*side));
        pos.push(p.x + nx*off*side, 0.055, p.z + nz*off*side);
        const v = (i/N)*this.trackLen/3;
        uv.push(0, v, 1, v);
        if(i<N){ const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: curbTexture(), roughness: 0.8 }));
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  buildTireWalls(){
    const N = Math.floor(this.trackLen/5.2);
    const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.3, 14);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.95 });
    const inst = new THREE.InstancedMesh(tireGeo, tireMat, N*8);
    inst.castShadow = true; inst.receiveShadow = true;
    const m = new THREE.Matrix4();
    let k = 0;
    const hw = this.roadHalf;
    for(let i=0;i<N;i++){
      const t = i/N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      for(const side of [-1,1]){
        for(let s=0;s<4;s++){
          const off = hw + 1.5 + side*0.0;
          const x = p.x + nx*(side>0 ? off+0.5 : -(off+0.5));
          const z = p.z + nz*(side>0 ? off+0.5 : -(off+0.5));
          m.makeTranslation(x, 0.16 + s*0.29, z);
          inst.setMatrixAt(k++, m);
        }
        this.colliders.push({
          x: p.x + nx*(side>0 ? hw+2.0 : -(hw+2.0)),
          z: p.z + nz*(side>0 ? hw+2.0 : -(hw+2.0)),
          hw: 1.0, hd: 2.4, rot: Math.atan2(tan.x, tan.z), type:'tire',
        });
      }
    }
    inst.count = k;
    this.scene.add(inst);
  }

  buildSkidpad(){
    const R = 46;
    const geo = new THREE.CircleGeometry(R, 64);
    const mat = new THREE.MeshStandardMaterial({ map: skidpadTexture(), roughness: 0.9, metalness: 0.03 });
    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI/2;
    pad.position.set(196, 0.03, 96);
    pad.receiveShadow = true;
    this.scene.add(pad);
    this.skidpad = { x:196, z:96, r:R };

    // бордюр по кругу
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R+0.6, 0.35, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.8 }));
    ring.rotation.x = -Math.PI/2;
    ring.position.set(196, 0.3, 96);
    this.scene.add(ring);
    for(let i=0;i<24;i++){
      const a = i/24*Math.PI*2;
      this.colliders.push({
        x: 196 + Math.cos(a)*(R+0.6), z: 96 + Math.sin(a)*(R+0.6),
        hw: 1.6, hd: 0.5, rot: a + Math.PI/2, type:'tire',
      });
    }

    // стопки шин на площадке
    for(let i=0;i<10;i++){
      const a = i/10*Math.PI*2;
      const x = 196 + Math.cos(a)*30, z = 96 + Math.sin(a)*30;
      this.addTireStack(x, z);
    }
  }

  addTireStack(x, z){
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.95 });
    for(let i=0;i<3;i++){
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.3,14), mat);
      t.position.y = 0.16 + i*0.3;
      t.castShadow = true; t.receiveShadow = true;
      g.add(t);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ x, z, hw: 0.55, hd: 0.55, type:'tire' });
  }

  buildRamps(){
    const specs = [
      { t: 0.055, len: 10, wid: 11, h: 2.1, lip: 2.0, off: 2.8 },
      { t: 0.42,  len: 9,  wid: 10, h: 1.8, lip: 1.8, off: -3.0 },
      { t: 0.72,  len: 11, wid: 12, h: 2.6, lip: 2.2, off: 3.2 },
    ];
    for(const s of specs){
      const p = this.curve.getPointAt(s.t);
      const tan = this.curve.getTangentAt(s.t);
      const rot = Math.atan2(tan.x, tan.z);
      p.x += Math.cos(rot)*s.off;
      p.z += -Math.sin(rot)*s.off;
      const mesh = this.makeRampMesh(s.len, s.wid, s.h, s.lip);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = rot;
      this.scene.add(mesh);
      this.ramps.push({ x:p.x, z:p.z, rot, len:s.len, wid:s.wid, h:s.h, lip:s.lip });
      // боковые коллайдеры
      const nx = Math.cos(rot), nz = -Math.sin(rot);
      for(const side of [-1,1]){
        const ox = p.x + nx*side*s.wid/2, oz = p.z + nz*side*s.wid/2;
        this.colliders.push({ x: ox, z: oz, hw: 0.25, hd: s.len/2, rot, type:'wall' });
      }
    }
  }

  makeRampMesh(len, wid, h, lip){
    const w = wid/2;
    const A = [-w,0,0], B=[-w,0,len], C=[-w,h+0.06,len], D=[-w,h,len-lip];
    const E = [ w,0,0], F=[ w,0,len], G=[ w,h+0.06,len], H=[ w,h,len-lip];
    const V = [A,B,C,D,E,F,G,H];
    const F_ = [
      [0,1,5],[0,5,4],       // низ
      [0,3,7],[0,7,4],       // скат
      [3,2,6],[3,6,7],       // верх
      [1,2,6],[1,6,5],       // перед
      [0,1,2],[0,2,3],       // бок -
      [4,7,6],[4,6,5],       // бок +
    ];
    const pos = [], idx = [];
    for(const v of V) pos.push(v[0], v[1], v[2]);
    for(const f of F_) idx.push(f[0],f[1],f[2]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xb8bcc2, roughness: 0.85, metalness: 0.15, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  buildCones(){
    const coneGeo = new THREE.ConeGeometry(0.26, 0.62, 12);
    coneGeo.translate(0, 0.31, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.7 });
    const baseGeo = new THREE.BoxGeometry(0.42, 0.04, 0.42);
    baseGeo.translate(0, 0.02, 0);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9 });

    const spots = [];
    // слалом на стартовой прямой
    for(let i=0;i<14;i++){
      const t = 0.012 + i*0.0075;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      const side = i%2 ? 1 : -1;
      spots.push([p.x + nx*side*3.4, p.z + nz*side*3.4]);
    }
    // конусы вокруг скейд-пада
    for(let i=0;i<18;i++){
      const a = i/18*Math.PI*2;
      spots.push([196 + Math.cos(a)*38, 96 + Math.sin(a)*38]);
    }
    // несколько у дороги
    for(let i=0;i<10;i++){
      const t = 0.3 + i*0.012;
      const p = this.curve.getPointAt(t);
      spots.push([p.x + (Math.random()-0.5)*10, p.z + (Math.random()-0.5)*10]);
    }

    const m = new THREE.Matrix4();
    spots.forEach((s, i)=>{
      const cone = new Cone(s[0], s[1], null);
      const g = new THREE.Group();
      const c = new THREE.Mesh(coneGeo, mat); c.castShadow = true; g.add(c);
      const b = new THREE.Mesh(baseGeo, baseMat); g.add(b);
      g.position.set(s[0], 0, s[1]);
      this.scene.add(g);
      cone.mesh = g;
      cone.homeX = s[0]; cone.homeZ = s[1];
      this.cones.push(cone);
      this.colliders.push({ x:s[0], z:s[1], hw:0.24, hd:0.24, type:'cone', cone });
    });
  }

  buildGantry(){
    const t = 0.0;
    const p = this.curve.getPointAt(t);
    const tan = this.curve.getTangentAt(t);
    const rot = Math.atan2(tan.x, tan.z);
    const g = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6, metalness: 0.5 });
    for(const sx of [-1,1]){
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), postMat);
      post.position.set(sx*11, 4, 0);
      post.castShadow = true;
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(23, 2.4, 0.5), postMat);
    beam.position.set(0, 7.6, 0);
    beam.castShadow = true;
    g.add(beam);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.8),
      new THREE.MeshStandardMaterial({ map: billboardTexture('START / FINISH', '#111318', '#ff2d55', 'DRIFT ARENA'), roughness: 0.7, side: THREE.DoubleSide }));
    banner.position.set(0, 7.6, 0.3);
    g.add(banner);
    const banner2 = banner.clone();
    banner2.position.z = -0.3; banner2.rotation.y = Math.PI;
    g.add(banner2);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = rot;
    this.scene.add(g);
    this.startPos = { x: p.x, z: p.z, rot };
    // линия старта на асфальте
    const line = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.8 }));
    line.rotation.x = -Math.PI/2; line.rotation.z = -rot;
    line.position.set(p.x, 0.04, p.z);
    this.scene.add(line);
  }

  buildCheckpoints(){
    const ts = [0.25, 0.5, 0.75];
    this.checkpoints = ts.map((t, i)=>{
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const rot = Math.atan2(tan.x, tan.z);
      const g = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6, metalness: 0.4 });
      for(const sx of [-1,1]){
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), postMat);
        post.position.set(sx*9.5, 3.2, 0);
        post.castShadow = true;
        g.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 1.4, 0.4), postMat);
      beam.position.set(0, 6.2, 0);
      g.add(beam);
      const col = ['#00e5ff','#ffd400','#25d366'][i];
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.2),
        new THREE.MeshStandardMaterial({
          map: billboardTexture(`CP ${i+1}`, '#0d1016', col), roughness: 0.7,
          emissive: new THREE.Color(col), emissiveIntensity: 0.5, emissiveMap: null, side: THREE.DoubleSide }));
      banner.position.set(0, 6.2, 0.26);
      g.add(banner);
      const b2 = banner.clone(); b2.position.z = -0.26; b2.rotation.y = Math.PI;
      g.add(b2);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = rot;
      this.scene.add(g);
      return { x: p.x, z: p.z, rot, hw: 9.5, index: i+1 };
    });
  }

  buildBuildings(){
    const texes = [buildingTexture(6), buildingTexture(9), buildingTexture(4)];
    for(let i=0;i<22;i++){
      const a = 0.15 + i*0.285 + Math.random()*0.05;
      const rad = 215 + Math.random()*70;
      const x = Math.cos(a)*rad, z = Math.sin(a)*rad;
      const w = 14 + Math.random()*18, h = 12 + Math.random()*34, d = 14 + Math.random()*18;
      const mat = new THREE.MeshStandardMaterial({
        map: texes[i%3], color: 0x9aa0aa, roughness: 0.85, metalness: 0.1 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, h/2, z);
      b.rotation.y = Math.random()*Math.PI;
      b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b);
    }
  }

  buildLights(){
    this.lampLights = [];
    const N = Math.floor(this.trackLen/42);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0xffe9b0, emissiveIntensity: 0, roughness: 0.4 });
    for(let i=0;i<N;i++){
      const t = i/N;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      const side = i%2 ? 1 : -1;
      const x = p.x + nx*side*(this.roadHalf+3.2), z = p.z + nz*side*(this.roadHalf+3.2);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 8.5, 8), poleMat);
      pole.position.y = 4.25; pole.castShadow = true;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), poleMat);
      arm.position.set(-side*1.1, 8.4, 0);
      g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.6), headMat);
      head.position.set(-side*2.1, 8.3, 0);
      g.add(head);
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(tan.x, tan.z);
      this.scene.add(g);
      if(i % 4 === 0 && this.lampLights.length < 8){
        const pl = new THREE.PointLight(0xffd9a0, 0, 46, 2);
        pl.position.set(x - side*2.1, 8, z);
        this.scene.add(pl);
        this.lampLights.push(pl);
      }
    }
    this.lampMat = headMat;
  }

  setNight(on){
    this.lampMat.emissiveIntensity = on ? 3.0 : 0.0;
    for(const l of this.lampLights) l.intensity = on ? 260 : 0;
  }

  buildTrees(){
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e4a26, roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 3.2, 7);
    const leafGeo = new THREE.ConeGeometry(2.6, 5.5, 8);
    const count = 70;
    const inst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const inst2 = new THREE.InstancedMesh(leafGeo, leafMat, count*2);
    const m = new THREE.Matrix4();
    let k = 0, k2 = 0;
    for(let i=0;i<count;i++){
      const a = Math.random()*Math.PI*2;
      const rad = 200 + Math.random()*95;
      const x = Math.cos(a)*rad, z = Math.sin(a)*rad;
      if(this.nearTrack(x, z, 16)) continue;
      m.makeTranslation(x, 1.6, z); inst.setMatrixAt(k++, m);
      m.makeTranslation(x, 5.6, z); inst2.setMatrixAt(k2++, m);
      m.makeTranslation(x, 7.6, z); inst2.setMatrixAt(k2++, m);
    }
    inst.count = k; inst2.count = k2;
    inst.castShadow = true;
    this.scene.add(inst); this.scene.add(inst2);
  }

  buildBillboards(){
    const specs = [
      { t:0.10, side:1, text:'DRIFT', bg:'#141822', fg:'#00e5ff', sub:'ARENA' },
      { t:0.36, side:-1, text:'TIRES', bg:'#ff2d55', fg:'#ffffff', sub:'MAX GRIP' },
      { t:0.63, side:1, text:'NITRO', bg:'#0f1420', fg:'#ffd400', sub:'BOOST' },
      { t:0.88, side:-1, text:' drift', bg:'#101820', fg:'#25d366', sub:'ZONE' },
    ];
    for(const s of specs){
      const p = this.curve.getPointAt(s.t);
      const tan = this.curve.getTangentAt(s.t);
      const nx = -tan.z, nz = tan.x;
      const x = p.x + nx*s.side*(this.roadHalf+7), z = p.z + nz*s.side*(this.roadHalf+7);
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.7 }));
      post.position.y = 2.5; post.castShadow = true;
      g.add(post);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5),
        new THREE.MeshStandardMaterial({ map: billboardTexture(s.text, s.bg, s.fg, s.sub), roughness: 0.75, side: THREE.DoubleSide }));
      plane.position.y = 7.2;
      g.add(plane);
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(tan.x, tan.z) + (s.side>0 ? -0.5 : 0.5);
      this.scene.add(g);
    }
  }

  nearTrack(x, z, dist){
    for(const s of this.trackSamples){
      const dx = x-s.x, dz = z-s.z;
      if(dx*dx + dz*dz < dist*dist) return true;
    }
    return false;
  }

  // ---------- запросы ----------
  groundHeight(x, z){
    let h = 0;
    for(const r of this.ramps){
      const dx = x - r.x, dz = z - r.z;
      const c = Math.cos(r.rot), s = Math.sin(r.rot);
      const along = dx*s + dz*c;   // локальный Z (направление трамплина)
      const lat = dx*c - dz*s;     // локальный X (поперёк)
      if(Math.abs(lat) <= r.wid/2 && along >= 0 && along <= r.len){
        const flat = r.len - r.lip;
        const hh = along <= flat ? r.h*(along/flat) : r.h;
        if(hh > h) h = hh;
      }
    }
    return h;
  }

  gripAt(x, z){
    if(this.skidpad){
      const dx = x-this.skidpad.x, dz = z-this.skidpad.z;
      if(dx*dx + dz*dz < (this.skidpad.r+1)*(this.skidpad.r+1)) return 1.0;
    }
    for(const s of this.trackSamples){
      const dx = x-s.x, dz = z-s.z;
      if(dx*dx + dz*dz < (this.roadHalf+1.2)*(this.roadHalf+1.2)) return 1.0;
    }
    return 0.66;
  }

  nearestTrack(x, z){
    let best = null, bd = 1e9;
    for(const s of this.trackSamples){
      const dx = x-s.x, dz = z-s.z;
      const d = dx*dx + dz*dz;
      if(d < bd){ bd = d; best = s; }
    }
    return best;
  }

  respawnPoint(x, z){
    const s = this.nearestTrack(x, z);
    if(!s) return { x:0, z:0, yaw:0 };
    return { x: s.x, z: s.z, yaw: Math.atan2(s.tx, s.tz) };
  }

  update(dt){
    this.time += dt;
    for(const c of this.cones) c.step(dt);
  }

  resetCones(){
    for(const c of this.cones){
      c.x = c.homeX; c.z = c.homeZ; c.y = 0;
      c.vx = c.vz = c.vy = c.vr = 0;
      if(c.mesh){ c.mesh.position.set(c.homeX, 0, c.homeZ); c.mesh.rotation.set(0,0,0); }
    }
  }
}
