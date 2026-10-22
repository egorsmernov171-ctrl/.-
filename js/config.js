// ============ DRIFT ARENA: конфигурация машин, тюнинга и настроек ============

export const COMPOUNDS = {
  street:  { id:'street',  name:'Улица',     mu:1.02, B:13.5, C:1.55, E:0.90, relax:0.55, gripMul:1.00, drift:0.6 },
  semi:    { id:'semi',    name:'Полуслик',  mu:0.95, B:12.2, C:1.45, E:0.87, relax:0.50, gripMul:0.98, drift:0.8 },
  drift:   { id:'drift',   name:'Дрифт',     mu:0.78, B:10.0, C:1.30, E:0.80, relax:0.42, gripMul:0.92, drift:1.0 },
  slick:   { id:'slick',   name:'Слик',      mu:1.20, B:15.0, C:1.65, E:0.95, relax:0.60, gripMul:1.04, drift:0.35 },
};

// spec: масса, мощность, момент, отсечка, привод, колёсная база, распределение массы (спереди %),
// колея, радиус колеса, Cd*A, передачи, главная пара
export const CARS = [
  {
    id:'kouki', name:'KOUKI GT-S', tag:'JDM · RWD', desc:'Лёгкий, отзывчивый, культовая «сильвия». Идеальна для обучения дрифту.',
    mass:1240, power:250, powerRpm:6400, torque:344, torqueRpm:4800, redline:7500, idle:850,
    drive:'rwd', wb:2.53, frontDist:0.57, track:1.47, wheelR:0.312, cdA:0.80,
    gears:[3.59,2.06,1.40,1.00,0.76,0.64], final:3.69, eff:0.92,
    maxSteer:34, brakeTorque:3900, body:{ len:4.52, wid:1.72, hood:0.94, belt:1.00, roof:1.35,
      cabinRear:-0.72, cabinFront:0.62, cabinRoofRear:-0.28, cabinRoofFront:0.42,
      archR:0.36, spoiler:'duckbill', nose:'round', lights:'pop', exhaust:'dual', cage:false },
    gripBase:1.0,
  },
  {
    id:'hachi', name:'HACHI-ROKU', tag:'JDM · RWD', desc:'Сверхлёгкий 940 кг и слабый мотор. Дрифтит на одном драйве.',
    mass:940, power:130, powerRpm:6600, torque:186, torqueRpm:4800, redline:7600, idle:900,
    drive:'rwd', wb:2.40, frontDist:0.56, track:1.42, wheelR:0.295, cdA:0.76,
    gears:[3.59,2.06,1.40,1.00,0.86], final:4.31, eff:0.92,
    maxSteer:36, brakeTorque:3100, body:{ len:4.20, wid:1.63, hood:0.88, belt:0.94, roof:1.29,
      cabinRear:-0.62, cabinFront:0.30, cabinRoofRear:-0.30, cabinRoofFront:0.06,
      archR:0.33, spoiler:'none', nose:'square', lights:'pop', exhaust:'single', cage:false },
    gripBase:1.0,
  },
  {
    id:'supra', name:'MK4 RZ', tag:'JDM · RWD · TURBO', desc:'470 Нм момента и huge турбо-отклик. Мощная машина для больших углов.',
    mass:1510, power:320, powerRpm:5600, torque:550, torqueRpm:3600, redline:7000, idle:800,
    drive:'rwd', wb:2.55, frontDist:0.55, track:1.52, wheelR:0.322, cdA:0.86,
    gears:[3.83,2.36,1.69,1.31,1.00,0.79], final:3.26, eff:0.92, boost:1.35,
    maxSteer:34, brakeTorque:4400, body:{ len:4.52, wid:1.81, hood:0.90, belt:0.96, roof:1.28,
      cabinRear:-0.70, cabinFront:0.58, cabinRoofRear:-0.34, cabinRoofFront:0.36,
      archR:0.37, spoiler:'gtwing', nose:'long', lights:'pop', exhaust:'dual', cage:false },
    gripBase:1.0,
  },
  {
    id:'fox', name:'FOX GT 5.0', tag:'US · RWD · V8', desc:'Американский V8 с огромным моментом. Крутит заднюю ось на любой скорости.',
    mass:1560, power:310, powerRpm:5000, torque:588, torqueRpm:4000, redline:6400, idle:700,
    drive:'rwd', wb:2.62, frontDist:0.57, track:1.54, wheelR:0.332, cdA:0.96,
    gears:[2.95,1.94,1.34,1.00,0.74,0.57], final:3.27, eff:0.90,
    maxSteer:32, brakeTorque:4600, body:{ len:4.66, wid:1.85, hood:0.96, belt:1.02, roof:1.32,
      cabinRear:-0.60, cabinFront:0.42, cabinRoofRear:-0.36, cabinRoofFront:0.26,
      archR:0.39, spoiler:'lip', nose:'long', lights:'rect', exhaust:'dual', cage:false },
    gripBase:1.0,
  },
  {
    id:'m3', name:'E30 M3', tag:'DE · RWD', desc:'Гоночный седан с идеальным балансом. Предсказуемый и быстрый.',
    mass:1200, power:200, powerRpm:6750, torque:300, torqueRpm:4750, redline:7300, idle:900,
    drive:'rwd', wb:2.57, frontDist:0.53, track:1.44, wheelR:0.312, cdA:0.79,
    gears:[3.83,2.20,1.40,1.00,0.81], final:3.73, eff:0.92,
    maxSteer:35, brakeTorque:3800, body:{ len:4.46, wid:1.68, hood:0.92, belt:0.97, roof:1.34,
      cabinRear:-0.66, cabinFront:0.50, cabinRoofRear:-0.34, cabinRoofFront:0.26,
      archR:0.35, spoiler:'lip', nose:'box', lights:'rect', exhaust:'dual', cage:true },
    gripBase:1.0,
  },
  {
    id:'evo', name:'EVO RALLY', tag:'JP · AWD', desc:'Полный привод с вектором момента. Хватает сцепления — нужна сила руки.',
    mass:1400, power:300, powerRpm:6500, torque:500, torqueRpm:3500, redline:7000, idle:850,
    drive:'awd', split:[0.22,0.22,0.78,0.78], wb:2.63, frontDist:0.58, track:1.51, wheelR:0.322, cdA:0.90,
    gears:[3.83,2.36,1.69,1.31,1.00,0.79], final:3.90, eff:0.90,
    maxSteer:34, brakeTorque:4300, body:{ len:4.49, wid:1.80, hood:0.92, belt:0.99, roof:1.42,
      cabinRear:-0.72, cabinFront:0.52, cabinRoofRear:-0.40, cabinRoofFront:0.30,
      archR:0.37, spoiler:'gtwing', nose:'box', lights:'rect', exhaust:'dual', cage:false },
    gripBase:1.0,
  },
];

