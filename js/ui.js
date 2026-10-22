// ============ Интерфейс: меню, гараж, настройки, HUD ============
import { CARS, TUNE_DEFS, COMPOUNDS, DEFAULT_SETTINGS, GFX_PRESETS, KEY_HELP, loadSave, writeSave, defaultTune, defaultStyle } from './config.js';

const $ = (id)=>document.getElementById(id);

export class UI {
  constructor(game){
    this.game = game;
    this.save = loadSave();
    if(!this.save.styles) this.save.styles = {};
    if(!this.save.tunes) this.save.tunes = {};
    if(!this.save.settings) this.save.settings = {};
    if(!this.save.records) this.save.records = {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, this.save.settings);
    this.save.settings = this.settings;
    this.carId = this.save.car || CARS[0].id;
    this.style = Object.assign(defaultStyle(), this.save.styles[this.carId]);
    this.tune = Object.assign(defaultTune(this.car()), this.save.tunes[this.carId]);
    this.save.styles[this.carId] = this.style;
    this.save.tunes[this.carId] = this.tune;

    this.driftScore = 0;
    this.driftChain = 0;
    this.driftBest = 0;
    this.popupTimer = 0;
    this.msgTimer = 0;
    this.speedo = $('speedo').getContext('2d');
    this.bind();
    this.buildSettings();
    this.buildCarMenu();
    this.buildGarage();
    this.buildQuickTune();
  }

  car(){ return CARS.find(c=>c.id===this.carId); }
  persist(){
    this.save.car = this.carId;
    this.save.styles[this.carId] = this.style;
    this.save.tunes[this.carId] = this.tune;
    this.save.settings = this.settings;
    writeSave(this.save);
  }

  // ---------- навигация ----------
  show(id){ $(id).classList.remove('hidden'); }
  hide(id){ $(id).classList.add('hidden'); }
  hideAll(){ ['menu','modes','garage','settings','controls','quicktune','pause','results','hud'].forEach(i=>this.hide(i)); }

