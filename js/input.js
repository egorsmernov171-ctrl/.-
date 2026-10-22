// ============ Ввод: клавиатура, тач, геймпад ============
export class Input {
  constructor(){
    this.keys = Object.create(null);
    this.touch = { left:false, right:false, gas:false, brake:false, hb:false };
    this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrake = 0;
    this.steerTarget = 0;
    this.shiftUp = false; this.shiftDown = false;
    this.autoTrans = true;
    this.onAction = null;      // (name) => {}
    this.enabled = true;
    this.gamepadIndex = null;

    const GAME_KEYS = ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift','control','z','r','c','tab','m','escape'];
    window.addEventListener('keydown', (e)=>{
      const k = e.key.toLowerCase();
      if(GAME_KEYS.includes(k)) e.preventDefault();
      if(this.keys[k]) return;
      this.keys[k] = true;
      if(this.onAction) this.onAction(k);
    });
    window.addEventListener('keyup', (e)=>{ this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', ()=>{ this.keys = Object.create(null); });

    window.addEventListener('gamepadconnected', (e)=>{ this.gamepadIndex = e.gamepad.index; });

    // тач
    document.querySelectorAll('#touch .tbtn').forEach(btn=>{
      const key = btn.dataset.key;
      const on = (e)=>{ e.preventDefault(); this.touch[key] = true; btn.style.background='rgba(255,45,85,.5)'; };
      const off = (e)=>{ e.preventDefault(); this.touch[key] = false; btn.style.background=''; };
      btn.addEventListener('touchstart', on, {passive:false});
      btn.addEventListener('touchend', off, {passive:false});
      btn.addEventListener('touchcancel', off, {passive:false});
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    });
  }

  get keyLeft(){ return this.keys['a'] || this.keys['arrowleft'] || this.touch.left; }
  get keyRight(){ return this.keys['d'] || this.keys['arrowright'] || this.touch.right; }
  get keyGas(){ return this.keys['w'] || this.keys['arrowup'] || this.touch.gas; }
  get keyBrake(){ return this.keys['s'] || this.keys['arrowdown'] || this.touch.brake; }
  get keyHB(){ return this.keys[' '] || this.touch.hb; }

  update(dt){
    if(!this.enabled){
      this.throttle += (0-this.throttle)*Math.min(1, dt*8);
      this.brake += (0-this.brake)*Math.min(1, dt*8);
      this.steer += (0-this.steer)*Math.min(1, dt*8);
      this.handbrake += (0-this.handbrake)*Math.min(1, dt*8);
      return this;
    }
    // руль
    let st = 0;
    if(this.keyLeft) st -= 1;
    if(this.keyRight) st += 1;
    this.steerTarget = st;

    // геймпад
    let gpThrottle = 0, gpBrake = 0, gpSteer = 0, gpHB = false, gpShiftUp = false, gpShiftDown = false;
    if(this.gamepadIndex !== null && navigator.getGamepads){
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if(gp){
        gpSteer = gp.axes[0] || 0;
        gpThrottle = gp.buttons[7] ? gp.buttons[7].value : 0;
        gpBrake = gp.buttons[6] ? gp.buttons[6].value : 0;
        gpHB = gp.buttons[0] && gp.buttons[0].pressed;
        gpShiftUp = gp.buttons[5] && gp.buttons[5].pressed;
        gpShiftDown = gp.buttons[4] && gp.buttons[4].pressed;
        if(Math.abs(gpSteer) < 0.08) gpSteer = 0;
      }
    }

    // сглаживание руля (быстрый возврат в центр)
    const rate = (Math.abs(this.steerTarget) > 0.01 && Math.sign(this.steerTarget) !== Math.sign(this.steer)) ? 9.0 : 4.2;
    this.steer += (this.steerTarget - this.steer) * Math.min(1, dt*rate);
    if(Math.abs(gpSteer) > 0.01) this.steer = gpSteer;

    const th = this.keyGas ? 1 : gpThrottle;
    const br = this.keyBrake ? 1 : gpBrake;
    this.throttle += (th - this.throttle) * Math.min(1, dt*(th > this.throttle ? 7 : 12));
    this.brake += (br - this.brake) * Math.min(1, dt*(br > this.brake ? 12 : 16));
    const hb = (this.keyHB || gpHB) ? 1 : 0;
    this.handbrake += (hb - this.handbrake) * Math.min(1, dt*18);

    this.shiftUp = this.keys['shift'] || gpShiftUp;
    this.shiftDown = this.keys['control'] || this.keys['z'] || gpShiftDown;
    this.autoTrans = !this.keys['shift'] && !this.keys['control'] && !this.keys['z'] ? true : false;
    return this;
  }

  input(){
    return {
      throttle: this.throttle, brake: this.brake, handbrake: this.handbrake,
      steer: this.steer, shiftUp: this.shiftUp, shiftDown: this.shiftDown, auto: this.autoTrans,
    };
  }
}
