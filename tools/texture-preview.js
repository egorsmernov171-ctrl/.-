// ============ Превью текстур и материалов DRIFT ARENA ============
// Рисует в preview/ то, как выглядят текстуры игры:
//   * настоящие canvas-текстуры (боковина шины, асфальт, дорога, скейд-пад...)
//     — берутся прямо из js/textures.js;
//   * материалы машин (краска, диски, стёкла, суппорта) — воссоздаются по
//     реальным параметрам MeshPhysicalMaterial из js/carbuilder.js.
// Запуск: node tools/texture-preview.js   (нужен @napi-rs/canvas)
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// textures.js рассчитан на браузер: подставляем canvas
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') throw new Error('unsupported tag ' + tag);
    return createCanvas(300, 150);
  },
};

const OUT = path.join(__dirname, '..', 'preview');
fs.mkdirSync(OUT, { recursive: true });

// ---------- утилиты рисования ----------
function rr(g, x, y, w, h, r) { // rounded rect path
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function label(g, text, x, y, size, color, align) {
  g.fillStyle = color || '#e8ecf2';
  g.font = (size || 18) + 'px sans-serif';
  g.textAlign = align || 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}
function panel(g, x, y, w, h, title) {
  g.fillStyle = '#1b1f26';
  rr(g, x, y, w, h, 12); g.fill();
  g.strokeStyle = '#2c333d'; g.lineWidth = 1;
  rr(g, x + .5, y + .5, w - 1, h - 1, 12); g.stroke();
  if (title) label(g, title, x + 16, y + 24, 19, '#ffd15c', 'left');
}

// Краска: цвет + metalness (0.30+metal*0.55) + roughness .26 + clearcoat
function paintSwatch(g, x, y, w, h, hex, metal, clear) {
  g.save();
  rr(g, x, y, w, h, 8); g.clip();
  g.fillStyle = hex; g.fillRect(x, y, w, h);

  // металликовая вуаль + микровспышки
  if (metal > 0.12) {
    const n = Math.round(metal * 700);
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h;
      const a = (0.04 + Math.random() * 0.30) * metal;
      g.fillStyle = Math.random() > 0.45
        ? 'rgba(255,255,255,' + a.toFixed(3) + ')'
        : 'rgba(0,0,0,' + (a * 0.8).toFixed(3) + ')';
      g.fillRect(px, py, 1 + Math.random() * 1.7, 1 + Math.random() * 1.7);
    }
  }
  // отражение окружения: небо сверху, земля снизу (envMapIntensity 1.1)
  const env = 0.10 + metal * 0.32;
  const grd = g.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0.00, 'rgba(186,212,255,' + env.toFixed(3) + ')');
  grd.addColorStop(0.42, 'rgba(255,255,255,' + (env * 0.12).toFixed(3) + ')');
  grd.addColorStop(0.58, 'rgba(0,0,0,' + (env * 0.22).toFixed(3) + ')');
  grd.addColorStop(1.00, 'rgba(28,24,18,' + (env * 0.95).toFixed(3) + ')');
  g.fillStyle = grd; g.fillRect(x, y, w, h);

  // широкий блик (roughness 0.26)
  const hl = g.createLinearGradient(0, y, 0, y + h * 0.75);
  hl.addColorStop(0, 'rgba(255,255,255,' + (0.05 + metal * 0.13).toFixed(3) + ')');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(x, y, w, h * 0.75);

  // резкий блик лака (clearcoat, clearcoatRoughness 0.06)
  if (clear > 0.02) {
    g.globalAlpha = Math.min(1, clear);
    const cy = y + h * 0.30, hh = h * 0.09;
    const cg = g.createLinearGradient(0, cy - hh, 0, cy + hh);
    cg.addColorStop(0, 'rgba(255,255,255,0)');
    cg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.fillRect(x, cy - hh, w, hh * 2);
    g.globalAlpha = 1;
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1;
  rr(g, x + .5, y + .5, w - 1, h - 1, 8); g.stroke();
}

