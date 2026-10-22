// ============ DRIFT ARENA — главный модуль ============
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { Vehicle, collideVehicle } from './physics.js';
import { World } from './world.js';
import { Environment } from './env.js';
import { buildCar } from './carbuilder.js';
import { SkidMarks, Particles } from './effects.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { Showroom } from './showroom.js';
import { CARS } from './config.js';

const CAM_NAMES = ['Чейз', 'Капот', 'Кинематик'];

class Game {
  constructor(){
    this.app = document.getElementById('app');
    this.state = 'loading';
    this.last = performance.now()/1000;
    this.fps = 60;
    this.shake = 0;
    this.camMode = 0;
    this.mode = 'freeroam';
    this.modeTime = 0;
    this.totalScore = 0;
    this.chainScore = 0;
    this.chainTime = 0;
    this.chainActive = false;
    this.multiplier = 1;
    this.bestChain = 0;
    this.lap = 1; this.cpIndex = 0; this.lapStart = 0; this.lapTimes = []; this.bestLap = null;
    this.smokeAcc = 0;
    this.dustAcc = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.pitch = 0; this.roll = 0;

    // ---------- рендерер ----------
    this.renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance', stencil:false });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.app.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xa9c3dd, 60, 520);

    this.env = new Environment(this.scene, this.renderer);
    this.world = new World(this.scene);
    this.skid = new SkidMarks(this.scene);
    this.smoke = new Particles(this.scene, 380, false, 0xc9ced6);
    this.sparks = new Particles(this.scene, 140, true, 0xffb04a);
    this.dust = new Particles(this.scene, 240, false, 0xa08a68);

    this.camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.3, 2000);
    this.showroom = new Showroom(this.renderer);

    this.input = new Input();
    this.audio = new GameAudio();
    this.ui = new UI(this);

    this.buildCar();
    this.setupComposer();
    this.applySettings();
    this.bindInput();

    // тач-контролы на мобильных
    if('ontouchstart' in window || navigator.maxTouchPoints > 0){
      document.getElementById('touch').classList.remove('hidden');
    }

