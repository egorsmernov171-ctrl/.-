// ============ Эффекты: следы шин, дым, искры ============
import * as THREE from 'three';

function smokeTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32,32,0,32,32,32);
  grd.addColorStop(0,'rgba(255,255,255,0.55)');
  grd.addColorStop(0.35,'rgba(255,255,255,0.22)');
  grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0,0,64,64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- следы шин на асфальте ----------
export class SkidMarks {
  constructor(scene, maxSeg = 2400){
    this.max = maxSeg;
    this.used = 0;
    this.head = 0;
    this.pos = new Float32Array(maxSeg*4*3);
    this.col = new Float32Array(maxSeg*4*4);
    this.birth = new Float32Array(maxSeg);
    this.last = [null, null];
    this.life = 42;

    const idx = new Uint32Array(maxSeg*6);
    for(let i=0;i<maxSeg;i++){
      const a = i*4;
      idx.set([a, a+1, a+2, a, a+2, a+3], i*6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.geo = geo;
  }

  // индекс колеса: 0 или 1 (два задних)
  add(wheelIdx, x, z, dirX, dirZ, intensity){
    const half = 0.16;
    const rx = dirZ, rz = -dirX;
    const lx = x - rx*half, lz = z - rz*half;
    const rx2 = x + rx*half, rz2 = z + rz*half;
    const prev = this.last[wheelIdx];
    if(!prev){ this.last[wheelIdx] = {x, z, lx, lz, rx2, rz2}; return; }
    const d = Math.hypot(x-prev.x, z-prev.z);
    if(d < 0.35){ return; }
    const i = this.head;
    this.head = (this.head+1) % this.max;
    this.used = Math.min(this.used+1, this.max);
    const p = this.pos, c = this.col;
    const o = i*12;
    p[o+0]=prev.lx; p[o+1]=prev.lz; p[o+2]=0.015;
    p[o+3]=prev.rx2; p[o+4]=prev.rz2; p[o+5]=0.015;
    p[o+6]=rx2;     p[o+7]=rz2;     p[o+8]=0.015;
    p[o+9]=lx;      p[o+10]=lz;     p[o+11]=0.015;
    const a = Math.min(0.85, 0.25 + intensity*0.7);
    const co = i*16;
    for(let k=0;k<4;k++){ c[co+k*4+0]=0.03; c[co+k*4+1]=0.03; c[co+k*4+2]=0.035; c[co+k*4+3]=a; }
    this.birth[i] = performance.now()/1000;
    // частичная загрузка буфера (только изменённый сегмент) — важно для FPS
    const pa = this.geo.attributes.position;
    pa.clearUpdateRanges(); pa.addUpdateRange(i*12, 12); pa.needsUpdate = true;
    const ca = this.geo.attributes.color;
    ca.clearUpdateRanges(); ca.addUpdateRange(i*16, 16); ca.needsUpdate = true;
    this.geo.setDrawRange(0, this.used*6);
    this.last[wheelIdx] = {x, z, lx, lz, rx2, rz2};
  }

  clear(){
    this.used = 0; this.head = 0; this.last = [null, null];
    this.geo.setDrawRange(0, 0);
  }

  update(){
    // затухание следов — обновляем не каждый кадр, а 10 раз в секунду
    this.fadeTimer = (this.fadeTimer||0) + 1;
    if(this.fadeTimer % 6 !== 0) return;
    const now = performance.now()/1000;
    let dirty = false;
    for(let i=0;i<this.used;i++){
      const age = now - this.birth[i];
      const a = Math.max(0, 1 - age/this.life) * 0.85;
      const co = i*16;
      const target = Math.min(0.85, a);
      if(Math.abs(this.col[co+3] - target) > 0.004){ dirty = true; }
      this.col[co+3] = target; this.col[co+7] = target; this.col[co+11] = target; this.col[co+15] = target;
    }
    if(dirty) this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------- частицы (дым / пыль / искры) ----------
export class Particles {
  constructor(scene, max, additive, color){
    this.max = max;
    this.capacity = max;
    this.pos = new Float32Array(max*3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.col = new Float32Array(max*3);
    this.data = new Array(max).fill(null);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: smokeTexture() } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * (420.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vC, t.a * vA);
          if(gl_FragColor.a < 0.003) discard;
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    this.baseColor = new THREE.Color(color);
  }

  spawn(x, y, z, vx, vy, vz, size, life, color, grow){
    const i = this.head;
    this.head = (this.head+1) % this.max;
    this.data[i] = { x, y, z, vx, vy, vz, size, life, maxLife: life, grow: grow||1.6, color: color||this.baseColor };
    this.pos[i*3]=x; this.pos[i*3+1]=y; this.pos[i*3+2]=z;
    this.size[i]=size; this.alpha[i]=1;
    const c = this.data[i].color;
    this.col[i*3]=c.r; this.col[i*3+1]=c.g; this.col[i*3+2]=c.b;
  }

  update(dt){
    let dirty = false;
    for(let i=0;i<this.max;i++){
      const p = this.data[i];
      if(!p) continue;
      p.life -= dt;
      if(p.life <= 0){ this.data[i]=null; this.alpha[i]=0; dirty=true; continue; }
      p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
      p.vx *= Math.pow(0.35, dt); p.vz *= Math.pow(0.35, dt);
      p.vy = p.vy*Math.pow(0.5, dt) + 1.2*dt;
      p.size += p.grow*dt;
      const t = p.life/p.maxLife;
      this.pos[i*3]=p.x; this.pos[i*3+1]=p.y; this.pos[i*3+2]=p.z;
      this.size[i]=p.size;
      this.alpha[i]= t*t*0.9;
      dirty = true;
    }
    if(dirty){
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
    }
  }
}
