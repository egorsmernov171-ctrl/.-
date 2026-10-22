// ============ Физика автомобиля: 4 колеса, модель шин Пажейка, перенос веса, АЭРО ============
import { COMPOUNDS } from './config.js';

const G = 9.81;
const RHO = 1.225;
const TAU = Math.PI * 2;

// упрощённая «магическая формула» Пажейки: нечётная, насыщается на ±1
function magic(alpha, B, C, E){
  const x = B * alpha;
  return Math.sin(C * Math.atan(x - E * (x - Math.atan(x))));
}

export class Vehicle {
  constructor(def, tune){
    this.def = def;
    this.tune = tune;
    this.mass = def.mass;
    this.L = def.wb;
    this.a = def.wb * (1 - def.frontDist); // от ЦТ до передней оси (frontDist = доля веса спереди)
    this.b = this.L - this.a;             // от ЦТ до задней оси
    this.track = def.track;
    this.r = def.wheelR;
    this.Izz = this.mass * (this.L*this.L + this.track*this.track) / 12 * 1.28;
    this.tires = [0,1,2,3].map(()=>({ alpha:0, Fx:0, Fy:0, Fz:0, demand:0, slip:0, temp:60 }));
    this.gear = 0; this.rpm = def.idle; this.shiftTimer = 0; this.lastShift = 0;
    this.steer = 0; this.steerTarget = 0;
    this.reset(0, 0, 0);
  }

  reset(x, z, yaw){
    this.pos = { x, y:0, z };
    this.yaw = yaw || 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.yawRate = 0;
    this.steer = 0; this.steerTarget = 0;
    this.gear = 0; this.rpm = this.def.idle;
    this.shiftTimer = 0; this.lastShift = 0;
    this.airborne = false; this.airTime = 0;
    this.lastGroundH = 0;
    this.lastAx = 0; this.lastAy = 0;
    this.wheelSpin = 0; this.steerAngle = 0;
    this.boostState = 0;
    this.engineLoad = 0;
    this.odometer = 0;
    for(const t of this.tires){ t.alpha=0; t.temp=60; t.slip=0; }
  }

  // ---- производные от тюнинга ----
  get cgH(){ return 0.20 + this.tune.rideHeight/100; }
  get rollF(){ return this.tune.springF * 0.55; }
  get rollR(){ return this.tune.springR * 0.55; }
  get frontRollShare(){ return this.rollF/(this.rollF+this.rollR); }
  get transferScale(){ return 0.8 + (this.tune.springF + this.tune.springR)/240; }
  get downforceCoef(){ return this.tune.downforce/100 * 0.85; }
  get maxSteer(){ return this.tune.steerLock*Math.PI/180; }
  get toe(){ return this.tune.toeFront*Math.PI/180; }
  get rearGripMul(){ return 1 + 0.10*this.tune.diff/100; }
  get yawDamp(){ return this.tune.diff * 0.55; }
  get brakeMax(){ return this.def.brakeTorque/this.r; }

  torqueCurve(rpm){
    const d = this.def;
    const peak = d.torque;
    const x = rpm;
    // плавная кривая: рост до пика, спад к отсечке
    const t1 = d.torqueRpm, t2 = d.redline;
    let v;
    if(x <= t1) v = peak * (0.55 + 0.45*Math.min(1, x/t1));
    else v = peak * (1 - 0.35*(x-t1)/(t2-t1));
    return Math.max(0, v);
  }

  speed(){ return Math.hypot(this.vx, this.vz); }
  driftAngle(){ return Math.atan2(this.vz, Math.abs(this.vx)); }

  step(dt, input, world){
    let d = Math.min(dt, 1/25);
    const sub = Math.max(1, Math.ceil(d/(1/240)));
    const h = d/sub;
    for(let i=0;i<sub;i++) this.integrate(h, input, world);
    this.odometer += Math.abs(this.vx)*d;
  }

