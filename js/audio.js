// ============ Звук: синтез двигателя, шин, ветра ============
export class GameAudio {
  constructor(){
    this.ready = false;
    this.muted = false;
    this.volumes = { master:0.8, engine:0.8, tire:0.7, wind:0.5 };
  }

  init(){
    if(this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(ctx.destination);

    // ---- двигатель: 3 пилы + шум впуска ----
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engFilter.Q.value = 1.2;
    this.engGain.connect(this.engFilter);
    this.engFilter.connect(this.master);

    this.oscs = [];
    const gains = [0.5, 0.28, 0.16];
    const mults = [1, 2, 0.5];
    for(let i=0;i<3;i++){
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'square' : 'sawtooth';
      const g = ctx.createGain();
      g.gain.value = gains[i];
      o.frequency.value = 60;
      o.connect(g); g.connect(this.engGain);
      o.start();
      this.oscs.push({ o, g, m: mults[i] });
    }

    // шум впуска
    this.noiseBuf = this.makeNoise(2);
    const intake = ctx.createBufferSource();
    intake.buffer = this.noiseBuf; intake.loop = true;
    this.intakeGain = ctx.createGain(); this.intakeGain.gain.value = 0;
    const intakeF = ctx.createBiquadFilter();
    intakeF.type = 'bandpass'; intakeF.frequency.value = 420; intakeF.Q.value = 0.8;
    intake.connect(intakeF); intakeF.connect(this.intakeGain); this.intakeGain.connect(this.master);
    intake.start();

    // ---- визг шин ----
    const tire = ctx.createBufferSource();
    tire.buffer = this.noiseBuf; tire.loop = true;
    this.tireF = ctx.createBiquadFilter();
    this.tireF.type = 'bandpass'; this.tireF.frequency.value = 1600; this.tireF.Q.value = 5;
    this.tireGain = ctx.createGain(); this.tireGain.gain.value = 0;
    tire.connect(this.tireF); this.tireF.connect(this.tireGain); this.tireGain.connect(this.master);
    tire.start();

    // ---- ветер ----
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf; wind.loop = true;
    this.windF = ctx.createBiquadFilter();
    this.windF.type = 'lowpass'; this.windF.frequency.value = 500;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windF); this.windF.connect(this.windGain); this.windGain.connect(this.master);
    wind.start();

    this.ready = true;
  }

  makeNoise(sec){
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate*sec, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    return buf;
  }

  resume(){
    this.init();
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(v){
    this.volumes = v;
    if(this.master) this.master.gain.value = this.muted ? 0 : v.master;
  }
  setMuted(m){
    this.muted = m;
    if(this.master) this.master.gain.value = m ? 0 : this.volumes.master;
  }

  update(dt, state){
    if(!this.ready) return;
    const t = this.ctx.currentTime;
    const { rpm, throttle, speed, slip, airborne, limiter } = state;
    const rpmN = Math.max(0, Math.min(1, rpm/8000));
    const base = Math.max(20, rpm/60*2);
    for(const o of this.oscs){
      o.o.frequency.setTargetAtTime(base*o.m, t, 0.03);
    }
    const load = 0.35 + throttle*0.65;
    const engVol = (0.10 + rpmN*0.32) * load * this.volumes.engine;
    this.engGain.gain.setTargetAtTime(this.muted ? 0 : engVol, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(500 + rpmN*3200 + throttle*900, t, 0.05);
    this.intakeGain.gain.setTargetAtTime((this.muted?0:throttle*0.10*this.volumes.engine*(rpmN*0.7+0.3)), t, 0.06);

    // шины
    const squeal = Math.min(1, slip);
    this.tireGain.gain.setTargetAtTime(this.muted ? 0 : squeal*squeal*0.30*this.volumes.tire, t, 0.04);
    this.tireF.frequency.setTargetAtTime(1100 + squeal*1500, t, 0.06);

    // ветер
    const w = Math.min(1, speed/70);
    this.windGain.gain.setTargetAtTime(this.muted ? 0 : w*w*0.16*this.volumes.wind, t, 0.1);
    this.windF.frequency.setTargetAtTime(300 + w*900, t, 0.1);

    if(airborne > 0.4) this.windGain.gain.setTargetAtTime((this.muted?0:0.10*this.volumes.wind), t, 0.05);
  }

  impact(power){
    if(!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const p = Math.min(1, power/14);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 300 + p*1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(p*0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + p*0.2);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.5);
    // удар
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90 + p*60, t);
    o.frequency.exponentialRampToValueAtTime(35, t+0.2);
    const og = ctx.createGain();
    og.gain.setValueAtTime(p*0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t+0.25);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t+0.3);
  }

  blip(up){
    if(!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    const f0 = up ? 700 : 400;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(up ? 1800 : 220, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  }

  backfire(){
    if(!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 260; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }
}
