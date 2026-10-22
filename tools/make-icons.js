// Генератор иконок PWA (PNG через zlib, без внешних зависимостей)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf){
  let table = crc32.table;
  if(!table){
    table = crc32.table = new Int32Array(256);
    for(let n=0;n<256;n++){
      let c = n;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let c = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(w, h, rgba){
  const raw = Buffer.alloc(h*(w*4 + 1));
  for(let y=0;y<h;y++){
    raw[y*(w*4+1)] = 0; // фильтр none
    rgba.copy(raw, y*(w*4+1)+1, y*w*4, (y+1)*w*4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, {level:9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size){
  const px = Buffer.alloc(size*size*4);
  const R = size*0.20;                       // скругление
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const i = (y*size+x)*4;
      const u = x/size, v = y/size;
      // маска скруглённого квадрата
      const cx = Math.min(u, 1-u), cy = Math.min(v, 1-v);
      const d = Math.hypot(Math.max(0, R/size - cx), Math.max(0, R/size - cy));
      const inside = d <= R/size + 0.001;
      // фон: диагональный градиент
      const t = (u*0.6 + v*0.4);
      let r = 12 + t*16, g = 15 + t*20, b = 22 + t*28;
      // диагональные полосы «дрифта»
      const band = (u*0.75 - v*0.66);
      const s1 = Math.abs(((band + 1.0) % 0.5) - 0.25);   // полоса 1
      const s2 = Math.abs(((band + 1.18) % 0.5) - 0.25);  // полоса 2
      const w1 = 0.055, w2 = 0.020;
      if(s1 < w1){ const k = 1 - s1/w1; r += (255-r)*k; g += (45-g)*k; b += (85-b)*k; }
      if(s2 < w2){ const k = 1 - s2/w2; r += (255-r)*k*0.9; g += (255-g)*k*0.9; b += (255-b)*k*0.9; }
      // искра
      const sp = Math.hypot(u-0.72, v-0.28);
      if(sp < 0.055){ const k = 1 - sp/0.055; r += (255-r)*k; g += (212-g)*k; b += (0-b)*k; }
      if(!inside){ px[i]=0; px[i+1]=0; px[i+2]=0; px[i+3]=0; }
      else { px[i]=r|0; px[i+1]=g|0; px[i+2]=b|0; px[i+3]=255; }
    }
  }
  return makePNG(size, size, px);
}

const out = path.join(__dirname, '..');
fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512));
fs.writeFileSync(path.join(out, 'icon-maskable.png'), draw(512));
console.log('иконки созданы: public/icon-192.png, icon-512.png, icon-maskable.png');