// Колесо в виду спереди — по buildWheelParts() из carbuilder.js
function drawWheel(g, cx, cy, R, style, rimHex, caliperHex) {
  const rimR = R * 0.63, scale = R / 0.33;
  const counts = { mesh: 10, star: 5, deep: 0, work: 12 };
  const thick = { mesh: 0.030, star: 0.075, deep: 0, work: 0.022 };
  const n = counts[style], spT = (thick[style] || 0.03) * scale;

  // шина (матовый каучук, roughness .94)
  g.fillStyle = '#0c0c0e';
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let i = 0; i < 44; i++) {
    const a = i * Math.PI * 2 / 44;
    g.beginPath();
    g.arc(cx, cy, R - 2, a, a + 0.05); g.stroke();
  }

  // барабан/обод (metalness .92, roughness .24)
  const rg = g.createRadialGradient(cx - rimR * 0.3, cy - rimR * 0.35, rimR * 0.05, cx, cy, rimR);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, rimHex);
  rg.addColorStop(0.75, shade(rimHex, -0.45)); rg.addColorStop(1, shade(rimHex, -0.7));
  g.fillStyle = rg;
  g.beginPath(); g.arc(cx, cy, rimR * 0.95, 0, 7); g.fill();

  if (n > 0) {
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + (style === 'work' ? (i % 2) * 0.12 : 0);
      const r0 = rimR * 0.03, r1 = rimR * 0.85;
      g.save(); g.translate(cx, cy); g.rotate(a);
      const sg = g.createLinearGradient(0, -spT / 2, 0, spT / 2);
      sg.addColorStop(0, shade(rimHex, 0.35)); sg.addColorStop(0.5, rimHex);
      sg.addColorStop(1, shade(rimHex, -0.55));
      g.fillStyle = sg;
      rr(g, r0, -spT / 2, r1 - r0, spT, Math.min(3, spT / 2)); g.fill();
      g.restore();
    }
  } else {
    // deep dish: гладкая тарелка + полированный лип
    const dg = g.createRadialGradient(cx - rimR * 0.25, cy - rimR * 0.3, 2, cx, cy, rimR * 0.93);
    dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.4, rimHex);
    dg.addColorStop(1, shade(rimHex, -0.55));
    g.fillStyle = dg;
    g.beginPath(); g.arc(cx, cy, rimR * 0.93, 0, 7); g.fill();
    g.strokeStyle = '#f4f7fb'; g.lineWidth = Math.max(3, R * 0.055);
    g.beginPath(); g.arc(cx, cy, rimR * 0.92, 0, 7); g.stroke();
  }

  // тормозной диск (хром, metalness 1.0)
  const dg = g.createRadialGradient(cx, cy, 1, cx, cy, rimR * 0.62);
  dg.addColorStop(0, '#cfd6df'); dg.addColorStop(0.7, '#f2f4f7'); dg.addColorStop(1, '#9aa3ad');
  g.fillStyle = dg;
  g.beginPath(); g.arc(cx, cy, rimR * 0.62, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let r = rimR * 0.2; r < rimR * 0.6; r += rimR * 0.09) {
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }

  // суппорт
  g.fillStyle = caliperHex;
  rr(g, cx - rimR * 0.10, cy - rimR * 0.50, rimR * 0.20, rimR * 0.34, 3); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  rr(g, cx - rimR * 0.10, cy - rimR * 0.28, rimR * 0.20, rimR * 0.05, 2); g.fill();

  // центровая крышка
  g.fillStyle = shade(rimHex, -0.1);
  g.beginPath(); g.arc(cx, cy, R * 0.055 * 3.05, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.arc(cx - R * 0.05, cy - R * 0.05, R * 0.02, 0, 7); g.fill();
}
function shade(hex, amt) {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return 'rgb(' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',') + ')';
}