  integrate(h, input, world){
    const t = this.tune, d = this.def;
    const comp = COMPOUNDS[t.compound] || COMPOUNDS.street;
    const speed = this.speed();

    // ---------- рулевое управление ----------
    const speedFac = Math.max(0.30, 1/(1 + speed*0.022));
    this.steerTarget = input.steer * this.maxSteer * speedFac;
    const rate = 4.6;
    const ds = this.steerTarget - this.steer;
    this.steer += Math.max(-rate*h, Math.min(rate*h, ds));

    // ---------- трансмиссия ----------
    this.shiftTimer = Math.max(0, this.shiftTimer - h);
    const ratioAbs = this.gear < 0 ? 2.9*t.final : d.gears[this.gear]*t.final;
    const wheelRpm = Math.abs(this.vx)/this.r * ratioAbs * 60/TAU;
    this.rpm = Math.max(d.idle, wheelRpm);
    const limiter = this.rpm >= d.redline - 30;

    // наддув (для турбо-машин)
    if(d.boost){
      const b = Math.max(0, Math.min(1, (this.rpm - 2200)/(d.torqueRpm - 2200)));
      this.boostState += (b - this.boostState) * Math.min(1, h*(b>this.boostState?0.7:3.0));
    }

    let torque = 0;
    if(this.shiftTimer <= 0 && !limiter){
      torque = this.torqueCurve(this.rpm) * input.throttle * (d.boost ? (1+(d.boost-1)*this.boostState*0.85) : 1);
    }
    if(this.gear < 0) torque = -torque*0.55;
    this.engineLoad = input.throttle;

    let driveF = torque * ratioAbs * d.eff / this.r;
    if(this.shiftTimer > 0) driveF = 0;

    const split = d.split || (d.drive === 'awd' ? [0.30,0.30,0.70,0.70] : [0,0,1,1]);

    // ---------- тормоза ----------
    const brakeF = this.brakeMax * input.brake;
    const hbF = this.brakeMax * 0.30 * input.handbrake;
    const fb = brakeF * (t.brakeBias/100) / 2;
    const rb = brakeF * (1 - t.brakeBias/100) / 2;
    const sgnV = this.vx > 0.15 ? 1 : (this.vx < -0.15 ? -1 : 0);

    // ---------- нагрузки на колёса ----------
    const cgH = this.cgH;
    const Fz0 = this.mass*G/4;
    let FzF = this.mass*G*this.b/this.L;
    let FzR = this.mass*G*this.a/this.L;
    const longT = this.mass*this.lastAx*cgH/this.L*this.transferScale;
    FzF -= longT; FzR += longT;
    const latTotal = this.mass*this.lastAy*cgH/this.track;
    const frontLat = latTotal * this.frontRollShare;
    const rearLat = latTotal - frontLat;
    const df = this.downforceCoef*speed*speed;
    const FzW = [
      FzF/2 - frontLat/2 + df*0.4/2,
      FzF/2 + frontLat/2 + df*0.4/2,
      FzR/2 - rearLat/2 + df*0.6/2,
      FzR/2 + rearLat/2 + df*0.6/2,
    ];

    // ---------- силы на колёсах ----------
    let FxS = 0, FyS = 0, Mz = 0;
    const toe = this.toe;
    for(let i=0;i<4;i++){
      const isFront = i<2, isLeft = (i%2===0);
      const xw = isFront ? this.a : -this.b;
      const zw = isLeft ? this.track/2 : -this.track/2;
      // внимание: базис корпуса (вперёд, вверх, влево) — левый, поэтому кросс-произведение с обратным знаком
      const vxw = this.vx - this.yawRate*zw;
      const vzw = this.vz + this.yawRate*xw;

      // угол slips + рулевой угол (Аккерман + схождение)
      let steerW = 0;
      if(isFront && Math.abs(this.steer) > 1e-4){
        const R = this.L/Math.tan(Math.abs(this.steer));
        const denom = isLeft ? (R - this.track/2) : (R + this.track/2);
        steerW = Math.sign(this.steer) * Math.atan(this.L/Math.max(0.6, denom));
        steerW += isLeft ? toe : -toe;
      }
      let alpha = Math.atan2(vzw, Math.abs(vxw) + 0.7) - steerW;

      // релаксация шины (инертность боковой силы)
      const relax = comp.relax;
      const k = Math.min(1, h*Math.max(Math.abs(vxw), 3)/relax);
      const tr = this.tires[i];
      tr.alpha += (alpha - tr.alpha)*k;

      let Fz = Math.max(60, FzW[i]);
      tr.Fz = Fz;
      let mu = comp.mu * comp.gripMul * this.loadSens(Fz, Fz0) * this.tempGrip(tr.temp);
      if(!isFront && input.handbrake > 0.5) mu *= 0.40;          // ручник срывает заднюю ось
      if(!isFront) mu *= this.rearGripMul;                        // преднатяг дифференциала

      let Fy = -mu*Fz*magic(tr.alpha, comp.B, comp.C, comp.E);

      let Fx = 0;
      if(split[i] > 0) Fx += driveF*split[i];
      // тормоза
      if(isFront) Fx -= sgnV*fb; else Fx -= sgnV*rb;
      if(!isFront && input.handbrake > 0.5) Fx -= sgnV*hbF*0.5;
      // задний ход: не даём тормозам развернуть машину назад
      if(Math.abs(this.vx) < 0.4 && Math.abs(Fx) > 0 && sgnV === 0) Fx *= 0.2;

      // круг сцепления
      const Fmax = mu*Fz;
      const mag = Math.hypot(Fx, Fy);
      if(mag > Fmax && mag > 1e-5){
        const s = Fmax/mag;
        Fx *= s; Fy *= s;
        tr.slip = Math.min(1, (mag-Fmax)/mag);
      } else tr.slip = 0;
      tr.demand = mag;
      tr.Fx = Fx; tr.Fy = Fy;

      FxS += Fx; FyS += Fy;
      Mz += xw*Fy - zw*Fx;
      Mz += 0.09*Fy*tr.alpha;                       // самоцентрирующий момент шины

      // температура шины
      const diss = Math.abs(Fx*vxw + Fy*vzw);
      tr.temp += (diss*0.00055 - (tr.temp-24)*0.045)*h;
      tr.temp = Math.max(20, Math.min(160, tr.temp));
    }

    // ---------- аэродинамика и сопротивление ----------
    const v = Math.max(0.5, Math.hypot(this.vx, this.vz));
    const drag = 0.5*RHO*d.cdA*v*v;
    const dragX = -drag*this.vx/v;
    const dragZ = -drag*this.vz/v;
    const roll = -0.015*(FzF+FzR)*(this.vx>0?1:(this.vx<0?-1:0))*(input.throttle>0.05?0.5:1);

    const ax = (FxS + dragX + roll)/this.mass;
    const az = FyS/this.mass;
    this.lastAx += (ax - this.lastAx)*Math.min(1, h*8);
    this.lastAy += (az - this.lastAy)*Math.min(1, h*8);

    // ---------- интегрирование (кинематика твёрдого тела во вращающейся СКО) ----------
    // dVx/dt = Fx/m + w*Vz ;  dVz/dt = Fz/m - w*Vx   (члены Кориолиса)
    this.vx += (ax + this.yawRate*this.vz)*h;
    this.vz += (az - this.yawRate*this.vx)*h;
    this.yawRate += (Mz - this.yawDamp*this.yawRate)/this.Izz*h;
    this.yawRate = Math.max(-3.4, Math.min(3.4, this.yawRate));

    if(Math.abs(this.vx) < 0.5 && input.throttle < 0.02){
      this.vx *= Math.pow(0.004, h);
      this.vz *= Math.pow(0.02, h);
      this.yawRate *= Math.pow(0.02, h);
    }

    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const wx = sinY*this.vx + cosY*this.vz;
    const wz = cosY*this.vx - sinY*this.vz;
    this.pos.x += wx*h;
    this.pos.z += wz*h;
    this.yaw += this.yawRate*h;

    // ---------- вертикаль / трамплины ----------
    const gh = world ? world.groundHeight(this.pos.x, this.pos.z) : 0;
    if(!this.airborne){
      const slopeVy = (gh - this.lastGroundH)/h;
      if(this.pos.y - slopeVy*h > gh + 0.06){
        this.airborne = true;
        this.vy = Math.max(0, slopeVy);
        this.airTime = 0;
      } else {
        this.pos.y = gh;
        this.vy = slopeVy;
      }
    }
    if(this.airborne){
      this.vy -= G*h;
      this.pos.y += this.vy*h;
      this.airTime += h;
      if(this.pos.y <= gh){
        const impact = -this.vy;
        this.pos.y = gh; this.vy = 0; this.airborne = false;
        if(impact > 4){ this.vx *= 0.985; this.onLand && this.onLand(impact); }
      }
    }
    this.lastGroundH = gh;

    // ---------- визуал колёс ----------
    const drivenOmega = Math.max(Math.abs(this.vx)/this.r, this.rpm*TAU/60/Math.max(1, ratioAbs));
    this.wheelSpin += (this.rpm > d.idle+50 ? drivenOmega : Math.abs(this.vx)/this.r)*h;
    this.steerAngle = this.steer;
  }