    window.addEventListener('resize', ()=>this.onResize());
    const unlock = ()=>{ this.audio.resume(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.env.apply(this.ui.settings.timeOfDay, this.ui.settings.drawDist);
    this.world.setNight(this.env.isNight);
    this.respawnCar();

    document.getElementById('loading').classList.add('done');
    setTimeout(()=>document.getElementById('loading').remove(), 700);
    this.state = 'menu';
    this.ui.hideAll(); this.ui.show('menu');
    this.loop();
  }

  // ---------- создание объектов ----------
  buildCar(){
    if(this.vehicle) {}
    const def = this.ui.car();
    this.def = def;
    if(this.carObj){ this.scene.remove(this.carObj.group); }
    this.carObj = buildCar(def, this.ui.style);
    this.scene.add(this.carObj.group);
    if(!this.vehicle){
      this.vehicle = new Vehicle(def, this.ui.tune);
    } else {
      const keep = { pos:this.vehicle.pos, yaw:this.vehicle.yaw, vx:this.vehicle.vx, vz:this.vehicle.vz, yawRate:this.vehicle.yawRate };
      this.vehicle = new Vehicle(def, this.ui.tune);
      Object.assign(this.vehicle, keep);
    }
    this.vehicle.surfaceGrip = 1;
    this.vehicle.onLand = (impact)=>this.onLand(impact);
    this.carObj.chassis.position.y = (this.ui.tune.rideHeight - 14)*0.0035;
    this.showroom.setCar(def, this.ui.style);
  }

  setupComposer(){
    const w = innerWidth, h = innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0.82);
    this.composer.addPass(this.afterimage);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.7, 0.82);
    this.composer.addPass(this.bloom);
    this.fxaa = new FXAAPass();
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());
  }

  bindInput(){
    this.input.onAction = (k)=>{
      if(k === 'escape') this.onEscape();
      else if(k === 'r' && this.state === 'playing') this.respawn();
      else if(k === 'c' && this.state === 'playing') this.cycleCamera();
      else if(k === 'tab') this.onTab();
      else if(k === 'm') this.audio.setMuted(!this.audio.muted);
    };
  }

  // ---------- настройки ----------
  applySettings(){
    const s = this.ui.settings;
    const pr = Math.min(2, window.devicePixelRatio || 1) * s.res;
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(innerWidth, innerHeight);

    const shadowSizes = [0, 1024, 2048, 4096];
    const size = shadowSizes[s.shadows] || 2048;
    this.renderer.shadowMap.enabled = s.shadows > 0;
    this.env.sun.castShadow = s.shadows > 0;
    this.env.sun.shadow.mapSize.set(size, size);
    if(this.env.sun.shadow.map){ this.env.sun.shadow.map.dispose(); this.env.sun.shadow.map = null; }

    this.bloom.enabled = !!s.bloom;
    this.bloom.strength = s.bloomStrength;
    this.afterimage.enabled = !!s.motionBlur;
    this.afterimage.uniforms.damp.value = s.motionDamp;
    this.fxaa.enabled = !!s.fxaa;

    this.scene.fog.far = s.drawDist;
    this.scene.fog.near = Math.max(20, s.drawDist*0.12);
    this.smoke.max = Math.max(40, Math.min(this.smoke.capacity, Math.round(380*s.smoke)));
    this.skid.mesh.visible = !!s.skid;

    if(this.env.preset !== s.timeOfDay){
      this.env.apply(s.timeOfDay, s.drawDist);
      this.world.setNight(this.env.isNight);
      this.carObj.setLights(this.env.isNight);
    }
    this.audio.setVolumes(s);
  }

  onResize(){
    this.camera.aspect = innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // ---------- состояния ----------
  startMode(mode){
    this.mode = mode;
    this.state = 'playing';
    this.ui.hideAll();
    this.ui.show('hud');
    this.totalScore = 0; this.chainScore = 0; this.chainTime = 0; this.chainActive = false;
    this.multiplier = 1; this.bestChain = 0;
    this.lap = 1; this.cpIndex = 0; this.lapTimes = []; this.bestLap = null;
    this.modeTime = mode === 'drift' ? 90 : 0;
    this.lapStart = performance.now()/1000;
    this.world.resetCones();
    this.skid.clear();
    this.respawnCar();
    this.input.enabled = true;
    const names = { freeroam:['Свободная езда','исследуйте карту'], drift:['Дрифт-зона','90 секунд на набор очков'], time:['Time Attack','3 круга по трассе'] };
    this.ui.setMode(names[mode][0], names[mode][1], mode);
    this.ui.setScore(0, this.record());
    this.ui.centerMsg(mode === 'time' ? 'ПРОЙДИТЕ CP1' : (mode === 'drift' ? '90 СЕКУНД — ПОЕХАЛИ!' : 'СВОБОДНАЯ ЕЗДА'), 2.2);
    this.audio.resume();
  }

  record(){
    const r = this.ui.save.records;
    if(this.mode === 'drift') return r.drift || 0;
    if(this.mode === 'time') return r['time_'+this.def.id] || 0;
    return r.score || 0;
  }

  pause(){
    if(this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.ui.show('pause');
  }
  resume(){
    if(this.state !== 'paused') return;
    this.ui.hideAll();
    this.ui.show('hud');
    this.state = 'playing';
    this.input.enabled = true;
    this.audio.resume();
  }
  onEscape(){
    const vis = (id)=>!document.getElementById(id).classList.contains('hidden');
    if(vis('settings')){ this.ui.hide('settings'); this.settingsClosed(); return; }
    if(vis('quicktune')){ this.ui.hide('quicktune'); this.resume(); return; }
    if(this.state === 'playing') this.pause();
    else if(this.state === 'paused') this.resume();
    else if(this.state === 'garage') this.closeGarage();
  }
  onTab(){
    if(this.state === 'playing'){ this.pause(); this.ui.show('quicktune'); }
    else if(this.state === 'paused'){ this.ui.hide('quicktune'); this.resume(); }
  }
  settingsClosed(){
    if(this.state === 'paused') this.ui.show('pause');
    else this.ui.show('menu');
  }
  toMenu(){
    this.state = 'menu';
    this.input.enabled = false;
    this.ui.hideAll(); this.ui.show('menu');
    this.ui.hide('hud');
    this.respawnCar();
  }
  restart(){ this.startMode(this.mode); }

  openGarage(fromPause){
    this.state = 'garage';
    this.prevState = fromPause ? 'paused' : 'menu';
    this.input.enabled = false;
    this.ui.hideAll();
    this.ui.show('garage');
    this.ui.buildGarage();
  }
  closeGarage(){
    this.ui.hide('garage');
    if(this.prevState === 'paused'){ this.ui.show('pause'); this.state = 'paused'; }
    else { this.ui.show('menu'); this.state = 'menu'; this.respawnCar(); }
  }

  carChanged(){ this.buildCar(); this.applySettings(); }
  styleChanged(rebuild){
    this.carObj.applyStyle(this.ui.style);
    this.showroom.applyStyle(this.ui.style);
    if(rebuild) this.buildCar();
  }
  tuneChanged(){
    this.vehicle.tune = this.ui.tune;
    this.carObj.chassis.position.y = (this.ui.tune.rideHeight - 14)*0.0035;
  }

  cycleCamera(){
    this.camMode = (this.camMode+1) % CAM_NAMES.length;
    this.ui.centerMsg('КАМЕРА: ' + CAM_NAMES[this.camMode], 1.0);
  }

  respawnCar(){
    const p = this.world.respawnPoint(this.vehicle.pos.x, this.vehicle.pos.z);
    const v = this.vehicle;
    v.pos.x = p.x; v.pos.z = p.z; v.pos.y = 0;
    v.yaw = p.yaw;
    v.vx = 0; v.vz = 0; v.vy = 0; v.yawRate = 0;
    v.airborne = false; v.airTime = 0;
    v.gear = 0; v.rpm = v.def.idle;
    v.lastGroundH = 0;
    this.camPos.set(p.x - Math.sin(p.yaw)*7, 3, p.z - Math.cos(p.yaw)*7);
  }

  constrainArena(){
    const v = this.vehicle;
    const R = 294;
    const d = Math.hypot(v.pos.x, v.pos.z);
    if(d > R){
      const nx = v.pos.x/d, nz = v.pos.z/d;
      v.pos.x = nx*R; v.pos.z = nz*R;
      const sinY = Math.sin(v.yaw), cosY = Math.cos(v.yaw);
      let WX = sinY*v.vx + cosY*v.vz, WZ = cosY*v.vx - sinY*v.vz;
      const vn = WX*nx + WZ*nz;
      if(vn > 0){
        WX -= 1.25*vn*nx; WZ -= 1.25*vn*nz;
        const tx = -nz, tz = nx;
        const vt = WX*tx + WZ*tz;
        WX -= tx*vt*0.18; WZ -= tz*vt*0.18;
        if(vn > 5){ this.audio.impact(vn*0.6); this.shake = Math.min(1, vn/14); }
      }
      v.vx = sinY*WX + cosY*WZ;
      v.vz = cosY*WX - sinY*WZ;
    }
  }

  onLand(impact){
    this.shake = Math.min(1, impact/9);
    this.audio.impact(impact*0.5);
    for(let i=0;i<8;i++){
      this.dust.spawn(
        this.vehicle.pos.x + (Math.random()-0.5)*1.6, 0.15, this.vehicle.pos.z + (Math.random()-0.5)*1.6,
        (Math.random()-0.5)*3, 1+Math.random()*2, (Math.random()-0.5)*3,
        1.2, 0.7, new THREE.Color(0x9a8b6a), 2.2);
    }
  }

  // ---------- игровой кадр ----------
  update(dt){
    const input = this.input.update(dt);
    const v = this.vehicle;

    // сцепление поверхности
    v.surfaceGrip = this.world.gripAt(v.pos.x, v.pos.z);

    // коробка передач
    const def = this.def;
    if(input.autoTrans){
      if(v.gear >= 0 && v.rpm > def.redline*0.95 && v.gear < def.gears.length-1 && v.shiftTimer <= 0){
        v.gear++; v.shiftTimer = 0.16; this.audio.blip(true);
        if(def.boost) this.audio.backfire();
      } else if(v.gear > 0 && v.rpm < def.redline*0.40 && v.shiftTimer <= 0 && v.vx > 1){
        v.gear--; v.shiftTimer = 0.14; this.audio.blip(false);
      }
    } else {
      if(input.shiftUp && v.gear < def.gears.length-1 && !this.shiftHeld){ v.gear++; v.shiftTimer = 0.16; this.audio.blip(true); this.shiftHeld = true; }
      if(!input.shiftUp) this.shiftHeld = false;
      if(input.shiftDown && v.gear > 0 && !this.shiftDownHeld){ v.gear--; v.shiftTimer = 0.14; this.audio.blip(false); this.shiftDownHeld = true; }
      if(!input.shiftDown) this.shiftDownHeld = false;
    }
    // задний ход: держим тормоз на месте — включается R
    if(v.gear === -1){
      if(input.brake > 0.5 && v.vx > -0.4) v.gear = 0;
    } else if(input.brake > 0.5 && v.vx < 0.6){
      this.revTimer = (this.revTimer||0) + dt;
      if(this.revTimer > 0.5){ v.gear = -1; this.revTimer = 0; this.ui.centerMsg('ЗАДНИЙ ХОД', 0.9); }
    } else this.revTimer = 0;

    v.step(dt, input, this.world);

    // граница арены
    this.constrainArena();

    // столкновения
    const impact = collideVehicle(v, this.world.colliders, (c, power, x, z)=>{
      if(c.cone){
        const sp = v.speed();
        const dx = (Math.sin(v.yaw)*v.vx + Math.cos(v.yaw)*v.vz);
        const dz = (Math.cos(v.yaw)*v.vx - Math.sin(v.yaw)*v.vz);
        const l = Math.hypot(dx,dz) || 1;
        c.cone.hit(dx/l, dz/l, Math.min(6, power*0.7));
      }
      if(power > 2.5){
        this.audio.impact(power);
        this.shake = Math.min(1, power/12);
        for(let i=0;i<6;i++){
          this.sparks.spawn(x, 0.35, z,
            (Math.random()-0.5)*7, Math.random()*4, (Math.random()-0.5)*7,
            0.16, 0.35+Math.random()*0.25, new THREE.Color(0xffc060), 0.2);
        }
      }
    });
    if(impact > 6) this.shake = Math.min(1, impact/12);

    this.updateVisual(dt, input);
    this.updateEffects(dt, input);
    this.updateCamera(dt);
    this.updateMode(dt);
    this.world.update(dt);
    this.env.update(v.pos);

    // звук
    const slip = Math.max(v.tires[2].slip, v.tires[3].slip, Math.abs(v.tires[0].alpha)*0.5, Math.abs(v.tires[1].alpha)*0.5);
    this.audio.update(dt, {
      rpm: v.rpm, throttle: input.throttle, speed: v.speed(),
      slip: Math.min(1, slip*1.5 + input.handbrake*0.3),
      airborne: v.airTime, limiter: v.rpm >= def.redline,
    });
  }

  updateVisual(dt, input){
    const v = this.vehicle;
    const g = this.carObj.group;
    g.position.set(v.pos.x, v.pos.y, v.pos.z);
    g.rotation.y = v.yaw;
    const ch = this.carObj.chassis;
    this.pitch += (-v.lastAx*0.011 - this.pitch)*Math.min(1, dt*9);
    this.roll += (v.lastAy*0.013 - this.roll)*Math.min(1, dt*9);
    ch.rotation.x = this.pitch;
    ch.rotation.z = this.roll;
    ch.position.y = (this.ui.tune.rideHeight - 14)*0.0035;
    for(const w of this.carObj.wheels){
      w.spin.rotation.x = v.wheelSpin;
      if(w.isFront) w.hub.rotation.y = v.steerAngle;
    }
    this.carObj.setBrake(input.brake);
    this.carObj.setLights(this.env.isNight);
  }

  rearWheelWorld(i){
    const v = this.vehicle;
    const b = v.L - v.a;
    const lx = (i===0 ? 1 : -1) * v.track/2;
    const lz = -b;
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    return { x: v.pos.x + c*lx + s*lz, z: v.pos.z - s*lx + c*lz };
  }

  updateEffects(dt, input){
    const v = this.vehicle;
    const s = this.ui.settings;
    const speed = v.speed();
    const slipR = Math.max(v.tires[2].slip, v.tires[3].slip);
    const alphaR = Math.max(Math.abs(v.tires[2].alpha), Math.abs(v.tires[3].alpha));
    const skid = Math.min(1, Math.max(slipR*1.5, (alphaR-0.10)*2.4, input.handbrake*Math.min(1, speed/7)*0.85));

    // следы шин
    if(s.skid && skid > 0.07 && v.pos.y < 0.25){
      const wx = Math.sin(v.yaw)*v.vx + Math.cos(v.yaw)*v.vz;
      const wz = Math.cos(v.yaw)*v.vx - Math.sin(v.yaw)*v.vz;
      const l = Math.hypot(wx, wz) || 1;
      for(let i=0;i<2;i++){
        const p = this.rearWheelWorld(i);
        this.skid.add(i, p.x, p.z, wx/l, wz/l, skid);
      }
    }
    this.skid.update();

    // дым
    if(skid > 0.22 && v.pos.y < 0.3){
      this.smokeAcc += dt * skid * 26 * s.smoke;
      while(this.smokeAcc > 1){
        this.smokeAcc -= 1;
        for(let i=0;i<2;i++){
          const p = this.rearWheelWorld(i);
          const dirt = v.surfaceGrip < 0.85;
          this.smoke.spawn(
            p.x + (Math.random()-0.5)*0.3, 0.22, p.z + (Math.random()-0.5)*0.3,
            (Math.random()-0.5)*2.2 - Math.sin(v.yaw)*1.5, 0.7+Math.random()*0.9, (Math.random()-0.5)*2.2 - Math.cos(v.yaw)*1.5,
            0.55+Math.random()*0.35, 1.1+Math.random()*0.9,
            new THREE.Color(dirt ? 0x9c8b6a : 0xbfc3c9), 2.4);
        }
      }
    }

    // пыль на грунте
    if(v.surfaceGrip < 0.85 && speed > 5 && v.pos.y < 0.3){
      this.dustAcc += dt * Math.min(2, speed/12) * 16 * s.smoke;
      while(this.dustAcc > 1){
        this.dustAcc -= 1;
        const side = Math.random() > 0.5 ? 1 : -1;
        this.dust.spawn(
          v.pos.x + Math.cos(v.yaw)*side*1.0 + Math.sin(v.yaw)*(Math.random()-0.5)*2,
          0.2, v.pos.z - Math.sin(v.yaw)*side*1.0 + Math.cos(v.yaw)*(Math.random()-0.5)*2,
          (Math.random()-0.5)*2, 0.8+Math.random(), (Math.random()-0.5)*2,
          0.7, 0.9, new THREE.Color(0x9a8b6a), 2.0);
      }
    }

    this.smoke.update(dt);
    this.sparks.update(dt);
    this.dust.update(dt);
  }

  updateCamera(dt){
    const v = this.vehicle;
    const s = this.ui.settings;
    const speed = v.speed();
    const sinY = Math.sin(v.yaw), cosY = Math.cos(v.yaw);
    const fx = sinY, fz = cosY;
    const wx = sinY*v.vx + cosY*v.vz;
    const wz = cosY*v.vx - sinY*v.vz;
    const wl = Math.hypot(wx, wz) || 1;
    const dirX = wl > 3 ? wx/wl : fx;
    const dirZ = wl > 3 ? wz/wl : fz;

    let px, py, pz, lx, ly, lz;
    if(this.camMode === 1){
      // капот
      px = v.pos.x + fx*0.35 + cosY*0.32;
      py = v.pos.y + 1.18;
      pz = v.pos.z + fz*0.35 - sinY*0.32;
      lx = v.pos.x + fx*14; ly = v.pos.y + 1.0; lz = v.pos.z + fz*14;
      this.camPos.lerp(new THREE.Vector3(px,py,pz), Math.min(1, dt*14));
      this.camLook.lerp(new THREE.Vector3(lx,ly,lz), Math.min(1, dt*14));
    } else if(this.camMode === 2){
      const a = performance.now()/1000*0.22;
      px = v.pos.x + Math.cos(a)*11; pz = v.pos.z + Math.sin(a)*11; py = v.pos.y + 3.6;
      this.camPos.lerp(new THREE.Vector3(px,py,pz), Math.min(1, dt*3));
      this.camLook.lerp(new THREE.Vector3(v.pos.x, v.pos.y+0.7, v.pos.z), Math.min(1, dt*6));
    } else {
      const back = s.camDist + Math.min(2.2, speed*0.035);
      px = v.pos.x - dirX*back + cosY*0.0;
      pz = v.pos.z - dirZ*back;
      py = v.pos.y + s.camHeight + Math.min(0.7, speed*0.008);
      lx = v.pos.x + dirX*4.5;
      lz = v.pos.z + dirZ*4.5;
      ly = v.pos.y + s.camLook;
      this.camPos.lerp(new THREE.Vector3(px,py,pz), Math.min(1, dt*(v.airborne?4:7)));
      this.camLook.lerp(new THREE.Vector3(lx,ly,lz), Math.min(1, dt*9));
    }

    this.shake = Math.max(0, this.shake - dt*2.2);
    const sh = this.shake*0.35 + Math.min(0.06, speed*0.0008)*(1+v.rpm/8000);
    this.camera.position.set(
      this.camPos.x + (Math.random()-0.5)*sh,
      this.camPos.y + (Math.random()-0.5)*sh,
      this.camPos.z + (Math.random()-0.5)*sh);
    this.camera.lookAt(this.camLook);

    const targetFov = s.speedFov ? s.fov + Math.min(18, speed*0.28) : s.fov;
    this.camera.fov += (targetFov - this.camera.fov)*Math.min(1, dt*4);
    this.camera.updateProjectionMatrix();
  }

  // ---------- режимы и очки ----------
  updateMode(dt){
    const v = this.vehicle;
    const angle = Math.abs(v.driftAngle());
    const speed = v.speed();
    const drifting = angle > 0.20 && speed > 7 && v.pos.y < 0.4;

    if(this.mode !== 'time'){
      if(drifting){
        this.chainTime += dt;
        this.chainActive = true;
        this.multiplier = 1 + Math.min(4, Math.floor(this.chainTime/2.2));
        this.chainScore += angle*speed*13*dt*this.multiplier;
        if(this.chainScore > this.bestChain) this.bestChain = this.chainScore;
      } else if(this.chainActive){
        if(this.chainScore > 150){
          this.totalScore += this.chainScore;
          this.ui.popup(Math.round(this.chainScore).toLocaleString('ru-RU') + ' ОЧКОВ', 'МНОЖИТЕЛЬ ×' + this.multiplier);
        }
        this.chainScore = 0; this.chainTime = 0; this.chainActive = false; this.multiplier = 1;
      }
      this.ui.setScore(this.totalScore + this.chainScore, this.record());
    }

    if(this.mode === 'drift'){
      this.modeTime -= dt;
      this.ui.setTimer(Math.max(0, this.modeTime).toFixed(1) + ' с', 'множитель ×' + this.multiplier);
      if(this.modeTime <= 0) this.endMode();
    } else if(this.mode === 'time'){
      const cp = this.world.checkpoints[this.cpIndex];
      if(cp){
        const d = Math.hypot(v.pos.x-cp.x, v.pos.z-cp.z);
        if(d < 13){
          this.cpIndex++;
          this.ui.centerMsg('CP' + (this.cpIndex+1) + ' / 3', 1.0);
          if(this.cpIndex >= 3) this.ui.centerMsg('ФИНИШНЫЙ ПРЯМАЯ', 1.4);
        }
      } else {
        const st = this.world.startPos;
        const d = Math.hypot(v.pos.x-st.x, v.pos.z-st.z);
        if(d < 13 && v.speed() > 3){
          const t = performance.now()/1000 - this.lapStart;
          this.lapTimes.push(t);
          if(this.bestLap === null || t < this.bestLap) this.bestLap = t;
          this.lapStart = performance.now()/1000;
          this.cpIndex = 0;
          this.lap++;
          if(this.lap > 3){ this.endMode(); return; }
          this.ui.centerMsg('КРУГ ' + this.lap + ' / 3', 1.6);
        }
      }
      const el = performance.now()/1000 - this.lapStart;
      this.ui.setTimer(this.fmtTime(el), 'круг ' + Math.min(this.lap,3) + '/3' + (this.bestLap ? ' · лучший ' + this.fmtTime(this.bestLap) : ''));
      // направление
      const near = this.world.nearestTrack(v.pos.x, v.pos.z);
      if(near){
        const dot = (Math.sin(v.yaw)*near.tx + Math.cos(v.yaw)*near.tz);
        document.getElementById('checkpoint-arrow').style.opacity = dot < 0.2 ? '0.9' : '0';
      }
    } else {
      this.ui.setTimer(this.fmtTime(this.modeTime += dt), 'свободная езда');
    }
  }

  endMode(){
    this.state = 'results';
    this.input.enabled = false;
    const r = this.ui.save.records;
    let html = '', rec = false;
    if(this.mode === 'drift'){
      const total = Math.round(this.totalScore);
      if(!r.drift || total > r.drift){ r.drift = total; rec = true; }
      html = `<div class="big-num">${total.toLocaleString('ru-RU')}</div>
        <div class="line">очков дрифта · лучший занос ${Math.round(this.bestChain).toLocaleString('ru-RU')}</div>
        <div class="line">рекорд: ${(r.drift||0).toLocaleString('ru-RU')}</div>`;
    } else if(this.mode === 'time'){
      const total = this.lapTimes.reduce((a,b)=>a+b, 0);
      const key = 'time_'+this.def.id;
      const prev = r[key];
      if(prev === undefined || total < prev){ r[key] = total; rec = true; }
      html = `<div class="big-num">${this.fmtTime(total)}</div>
        <div class="line">${this.lapTimes.map(t=>this.fmtTime(t)).join(' · ')}</div>
        <div class="line">лучший круг: ${this.fmtTime(this.bestLap||0)} · рекорд: ${this.fmtTime(r[key]||0)}</div>`;
    } else {
      const total = Math.round(this.totalScore);
      if(!r.score || total > r.score){ r.score = total; rec = true; }
      html = `<div class="big-num">${total.toLocaleString('ru-RU')}</div><div class="line">очков дрифта за сессию</div>`;
    }
    this.ui.persist();
    if(rec) html += `<div class="rec">🏆 НОВЫЙ РЕКОРД!</div>`;
    this.ui.results(this.mode === 'time' ? 'ГОНКА ОКОНЧЕНА' : 'РЕЗУЛЬТАТ', html);
    this.ui.hide('hud');
  }

  fmtTime(t){
    const m = Math.floor(t/60);
    const s = t - m*60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  // ---------- рендер ----------
  render(){
    if(this.state === 'garage'){
      this.showroom.render();
    } else {
      this.composer.render();
    }
  }

  loop(){
    requestAnimationFrame(()=>this.loop());
    const now = performance.now()/1000;
    let dt = now - this.last;
    this.last = now;
    if(dt > 0.1) dt = 0.1;
    this.fps += (1/Math.max(dt, 1e-4) - this.fps)*0.06;

    if(this.state === 'playing'){
      this.update(dt);
    } else if(this.state === 'garage'){
      this.showroom.update(dt);
    } else if(this.state === 'paused' || this.state === 'quicktune'){
      // на паузе камера остаётся на месте
    } else {
      // живое меню: камера облетает машину на стартовой прямой
      const t = now*0.16;
      const sp = this.world.startPos;
      const cx = sp.x + Math.cos(t)*15, cz = sp.z + Math.sin(t)*15;
      this.camera.position.set(cx, 4.6 + Math.sin(t*2)*0.5, cz);
      this.camera.lookAt(sp.x, 1.0, sp.z);
      this.camera.fov += (58 - this.camera.fov)*Math.min(1, dt*3);
      this.camera.updateProjectionMatrix();
      this.carObj.group.position.set(sp.x, 0, sp.z);
      this.carObj.group.rotation.y = sp.rot;
      this.carObj.setBrake(0);
      this.carObj.setLights(this.env.isNight);
      this.world.update(dt);
      this.env.update(this.vehicle.pos);
    }

    this.render();

    const v = this.vehicle;
    this.ui.update(dt, {
      kmh: v.speed()*3.6, mph: v.speed()*2.237,
      rpm: v.rpm, redline: this.def.redline,
      gear: v.gear < 0 ? 'R' : String(v.gear+1),
      drift: Math.abs(v.driftAngle())/0.9,
      fps: this.fps,
    });
  }
}

window.addEventListener('DOMContentLoaded', ()=>{ window.game = new Game(); });
if(document.readyState !== 'loading'){ window.game = new Game(); }
