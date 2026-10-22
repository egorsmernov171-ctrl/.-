// ============ Процедурные текстуры на canvas ============
import * as THREE from 'three';

function canvas(size, h){
  const c = document.createElement('canvas');
  c.width = size; c.height = h || size;
  return c;
}
function noise(ctx, w, h, amount, alpha){
  const img = ctx.getImageData(0,0,w,h);
  const d = img.data;
  for(let i=0;i<d.length;i+=4){
    const n = (Math.random()-0.5)*amount;
    d[i] = Math.max(0, Math.min(255, d[i]+n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1]+n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2]+n));
    if(alpha !== undefined) d[i+3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
}
function tex(c, repeatX, repeatY, srgb){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX||1, repeatY||1);
  t.anisotropy = 8;
  if(srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function asphaltTexture(repeat = 40, base = '#33363b'){
  const c = canvas(512), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,512,512);
  // пятна и трещины
  for(let i=0;i<260;i++){
    const x = Math.random()*512, y = Math.random()*512, r = 6+Math.random()*46;
    g.beginPath(); g.arc(x,y,r,0,7);
    g.fillStyle = `rgba(${20+Math.random()*40|0},${20+Math.random()*40|0},${24+Math.random()*40|0},${0.05+Math.random()*0.12})`;
    g.fill();
  }
  for(let i=0;i<40;i++){
    g.strokeStyle = `rgba(10,10,12,${0.1+Math.random()*0.2})`;
    g.lineWidth = 0.6+Math.random()*1.4;
    g.beginPath();
    let x = Math.random()*512, y = Math.random()*512;
    g.moveTo(x,y);
    for(let k=0;k<4;k++){ x += (Math.random()-0.5)*90; y += (Math.random()-0.5)*90; g.lineTo(x,y); }
    g.stroke();
  }
  noise(g, 512, 512, 34);
  return tex(c, repeat, repeat);
}

export function roadTexture(){
  const w = 256, h = 1024;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#31343a'; g.fillRect(0,0,w,h);
  for(let i=0;i<300;i++){
    g.fillStyle = `rgba(${25+Math.random()*30|0},${25+Math.random()*30|0},${28+Math.random()*30|0},0.10)`;
    g.fillRect(Math.random()*w, Math.random()*h, 2+Math.random()*40, 2+Math.random()*16);
  }
  // разметка: сплошные кромки + прерывистая ось
  g.fillStyle = 'rgba(232,232,228,0.85)';
  g.fillRect(14, 0, 7, h);
  g.fillRect(w-21, 0, 7, h);
  for(let y=0;y<h;y+=110){ g.fillRect(w/2-4, y, 8, 62); }
  noise(g, w, h, 26);
  return tex(c, 1, 1);
}

export function curbTexture(){
  const c = canvas(64, 256), g = c.getContext('d');
  for(let y=0;y<256;y+=64){
    g.fillStyle = (y/64)%2 === 0 ? '#c8202c' : '#e8e8e6';
    g.fillRect(0, y, 64, 64);
  }
  noise(g, 64, 256, 18);
  return tex(c, 1, 1);
}

export function skidpadTexture(){
  const S = 1024;
  const c = canvas(S), g = c.getContext('2d');
  g.fillStyle = '#2c2f34'; g.fillRect(0,0,S,S);
  for(let i=0;i<500;i++){
    g.fillStyle = `rgba(${20+Math.random()*30|0},${20+Math.random()*30|0},${24+Math.random()*30|0},0.08)`;
    g.beginPath(); g.arc(Math.random()*S, Math.random()*S, 5+Math.random()*60, 0, 7); g.fill();
  }
  const cx = S/2, cy = S/2;
  // концентрические круги
  g.strokeStyle = 'rgba(240,240,235,0.30)';
  for(const r of [140, 240, 340, 430]){
    g.lineWidth = r===240?10:5;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }
  // разметка "фигур"
  g.strokeStyle = 'rgba(255,210,60,0.55)';
  g.lineWidth = 8;
  for(let i=0;i<12;i++){
    const a0 = i*Math.PI/6, a1 = a0 + Math.PI/12;
    g.beginPath();
    g.arc(cx, cy, 390, a0, a1); g.stroke();
  }
  // надпись
  g.save();
  g.translate(cx, cy);
  g.font = 'italic 900 150px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText('DRIFT', 0, -10);
  const grd = g.createLinearGradient(0,-90,0,90);
  grd.addColorStop(0,'#ffffff'); grd.addColorStop(1,'#ff2d55');
  g.fillStyle = grd;
  g.fillText('DRIFT', 0, -10);
  g.font = '700 54px Arial';
  g.fillStyle = 'rgba(255,210,60,0.8)';
  g.fillText('ARENA', 0, 110);
  g.restore();
  // стрелки входа
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for(let i=0;i<6;i++){
    g.save(); g.translate(cx, cy - 300 - i*40); g.rotate(Math.PI);
    g.beginPath(); g.moveTo(-40,-26); g.lineTo(30,0); g.lineTo(-40,26); g.closePath(); g.fill();
    g.restore();
  }
  noise(g, S, S, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildingTexture(floors = 6){
  const S = 256;
  const c = canvas(S), g = c.getContext('2d');
  g.fillStyle = '#3a3d44'; g.fillRect(0,0,S,S);
  const cols = 6, rows = floors;
  const w = S/cols, h = S/rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const lit = Math.random() > 0.45;
      g.fillStyle = lit ? `rgba(${180+Math.random()*60|0},${200+Math.random()*40|0},220,${0.35+Math.random()*0.4})`
                        : 'rgba(20,24,32,0.85)';
      g.fillRect(x*w + w*0.18, y*h + h*0.2, w*0.64, h*0.5);
    }
  }
  noise(g, S, S, 14);
  return tex(c, 1, 1);
}

export function billboardTexture(text, bg, fg, sub){
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0,0,512,256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for(let i=0;i<512;i+=32) g.fillRect(i,0,16,256);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 900 96px Arial';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.strokeText(text, 256, sub?106:128);
  g.fillStyle = fg; g.fillText(text, 256, sub?106:128);
  if(sub){
    g.font = '700 44px Arial';
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(sub, 256, 190);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function dirtTexture(repeat = 40){
  const c = canvas(512), g = c.getContext('2d');
  g.fillStyle = '#4a4034'; g.fillRect(0,0,512,512);
  for(let i=0;i<400;i++){
    g.fillStyle = `rgba(${60+Math.random()*50|0},${52+Math.random()*40|0},${40+Math.random()*30|0},0.25)`;
    g.beginPath(); g.arc(Math.random()*512, Math.random()*512, 3+Math.random()*26, 0, 7); g.fill();
  }
  noise(g, 512, 512, 30);
  return tex(c, repeat, repeat);
}

export function tireSideTexture(){
  const c = canvas(128), g = c.getContext('2d');
  g.fillStyle = '#101012'; g.fillRect(0,0,128,128);
  g.strokeStyle = 'rgba(180,180,180,0.35)'; g.lineWidth = 3;
  g.beginPath(); g.arc(64,64,50,0,7); g.stroke();
  g.font = '700 16px Arial'; g.fillStyle = 'rgba(200,200,200,0.5)';
  g.textAlign = 'center';
  g.fillText('DRIFT', 64, 40);
  g.fillText('ARENA', 64, 96);
  return tex(c, 1, 1);
}