  loadSens(Fz, Fz0){
    return Math.max(0.62, Math.min(1.2, 1 - 0.10*(Fz/Fz0 - 1)));
  }
  tempGrip(temp){
    return Math.max(0.93, Math.min(1.05, 1 - 0.000012*(temp-95)*(temp-95)));
  }
}

// ---------- столкновения ----------
export function collideVehicle(v, colliders, onImpact){
  const sinY = Math.sin(v.yaw), cosY = Math.cos(v.yaw);
  const pts = [
    { x: v.pos.x + sinY*v.L*0.31, z: v.pos.z + cosY*v.L*0.31, r: 0.60 },
    { x: v.pos.x,                    z: v.pos.z,                    r: 0.70 },
    { x: v.pos.x - sinY*v.L*0.31, z: v.pos.z - cosY*v.L*0.31, r: 0.60 },
  ];
  let impact = 0;
  for(const c of colliders){
    const cRot = c.rot||0, cc = Math.cos(cRot), cs = Math.sin(cRot);
    for(const p of pts){
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = dx*cc + dz*cs;
      const lz = -dx*cs + dz*cc;
      const hw = c.hw, hd = c.hd;
      const cx = Math.max(-hw, Math.min(hw, lx));
      const cz = Math.max(-hd, Math.min(hd, lz));
      let nx = lx-cx, nz = lz-cz;
      let dist = Math.hypot(nx, nz);
      if(dist < 1e-6){
        // центр внутри — выталкиваем по минимальной оси
        const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
        if(px < pz){ nx = Math.sign(lx)||1; nz = 0; dist = -px; } else { nx = 0; nz = Math.sign(lz)||1; dist = -pz; }
      }
      if(dist >= p.r) continue;
      const depth = p.r - dist;
      const nLx = nx/(dist||1), nLz = nz/(dist||1);
      // в мир
      const nwx = nLx*cc - nLz*cs;
      const nwz = nLx*cs + nLz*cc;
      // выталкивание
      v.pos.x += nwx*depth*0.9;
      v.pos.z += nwz*depth*0.9;
      // скорость в мире
      let WX = sinY*v.vx + cosY*v.vz;
      let WZ = cosY*v.vx - sinY*v.vz;
      const vn = WX*nwx + WZ*nwz;
      if(vn < 0){
        const e = c.type === 'tire' ? 0.06 : (c.type === 'cone' ? 0.42 : 0.26);
        const j = -(1+e)*vn;
        WX += nwx*j; WZ += nwz*j;
        // трение вдоль касательной
        const tx = -nwz, tz = nwx;
        const vt = WX*tx + WZ*tz;
        const fr = c.type === 'tire' ? 0.72 : 0.86;
        WX -= tx*vt*(1-fr); WZ -= tz*vt*(1-fr);
        // момент: точка удара относительно ЦТ
        const rx = (p.x - v.pos.x)*sinY + (p.z - v.pos.z)*cosY;
        const rz = (p.x - v.pos.x)*cosY - (p.z - v.pos.z)*sinY;
        const Jbx = j*(nwx*cosY + nwz*sinY);
        const Jbz = j*(-nwx*sinY + nwz*cosY);
        v.yawRate += (rx*Jbz - rz*Jbx)/v.Izz*0.9;
        v.yawRate = Math.max(-3.4, Math.min(3.4, v.yawRate));
        impact = Math.max(impact, -vn);
        if(onImpact) onImpact(c, -vn, p.x, p.z);
      }
      v.vx = sinY*WX + cosY*WZ;
      v.vz = cosY*WX - sinY*WZ;
    }
  }
  return impact;
}