// ---- тюнинг: что можно крутить и как это влияет на физику ----
export const TUNE_DEFS = [
  { key:'compound',  label:'Резина',            type:'select', options:Object.values(COMPOUNDS).map(c=>({value:c.id,label:c.name})) },
  { key:'springF',   label:'Пружины перед',     min:20, max:120, step:1,   unit:' N/мм', def:55 },
  { key:'springR',   label:'Пружины зад',       min:20, max:120, step:1,   unit:' N/мм', def:62 },
  { key:'rideHeight',label:'Высота клиренса',   min:8,  max:26,  step:1,   unit:' см',   def:14 },
  { key:'brakeBias', label:'Распред. тормозов', min:50, max:85,  step:1,   unit:'% перед', def:64 },
  { key:'diff',      label:'Преднатяг дифф.',   min:0,  max:100, step:1,   unit:'%',     def:45 },
  { key:'downforce', label:'Антикрыло',         min:0,  max:100, step:1,   unit:'%',     def:35 },
  { key:'steerLock', label:'Угол руля',         min:28, max:58,  step:1,   unit:'°',     def:42 },
  { key:'toeFront',  label:'Схождение перед',   min:-1.5,max:1.5, step:0.1, unit:'°',     def:0.2 },
  { key:'final',     label:'Главная пара',      min:2.9,max:5.0, step:0.01,unit:':1',    def:3.69 },
];

export const TUNE_PRESETS = {
  drift: { compound:'drift', springF:48, springR:64, rideHeight:14, brakeBias:66, diff:60, downforce:45, steerLock:42, toeFront:0.4, final:3.69 },
  grip:  { compound:'semi',  springF:82, springR:88, rideHeight:10, brakeBias:62, diff:28, downforce:70, steerLock:40, toeFront:0.1, final:3.69 },
  stock: { compound:'street',springF:55, springR:62, rideHeight:14, brakeBias:64, diff:45, downforce:35, steerLock:42, toeFront:0.2, final:3.69 },
};

export const GFX_PRESETS = {
  low:    { res:0.65, shadows:0, bloom:false, motionBlur:false, fxaa:false, smoke:0.35, skid:true,  drawDist:260, carReflect:0 },
  medium: { res:0.85, shadows:1, bloom:true,  motionBlur:true,  fxaa:true,  smoke:0.7,  skid:true,  drawDist:420, carReflect:1 },
  high:   { res:1.0,  shadows:2, bloom:true,  motionBlur:true,  fxaa:true,  smoke:1.0,  skid:true,  drawDist:650, carReflect:1 },
  ultra:  { res:1.0,  shadows:3, bloom:true,  motionBlur:true,  fxaa:true,  smoke:1.0,  skid:true,  drawDist:900, carReflect:2 },
};

export const DEFAULT_SETTINGS = {
  quality:'high',
  res:1.0, shadows:2, bloom:true, bloomStrength:0.55, motionBlur:true, motionDamp:0.82,
  fxaa:true, smoke:1.0, skid:true, drawDist:650, carReflect:1,
  fov:62, camDist:6.4, camHeight:2.5, camLook:1.35, speedFov:true,
  timeOfDay:'day', masterVol:0.8, engineVol:0.8, tireVol:0.7, windVol:0.5,
  showFps:true, units:'kmh',
};

export const KEY_HELP = [
  ['W / ↑','Газ'], ['S / ↓','Тормоз / задний ход'], ['A / D','Руль'],
  ['Space','Ручник (блокировка задней оси)'], ['Shift','Повысить передачу'],
  ['Ctrl / Z','Понизить передачу'], ['C','Смена камеры'], ['R','Респавн'],
  ['Tab','Быстрый тюнинг'], ['M','Звук вкл/выкл'], ['Esc','Пауза'],
];

// ---------- сохранение ----------
const SAVE_KEY = 'driftarena_v1';
export function loadSave(){
  try{ const s = JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); return s||{}; }catch(e){ return {}; }
}
export function writeSave(data){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(data)); }catch(e){}
}
export function defaultTune(car){
  const t = {};
  for(const d of TUNE_DEFS){
    if(d.key==='compound') t.compound = 'street';
    else t[d.key] = (TUNE_PRESETS.stock[d.key] !== undefined ? TUNE_PRESETS.stock[d.key] : d.def);
  }
  if(car) t.final = car.final;
  return t;
}
export function defaultStyle(){
  return { paint:'#d81f2a', rim:'#c8ccd2', rimStyle:'mesh', tint:0.16, metal:0.6, clear:1.0, caliper:'#ffb400' };
}