  bind(){
    $('btn-play').onclick = ()=>{ this.hide('menu'); this.show('modes'); };
    $('btn-garage').onclick = ()=>{ this.game.openGarage(); };
    $('btn-settings').onclick = ()=>{ this.show('settings'); this.hide('menu'); };
    $('btn-controls').onclick = ()=>{ this.show('controls'); this.hide('menu'); };
    $('btn-controls-close').onclick = ()=>{ this.hide('controls'); this.show('menu'); };
    $('btn-settings-close').onclick = ()=>{ this.hide('settings'); this.game.settingsClosed(); };
    $('btn-modes-back').onclick = ()=>{ this.hide('modes'); this.show('menu'); };
    $('btn-garage-exit').onclick = ()=>{ this.game.closeGarage(); };
    $('btn-resume').onclick = ()=>{ this.game.resume(); };
    $('btn-pause-settings').onclick = ()=>{ this.show('settings'); };
    $('btn-pause-garage').onclick = ()=>{ this.game.openGarage(true); };
    $('btn-pause-menu').onclick = ()=>{ this.game.toMenu(); };
    $('btn-results-again').onclick = ()=>{ this.game.restart(); };
    $('btn-results-menu').onclick = ()=>{ this.game.toMenu(); };
    $('btn-quicktune-close').onclick = ()=>{ this.hide('quicktune'); this.game.resume(); };
    $('btn-tune-preset-drift').onclick = ()=>this.applyPreset('drift');
    $('btn-tune-preset-grip').onclick = ()=>this.applyPreset('grip');
    $('btn-tune-reset').onclick = ()=>this.applyPreset('stock');

    // установка как приложение (PWA, Chrome/Edge)
    let installEvent = null;
    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault();
      installEvent = e;
      $('btn-install').classList.remove('hidden');
    });
    $('btn-install').onclick = async ()=>{
      if(!installEvent) return;
      installEvent.prompt();
      try{ await installEvent.userChoice; }catch(err){}
      installEvent = null;
      $('btn-install').classList.add('hidden');
    };
    window.addEventListener('appinstalled', ()=>$('btn-install').classList.add('hidden'));

    document.querySelectorAll('.tab').forEach(tab=>{
      tab.onclick = ()=>{
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-page').forEach(p=>p.classList.toggle('hidden', p.dataset.page !== tab.dataset.tab));
      };
    });

    document.querySelectorAll('.mode-card').forEach(card=>{
      card.onclick = ()=>{
        this.game.startMode(card.dataset.mode);
      };
    });

    // окраска
    const bindColor = (id, key)=>{
      $(id).addEventListener('input', ()=>{ this.style[key] = $(id).value; this.styleChanged(); });
    };
    bindColor('paint-color','paint'); bindColor('rim-color','rim'); bindColor('caliper-color','caliper');
    $('rim-style').addEventListener('change', ()=>{ this.style.rimStyle = $('rim-style').value; this.styleChanged(true); });
    $('tint').addEventListener('change', ()=>{ this.style.tint = parseFloat($('tint').value); this.styleChanged(); });
    $('paint-metal').addEventListener('input', ()=>{ this.style.metal = parseFloat($('paint-metal').value); this.styleChanged(); });
    $('paint-clear').addEventListener('input', ()=>{ this.style.clear = parseFloat($('paint-clear').value); this.styleChanged(); });
  }

  styleChanged(rebuild){
    this.persist();
    this.game.styleChanged(rebuild);
  }

  applyPreset(name){
    const preset = PRESETS_TUNE[name];
    Object.assign(this.tune, preset);
    this.tune.final = this.car().final;
    this.persist();
    this.buildTune($('tune-grid'));
    this.buildQuickTune();
    this.game.tuneChanged();
  }

  // ---------- выбор режима ----------
  buildCarMenu(){
    const sel = $('car-select-menu');
    sel.innerHTML = CARS.map(c=>`<option value="${c.id}" ${c.id===this.carId?'selected':''}>${c.name} · ${c.tag}</option>`).join('');
    sel.onchange = ()=>{ this.setCar(sel.value); };
  }

  setCar(id){
    this.carId = id;
    this.style = Object.assign(defaultStyle(), this.save.styles[id]);
    this.tune = Object.assign(defaultTune(this.car()), this.save.tunes[id]);
    this.persist();
    this.buildGarage();
    this.buildQuickTune();
    this.buildCarMenu();
    this.game.carChanged();
  }

  // ---------- гараж ----------
  buildGarage(){
    const grid = $('car-grid');
    grid.innerHTML = '';
    for(const c of CARS){
      const div = document.createElement('div');
      div.className = 'car-card' + (c.id===this.carId ? ' active' : '');
      div.innerHTML = `<span class="cc-tag">${c.tag}</span><b>${c.name}</b><div class="cc-desc">${c.desc}</div>`;
      div.onclick = ()=>this.setCar(c.id);
      grid.appendChild(div);
    }
    // характеристики
    const c = this.car();
    const specs = [
      ['Мощность', c.power + ' л.с.'],
      ['Момент', c.torque + ' Нм'],
      ['Масса', c.mass + ' кг'],
      ['Привод', c.drive.toUpperCase()],
      ['Отсечка', (c.redline/1000).toFixed(1) + ' об/мин'],
      ['Разгон 0-100', this.accelEstimate(c) + ' с'],
    ];
    $('car-specs').innerHTML = specs.map(s=>`<div class="spec"><div class="k">${s[0]}</div><div class="v">${s[1]}</div></div>`).join('');

    // значения покраски
    $('paint-color').value = this.style.paint;
    $('rim-color').value = this.style.rim;
    $('caliper-color').value = this.style.caliper;
    $('rim-style').value = this.style.rimStyle;
    $('tint').value = String(this.style.tint);
    $('paint-metal').value = String(this.style.metal);
    $('paint-clear').value = String(this.style.clear);

    this.buildTune($('tune-grid'));
  }

  accelEstimate(c){
    // грубая оценка
    const hp = c.power, kg = c.mass;
    return (Math.pow(kg/(hp*0.16), 0.62)).toFixed(1);
  }

  buildTune(container){
    if(!container) return;
    container.innerHTML = '';
    for(const d of TUNE_DEFS){
      const wrap = document.createElement('div');
      wrap.className = 'ctrl';
      if(d.type === 'select'){
        wrap.innerHTML = `<label>${d.label}</label>`;
        const sel = document.createElement('select');
        sel.className = 'select';
        sel.innerHTML = d.options.map(o=>`<option value="${o.value}" ${o.value===this.tune[d.key]?'selected':''}>${o.label}</option>`).join('');
        sel.onchange = ()=>{ this.tune[d.key] = sel.value; this.persist(); this.game.tuneChanged(); };
        wrap.appendChild(sel);
      } else {
        const val = this.tune[d.key];
        const show = d.step < 1 ? Number(val).toFixed(2) : Number(val).toFixed(0);
        wrap.innerHTML = `<label>${d.label}<output>${show}${d.unit||''}</output></label>`;
        const inp = document.createElement('input');
        inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = val;
        const out = wrap.querySelector('output');
        inp.addEventListener('input', ()=>{
          this.tune[d.key] = parseFloat(inp.value);
          out.textContent = (d.step < 1 ? Number(inp.value).toFixed(2) : Number(inp.value).toFixed(0)) + (d.unit||'');
          this.persist();
          this.game.tuneChanged();
        });
        wrap.appendChild(inp);
      }
      container.appendChild(wrap);
    }
  }

  buildQuickTune(){
    this.buildTune($('quick-tune-grid'));
  }

  // ---------- настройки ----------
  buildSettings(){
    const gfx = [
      { key:'quality', label:'Качество', type:'select', options:[['low','Низкое'],['medium','Среднее'],['high','Высокое'],['ultra','Ультра']] },
      { key:'res', label:'Масштаб разрешения', min:0.5, max:1.3, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'shadows', label:'Тени', type:'select', options:[['0','Выкл'],['1','Низкие'],['2','Средние'],['3','Высокие']] },
      { key:'bloom', label:'Свечение (bloom)', type:'check' },
      { key:'bloomStrength', label:'Сила свечения', min:0, max:1.5, step:0.05, fmt:v=>v.toFixed(2) },
      { key:'motionBlur', label:'Размытие в движении', type:'check' },
      { key:'motionDamp', label:'Сила размытия', min:0.5, max:0.95, step:0.01, fmt:v=>v.toFixed(2) },
      { key:'fxaa', label:'Сглаживание FXAA', type:'check' },
      { key:'smoke', label:'Плотность дыма', min:0, max:1.5, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'skid', label:'Следы шин', type:'check' },
      { key:'drawDist', label:'Дальность прорисовки', min:200, max:1200, step:20, fmt:v=>v+' м' },
      { key:'timeOfDay', label:'Время суток', type:'select', options:[['day','День'],['sunset','Закат'],['night','Ночь']] },
    ];
    const audio = [
      { key:'masterVol', label:'Общая громкость', min:0, max:1, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'engineVol', label:'Двигатель', min:0, max:1, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'tireVol', label:'Шины', min:0, max:1, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'windVol', label:'Ветер', min:0, max:1, step:0.05, fmt:v=>Math.round(v*100)+'%' },
      { key:'showFps', label:'Показывать FPS', type:'check' },
    ];
    const cam = [
      { key:'fov', label:'Угол обзора (FOV)', min:45, max:95, step:1, fmt:v=>v+'°' },
      { key:'camDist', label:'Дистанция камеры', min:3.5, max:11, step:0.1, fmt:v=>v.toFixed(1)+' м' },
      { key:'camHeight', label:'Высота камеры', min:0.8, max:5, step:0.1, fmt:v=>v.toFixed(1)+' м' },
      { key:'speedFov', label:'Эффект скорости (FOV)', type:'check' },
    ];
    const mk = (list, container)=>{
      const c = $(container);
      c.innerHTML = '';
      for(const d of list){
        const wrap = document.createElement('div');
        wrap.className = 'ctrl';
        if(d.type === 'select'){
          wrap.innerHTML = `<label>${d.label}</label>`;
          const sel = document.createElement('select'); sel.className = 'select';
          sel.innerHTML = d.options.map(o=>`<option value="${o[0]}" ${String(this.settings[d.key])===o[0]?'selected':''}>${o[1]}</option>`).join('');
          sel.onchange = ()=>{ this.settings[d.key] = sel.value; this.onSettings(); };
          wrap.appendChild(sel);
        } else if(d.type === 'check'){
          wrap.innerHTML = `<label>${d.label}</label>`;
          const cb = document.createElement('input'); cb.type = 'checkbox';
          cb.checked = !!this.settings[d.key];
          cb.style.width = '18px'; cb.style.height = '18px'; cb.style.accentColor = '#ff2d55';
          cb.onchange = ()=>{ this.settings[d.key] = cb.checked; this.onSettings(); };
          wrap.appendChild(cb);
        } else {
          wrap.innerHTML = `<label>${d.label}<output>${d.fmt(this.settings[d.key])}</output></label>`;
          const inp = document.createElement('input');
          inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = this.settings[d.key];
          const out = wrap.querySelector('output');
          inp.oninput = ()=>{ this.settings[d.key] = parseFloat(inp.value); out.textContent = d.fmt(parseFloat(inp.value)); this.onSettings(); };
          wrap.appendChild(inp);
        }
        c.appendChild(wrap);
      }
    };
    mk(gfx, 'gfx-controls'); mk(audio, 'audio-controls'); mk(cam, 'cam-controls');
  }

  onSettings(){
    // пресет качества переопределяет часть параметров
    let changed = false;
    if(GFX_PRESETS[this.settings.quality]){
      const p = GFX_PRESETS[this.settings.quality];
      for(const k of ['res','shadows','bloom','motionBlur','fxaa','smoke','skid','drawDist']){
        if(this.settings[k] !== p[k]){ this.settings[k] = p[k]; changed = true; }
      }
    }
    this.persist();
    this.game.applySettings();
    // перестраиваем панель только если пресет изменил значения (иначе рвётся перетаскивание)
    if(changed) this.buildSettings();
  }

  // ---------- HUD ----------
  setMode(name, sub, mode){
    $('mode-name').textContent = name;
    $('mode-sub').textContent = sub || '';
    $('score-box').style.display = mode === 'time' ? 'none' : '';
    $('timer').parentElement.style.display = (mode === 'time' || mode === 'drift') ? '' : 'none';
  }

  popup(text, sub){
    const el = $('drift-popup');
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    el.classList.add('show');
    this.popupTimer = 1.1;
  }

  centerMsg(text, time){
    const el = $('center-msg');
    el.textContent = text;
    el.classList.add('show');
    this.msgTimer = time || 1.6;
  }

  setScore(total, best){
    $('score-total').textContent = Math.round(total).toLocaleString('ru-RU');
    $('score-best').textContent = 'рекорд: ' + Math.round(best).toLocaleString('ru-RU');
  }

  setTimer(text, lap){
    $('timer').textContent = text;
    $('lap').textContent = lap || '';
  }

  results(title, html){
    $('results-title').textContent = title;
    $('results-body').innerHTML = html;
    this.show('results');
  }

  update(dt, s){
    // попапы
    if(this.popupTimer > 0){ this.popupTimer -= dt; if(this.popupTimer <= 0) $('drift-popup').classList.remove('show'); }
    if(this.msgTimer > 0){ this.msgTimer -= dt; if(this.msgTimer <= 0) $('center-msg').classList.remove('show'); }

    // спидометр
    this.drawSpeedo(s);
    $('gear').textContent = s.gear;
    const rp = Math.max(0, Math.min(1, s.rpm/s.redline));
    $('rpm-fill').style.width = (rp*100).toFixed(1) + '%';
    $('rpm-redline').style.left = (85) + '%';
    $('drift-fill').style.width = Math.round(Math.min(1, s.drift/1.0)*100) + '%';
    $('car-name-tag').textContent = this.car().name;
    $('fps').style.display = this.settings.showFps ? '' : 'none';
    $('fps').textContent = s.fps.toFixed(0) + ' FPS · ' + (this.settings.units==='kmh' ? Math.round(s.kmh) + ' км/ч' : Math.round(s.mph) + ' mph');
    $('checkpoint-arrow').style.opacity = s.nextCp ? '0.9' : '0';
  }

  drawSpeedo(s){
    const ctx = this.speedo;
    const W = 260, H = 260, cx = W/2, cy = H/2, R = 108;
    ctx.clearRect(0,0,W,H);
    const maxKmh = 320;
    const a0 = Math.PI*0.75, a1 = Math.PI*2.25;
    // фон
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(8,11,16,0.72)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
    // шкала
    for(let v=0; v<=maxKmh; v+=20){
      const a = a0 + (a1-a0)*(v/maxKmh);
      const big = v%40 === 0;
      ctx.beginPath();
      ctx.strokeStyle = v > 260 ? 'rgba(255,45,85,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = big ? 2.5 : 1.2;
      ctx.moveTo(cx + Math.cos(a)*(R-4), cy + Math.sin(a)*(R-4));
      ctx.lineTo(cx + Math.cos(a)*(R-(big?18:11)), cy + Math.sin(a)*(R-(big?18:11)));
      ctx.stroke();
      if(big){
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '600 13px Segoe UI, Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(v), cx + Math.cos(a)*(R-32), cy + Math.sin(a)*(R-32));
      }
    }
    // дуга тахометра
    const rpm = Math.min(1, s.rpm/s.redline);
    ctx.beginPath();
    ctx.arc(cx, cy, R-42, a0, a0 + (a1-a0)*rpm);
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.strokeStyle = rpm > 0.92 ? '#ff2d55' : (rpm > 0.75 ? '#ffd400' : '#00e5ff');
    ctx.stroke();
    // стрелка
    const val = Math.min(maxKmh, s.kmh);
    const a = a0 + (a1-a0)*(val/maxKmh);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-14, -4); ctx.lineTo(R-26, -1.6); ctx.lineTo(R-26, 1.6); ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fillStyle = '#ff2d55'; ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2);
    ctx.fillStyle = '#1b1f27'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    // цифры
    ctx.fillStyle = '#fff';
    ctx.font = '800 34px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(s.kmh)), cx, cy + 52);
    ctx.font = '600 12px Segoe UI, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('км/ч', cx, cy + 70);
  }
}

const PRESETS_TUNE = {
  drift: { compound:'drift', springF:48, springR:64, rideHeight:14, brakeBias:66, diff:60, downforce:45, steerLock:48, toeFront:0.4 },
  grip:  { compound:'semi',  springF:82, springR:88, rideHeight:10, brakeBias:62, diff:28, downforce:70, steerLock:40, toeFront:0.1 },
  stock: { compound:'street',springF:55, springR:62, rideHeight:14, brakeBias:64, diff:45, downforce:35, steerLock:42, toeFront:0.2 },
};