// ---------- простая физика выбитых конусов ----------
export class Cone {
  constructor(x, z, mesh){
    this.x = x; this.z = z; this.y = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.rot = Math.random()*TAU; this.vr = 0;
    this.mesh = mesh;
    this.active = true;
  }
  hit(dirx, dirz, power){
    this.vx += dirx*power; this.vz += dirz*power;
    this.vy = 2.2 + Math.random()*1.6;
    this.vr = (Math.random()-0.5)*10;
  }
  step(h){
    if(this.y === 0 && this.vx === 0 && this.vz === 0) return;
    this.x += this.vx*h; this.z += this.vz*h;
    if(this.y > 0 || this.vy !== 0){
      this.vy -= 9.81*h; this.y += this.vy*h;
      if(this.y < 0){ this.y = 0; this.vy *= -0.35; this.vx *= 0.6; this.vz *= 0.6; this.vr *= 0.5;
        if(Math.abs(this.vy) < 0.6){ this.vy = 0; this.vx *= 0.4; this.vz *= 0.4; this.vr *= 0.2; } }
    }
    this.vx *= Math.pow(0.25, h); this.vz *= Math.pow(0.25, h);
    this.vr *= Math.pow(0.1, h);
    this.rot += this.vr*h;
    if(Math.abs(this.vx)+Math.abs(this.vz) < 0.05 && this.y === 0){ this.vx = 0; this.vz = 0; this.vr = 0; }
    if(this.mesh){
      this.mesh.position.set(this.x, this.y, this.z);
      this.mesh.rotation.z = Math.sin(this.rot)*0.9;
      this.mesh.rotation.y = this.rot;
    }
  }
}