(async () => {
  const T = await import('../js/textures.js');

  // ---------- настоящие canvas-текстуры ----------
  const tire = T.tireSideTexture();
  const asphalt = T.asphaltTexture();
  const road = T.roadTexture();
  const curb = T.curbTexture();
  const skid = T.skidpadTexture();
  const dirt = T.dirtTexture();
  const building = T.buildingTexture(6);
  const billboard = T.billboardTexture('DRIFT', '#111318', '#ff2d55', 'ARENA');

  // ================= Лист 1: машины =================
  const W = 1500, H = 1120;
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#101317'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  label(g, 'DRIFT ARENA — текстуры и материалы машин', 32, 40, 30, '#ffffff', 'left');
  label(g, 'краска, диски, стёкла, шины — как в игре', 32, 70, 17, '#8b95a5', 'left');

  // --- краска ---
  panel(g, 24, 96, W - 48, 268, 'Краска кузова — MeshPhysicalMaterial (metalness 0.30+metal·0.55, roughness 0.26, clearcoat)');
  const paints = [
    ['#d81f2a', 0.60, 1.00, 'серийная'],
    ['#d81f2a', 0.00, 0.00, 'матовая'],
    ['#f2f4f7', 0.90, 1.00, 'белый металлик'],
    ['#0b0e13', 0.80, 1.00, 'чёрный металлик'],
    ['#1b4fd8', 0.50, 1.00, 'синий'],
    ['#1f9d55', 0.40, 0.80, 'зелёный'],
    ['#ffb400', 0.70, 1.00, 'жёлтый'],
    ['#8a2be2', 0.60, 1.00, 'фиолетовый'],
  ];
  const sw = 168, sh = 132, gap = 12, x0 = 40, y0 = 132;
  paints.forEach((p, i) => {
    const x = x0 + i * (sw + gap);
    paintSwatch(g, x, y0, sw, sh, p[0], p[1], p[2]);
    label(g, p[0].toUpperCase(), x, y0 + sh + 18, 14, '#cfd6e0', 'left');
    label(g, 'металл ' + p[1].toFixed(2) + ' · лак ' + p[2].toFixed(2), x, y0 + sh + 38, 13, '#7f8896', 'left');
    label(g, p[3], x, y0 + sh + 58, 13, '#ffd15c', 'left');
  });

  // --- диски ---
  panel(g, 24, 384, W - 48, 300, 'Диски — 4 типа (спицы считаются по buildWheelParts): хром-диск, суппорт, центровая крышка');
  const rims = [
    ['mesh', 'Mesh — 10 тонких спиц'],
    ['star', 'Star — 5 широких спиц'],
    ['deep', 'Deep dish — гладкая тарелка + лип'],
    ['work', 'Work — 12 тонких спиц'],
  ];
  rims.forEach((r, i) => {
    const cx = 130 + i * 360, cy = 534;
    drawWheel(g, cx, cy, 96, r[0], '#c8ccd2', '#ffb400');
    label(g, r[1], cx, 660, 15, '#cfd6e0', 'center');
  });

  // --- стёкла ---
  panel(g, 24, 704, 700, 200, 'Тонировка стёкол — прозрачность 1 − tint');
  const tints = [[0.06, 'максимальная'], [0.16, 'средняя'], [0.35, 'слабая'], [0.55, 'без тонировки']];
  tints.forEach((t, i) => {
    const x = 48 + i * 168, y = 748, s = 104;
    // «вид из салона»: яркая сцена за стеклом
    const bg = g.createLinearGradient(0, y, 0, y + s);
    bg.addColorStop(0, '#8fb8e8'); bg.addColorStop(0.6, '#dfe7ef'); bg.addColorStop(1, '#6b7280');
    g.fillStyle = bg; g.fillRect(x, y, s, s);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 5; k++) g.fillRect(x + 8 + k * 22, y + 12 + (k % 2) * 14, 12, 12);
    // стекло: цвет 0x0b0e13, metalness .85, roughness .06
    g.fillStyle = 'rgba(11,14,19,' + (1 - t[0]).toFixed(3) + ')';
    g.fillRect(x, y, s, s);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(x, y, s, 4);
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1;
    g.strokeRect(x + .5, y + .5, s - 1, s - 1);
    label(g, t[1], x + s / 2, y + s + 20, 14, '#cfd6e0', 'center');
    label(g, 'tint ' + t[0].toFixed(2), x + s / 2, y + s + 40, 13, '#7f8896', 'center');
  });

  // --- боковина шины (настоящая текстура) ---
  panel(g, 748, 704, W - 772, 200, 'Боковина шины — настоящая canvas-текстура tireSideTexture()');
  g.imageSmoothingEnabled = false;
  const ts = 150;
  g.drawImage(tire.image, 0, 0, tire.image.width, tire.image.height, 772, 736, ts, ts);
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1;
  g.strokeRect(771.5, 735.5, ts + 1, ts + 1);
  label(g, '128×128 → ×4', 772 + ts + 18, 812, 14, '#7f8896', 'left');
  label(g, 'чёрный каучук, серое кольцо, надпись DRIFT ARENA', 772 + ts + 18, 836, 14, '#7f8896', 'left');
  label(g, 'шина: цвет #0c0c0e, roughness 0.94, metalness 0.02', 772 + ts + 18, 860, 14, '#7f8896', 'left');

  fs.writeFileSync(path.join(OUT, 'car-textures.png'), c.toBuffer('image/png'));
  console.log('preview/car-textures.png — машины');

  // ================= Лист 2: окружение =================
  const W2 = 1180, H2 = 760;
  const c2 = createCanvas(W2, H2), g2 = c2.getContext('2d');
  g2.fillStyle = '#101317'; g2.fillRect(0, 0, W2, H2);
  label(g2, 'DRIFT ARENA — настоящие текстуры окружения', 32, 40, 28, '#ffffff', 'left');
  label(g2, 'все изображения ниже отрендерены из js/textures.js', 32, 70, 16, '#8b95a5', 'left');

  function tile(name, img, x, y, w, h, note) {
    g2.fillStyle = '#1b1f26'; rr(g2, x, y, w, h, 10); g2.fill();
    g2.imageSmoothingEnabled = true;
    g2.drawImage(img, 0, 0, img.width, img.height, x + 12, y + 12, w - 24, h - 58);
    g2.strokeStyle = 'rgba(255,255,255,0.12)';
    g2.strokeRect(x + 12.5, y + 12.5, w - 25, h - 59);
    label(g2, name, x + 12, y + h - 30, 16, '#ffd15c', 'left');
    label(g2, note, x + 12, y + h - 12, 13, '#7f8896', 'left');
  }
  tile('Асфальт ( asphaltTexture )', asphalt.image, 24, 96, 360, 300, '512×512, repeat 40 — пятна, трещины, шум');
  tile('Дорога ( roadTexture )', road.image, 400, 96, 200, 300, '256×1024 — кромки и ось');
  tile('Бордюр ( curbTexture )', curb.image, 616, 96, 140, 300, '64×256 — красно-белые блоки');
  tile('Грунт ( dirtTexture )', dirt.image, 772, 96, 360, 300, '512×512, repeat 40');
  tile('Скейд-пад ( skidpadTexture )', skid.image, 24, 412, 420, 320, '1024×1024 — круги, разметка, надпись');
  tile('Здания ( buildingTexture )', building.image, 460, 412, 300, 320, '256×256 — окна, часть горит');
  tile('Билборд ( billboardTexture )', billboard.image, 776, 412, 356, 320, '512×256 — реклама DRIFT ARENA');

  fs.writeFileSync(path.join(OUT, 'env-textures.png'), c2.toBuffer('image/png'));
  console.log('preview/env-textures.png — окружение');
})().catch(e => { console.error(e); process.exit(1); });
