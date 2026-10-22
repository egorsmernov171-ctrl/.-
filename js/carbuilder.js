// ============ Построение реалистичной модели машины из параметров ============
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function mat(params){ return new THREE.MeshStandardMaterial(params); }

export function buildCar(def, style){
  const B = def.body;
  const L = B.len, W = B.wid;
  const a = def.wb*(1-def.frontDist), b = def.wb - a; // в локальных Z: перед +a, зад -b
  const wheelR = def.wheelR, track = def.track;
  const wheelW = 0.22 + wheelR*0.42;

  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  // ---------- материалы ----------
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(style.paint), metalness: 0.45, roughness: 0.26,
    clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.1,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0e13, metalness: 0.85, roughness: 0.06,
    transparent: true, opacity: 1 - style.tint, envMapIntensity: 1.4,
  });
  const roofMat = paintMat;
  const rimMat = mat({ color: new THREE.Color(style.rim), metalness: 0.92, roughness: 0.24, envMapIntensity: 1.2 });
  const caliperMat = mat({ color: new THREE.Color(style.caliper), metalness: 0.35, roughness: 0.45 });
  const tireMat = mat({ color: 0x0c0c0e, roughness: 0.94, metalness: 0.02 });
  const chromeMat = mat({ color: 0xf2f4f7, metalness: 1.0, roughness: 0.14 });
  const darkMat = mat({ color: 0x15181d, roughness: 0.82, metalness: 0.25 });
  const matteMat = mat({ color: 0x0e1013, roughness: 0.95, metalness: 0.05 });
  const headMat = mat({ color: 0xffffff, emissive: 0xfff0cf, emissiveIntensity: 0.0, roughness: 0.25, metalness: 0.1 });
  const tailMat = mat({ color: 0x33060a, emissive: 0xff1020, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1 });
  const cageMat = mat({ color: 0xb9c0c9, metalness: 0.85, roughness: 0.35 });

  // ---------- нижняя часть кузова (профиль сбоку, экструзия по ширине) ----------
  const shape = new THREE.Shape();
  const half = L/2;
  const prof = [
    [-half, 0.14], [-half, 0.60], [-half+0.14, 0.79],
    [-b+0.22, B.hood+0.02],
    [B.cabinRear, B.belt],
    [a-0.06, B.belt],
    [a+0.12, B.hood-0.02],
    [half-0.16, B.hood-0.05],
    [half, 0.72], [half, 0.16], [half-0.26, 0.13], [0, 0.12], [-half+0.26, 0.13],
  ];
  shape.moveTo(prof[0][0], prof[0][1]);
  for(let i=1;i<prof.length;i++) shape.lineTo(prof[i][0], prof[i][1]);
  shape.closePath();

  let bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: W, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4,
  });
  bodyGeo.rotateY(-Math.PI/2);          // длина -> +Z, экструзия -> X
  bodyGeo.translate(W/2, 0, 0);
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  chassis.add(bodyMesh);

  // ---------- кабина (стёкла) ----------
  const cab = new THREE.Shape();
  const cp = [
    [B.cabinRear-0.08, B.belt-0.03],
    [B.cabinRoofRear, B.roof],
    [B.cabinRoofRear+0.10, B.roof+0.025],
    [B.cabinRoofFront-0.10, B.roof+0.025],
    [B.cabinRoofFront, B.roof],
    [B.cabinFront+0.08, B.belt-0.03],
  ];
  cab.moveTo(cp[0][0], cp[0][1]);
  for(let i=1;i<cp.length;i++) cab.lineTo(cp[i][0], cp[i][1]);
  cab.closePath();
  let cabGeo = new THREE.ExtrudeGeometry(cab, {
    depth: W*0.90, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2,
  });
  cabGeo.rotateY(-Math.PI/2);
  cabGeo.translate(W*0.45, 0, 0);
  cabGeo.computeVertexNormals();
  chassis.add(new THREE.Mesh(cabGeo, glassMat));

  // крыша
  const roof = new THREE.Mesh(
    new RoundedBoxGeometry(W*0.84, 0.06, (B.cabinRoofFront-B.cabinRoofRear)+0.22, 2, 0.025), roofMat);
  roof.position.set(0, B.roof+0.03, (B.cabinRoofRear+B.cabinRoofFront)/2);
  chassis.add(roof);

  // ---------- бамперы, сплиттер, диффузор ----------
  const fb = new THREE.Mesh(new RoundedBoxGeometry(W*0.99, 0.34, 0.24, 2, 0.05), matteMat);
  fb.position.set(0, 0.40, half-0.10); chassis.add(fb);
  const rb = new THREE.Mesh(new RoundedBoxGeometry(W*0.99, 0.32, 0.22, 2, 0.05), matteMat);
  rb.position.set(0, 0.38, -half+0.09); chassis.add(rb);
  const splitter = new THREE.Mesh(new RoundedBoxGeometry(W*1.02, 0.05, 0.34, 2, 0.02), matteMat);
  splitter.position.set(0, 0.13, half-0.16); chassis.add(splitter);
  const diff = new THREE.Mesh(new RoundedBoxGeometry(W*0.96, 0.20, 0.26, 2, 0.03), matteMat);
  diff.position.set(0, 0.17, -half+0.12); chassis.add(diff);

  // решётка
  const grille = new THREE.Mesh(new RoundedBoxGeometry(W*0.52, 0.17, 0.07, 2, 0.03), darkMat);
  grille.position.set(0, 0.60, half-0.055); chassis.add(grille);

  // ---------- фары ----------
  const hlStyle = B.lights === 'rect' ? 0.55 : 1.0;
  for(const sx of [-1, 1]){
    const hl = new THREE.Mesh(new RoundedBoxGeometry(0.40*hlStyle, 0.15, 0.12, 2, 0.055), headMat);
    hl.position.set(sx*W*0.31, B.hood-0.09, half-0.10);
    chassis.add(hl);
  }
  // стоп-сигналы
  for(const sx of [-1, 1]){
    const tl = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.13, 0.08, 2, 0.03), tailMat);
    tl.position.set(sx*W*0.32, B.hood+0.02, -half+0.06);
    chassis.add(tl);
  }

  // ---------- зеркала ----------
  for(const sx of [-1, 1]){
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.09, 0.06, 2, 0.02), paintMat);
    m.position.set(sx*(W/2+0.09), B.belt+0.10, B.cabinFront+0.02);
    chassis.add(m);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.10, 6), matteMat);
    stalk.rotation.z = Math.PI/2;
    stalk.position.set(sx*(W/2+0.02), B.belt+0.09, B.cabinFront+0.02);
    chassis.add(stalk);
  }

  // ---------- выхлоп ----------
  const exhCount = B.exhaust === 'dual' ? 2 : 1;
  for(let i=0;i<exhCount;i++){
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.18, 12), chromeMat);
    e.rotation.x = Math.PI/2;
    e.position.set((exhCount===1?0:(i===0?-0.22:0.22)), 0.24, -half-0.02);
    chassis.add(e);
  }

  // ---------- спойлер ----------
  if(B.spoiler === 'duckbill'){
    const s = new THREE.Mesh(new RoundedBoxGeometry(W*0.86, 0.05, 0.26, 2, 0.02), matteMat);
    s.position.set(0, B.hood+0.10, -half+0.34); s.rotation.x = -0.12;
    chassis.add(s);
  } else if(B.spoiler === 'gtwing'){
    const wing = new THREE.Mesh(new RoundedBoxGeometry(W*0.92, 0.045, 0.30, 2, 0.02), matteMat);
    wing.position.set(0, B.roof+0.02, -half+0.30); wing.rotation.x = -0.16;
    chassis.add(wing);
    for(const sx of [-1,1]){
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.20, 0.14), matteMat);
      st.position.set(sx*W*0.36, B.hood+0.06, -half+0.32);
      chassis.add(st);
    }
  } else if(B.spoiler === 'lip'){
    const s = new THREE.Mesh(new RoundedBoxGeometry(W*0.80, 0.04, 0.16, 2, 0.02), matteMat);
    s.position.set(0, B.hood+0.05, -half+0.28);
    chassis.add(s);
  }

  // ---------- пороги ----------
  for(const sx of [-1,1]){
    const sk = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.10, L*0.44, 2, 0.02), matteMat);
    sk.position.set(sx*(W/2-0.01), 0.20, 0);
    chassis.add(sk);
  }

  // ---------- арки колёс ----------
  const archGeo = new THREE.TorusGeometry(B.archR, 0.055, 6, 16, Math.PI);
  archGeo.rotateY(Math.PI/2);
  for(const zx of [a, -b]){
    for(const sx of [-1,1]){
      const arch = new THREE.Mesh(archGeo, paintMat);
      arch.position.set(sx*(W/2-0.02), wheelR, zx);
      chassis.add(arch);
    }
  }

  // ---------- интерьер ----------
  const dash = new THREE.Mesh(new RoundedBoxGeometry(W*0.86, 0.13, 0.24, 2, 0.03), matteMat);
  dash.position.set(0, B.belt-0.05, B.cabinFront-0.04); chassis.add(dash);
  for(const sx of [-1,1]){
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.14, 0.48, 2, 0.05), darkMat);
    seat.position.set(sx*0.33, B.belt-0.02, B.cabinFront-0.42); chassis.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.58, 0.13, 2, 0.05), darkMat);
    back.position.set(sx*0.33, B.belt+0.26, B.cabinFront-0.64);
    back.rotation.x = 0.12; chassis.add(back);
  }
  const swheel = new THREE.Group();
  swheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 8, 18), matteMat));
  const swhub = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.03,10), darkMat);
  swhub.rotation.x = Math.PI/2; swheel.add(swhub);
  swheel.position.set(0.33, B.belt+0.04, B.cabinFront-0.16);
  swheel.rotation.x = -1.15;
  chassis.add(swheel);

  // ---------- кольцо безопасности ----------
  if(B.cage){
    for(const sx of [-1,1]){
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.62,6), cageMat);
      hoop.position.set(sx*W*0.34, B.roof-0.16, B.cabinRoofRear+0.06);
      hoop.rotation.x = 0.18;
      chassis.add(hoop);
      const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.85,6), cageMat);
      diag.position.set(sx*W*0.30, B.belt+0.28, B.cabinRoofFront-0.24);
      diag.rotation.set(0.9, 0, 0);
      chassis.add(diag);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,W*0.66,6), cageMat);
    top.rotation.z = Math.PI/2;
    top.position.set(0, B.roof-0.16, B.cabinRoofRear+0.06);
    chassis.add(top);
  }

  // номерной знак
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.30, 0.11, 0.02, 2, 0.01),
    mat({color:0xe8e8e8, roughness:0.5, metalness:0.1}));
  plate.position.set(0, 0.50, -half-0.01);
  chassis.add(plate);

  // ---------- колёса ----------
  const wheels = [];
  for(const [zx, isFront] of [[a,true],[-b,false]]){
    for(const sx of [-1,1]){
      const hub = new THREE.Group();
      hub.position.set(sx*track/2, wheelR, zx);
      const spin = new THREE.Group();
      hub.add(spin);
      buildWheelParts(spin, wheelR, wheelW, style.rimStyle, rimMat, tireMat, caliperMat, chromeMat, sx);
      group.add(hub);
      wheels.push({ hub, spin, isFront, side: sx, x: sx*track/2, z: zx, r: wheelR });
    }
  }

  group.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });

  return {
    group, chassis, wheels, paintMat, glassMat, rimMat, caliperMat, headMat, tailMat,
    applyStyle(s){
      paintMat.color.set(s.paint);
      paintMat.metalness = 0.30 + s.metal*0.55;
      paintMat.clearcoat = s.clear;
      rimMat.color.set(s.rim);
      caliperMat.color.set(s.caliper);
      glassMat.opacity = 1 - s.tint;
    },
    setLights(on){ headMat.emissiveIntensity = on ? 2.6 : 0.0; },
    setBrake(v){ tailMat.emissiveIntensity = 0.35 + v*2.2; },
  };
}

function buildWheelParts(spin, r, w, style, rimMat, tireMat, caliperMat, chromeMat){
  const rimR = r*0.63;
  const pts = [
    new THREE.Vector2(rimR, -w/2),
    new THREE.Vector2(rimR+0.018, -w/2+0.035),
    new THREE.Vector2(r-0.055, -w/2+0.075),
    new THREE.Vector2(r, -w/2+0.105),
    new THREE.Vector2(r, w/2-0.105),
    new THREE.Vector2(r-0.055, w/2-0.075),
    new THREE.Vector2(rimR+0.018, w/2-0.035),
    new THREE.Vector2(rimR, w/2),
  ];
  const tireGeo = new THREE.LatheGeometry(pts, 26);
  tireGeo.rotateZ(-Math.PI/2);
  spin.add(new THREE.Mesh(tireGeo, tireMat));

  const barrelGeo = new THREE.CylinderGeometry(rimR*0.95, rimR*0.95, w*0.66, 22, 1, true);
  barrelGeo.rotateZ(-Math.PI/2);
  spin.add(new THREE.Mesh(barrelGeo, rimMat));

  const faceGeo = new THREE.CylinderGeometry(rimR*0.93, rimR*0.93, 0.035, 22);
  faceGeo.rotateZ(-Math.PI/2);
  const face = new THREE.Mesh(faceGeo, rimMat);
  face.position.x = w*0.30;
  spin.add(face);

  const counts = { mesh:10, star:5, deep:0, work:12 };
  const thick = { mesh:0.030, star:0.075, deep:0, work:0.022 };
  const n = counts[style] ?? 10;
  if(n > 0){
    const spGeo = new THREE.BoxGeometry(0.045, rimR*0.82, thick[style]||0.03);
    for(let i=0;i<n;i++){
      const sp = new THREE.Mesh(spGeo, rimMat);
      sp.position.y = rimR*0.44;
      sp.rotation.x = i*Math.PI*2/n + (style==='work'? (i%2)*0.12 : 0);
      spin.add(sp);
    }
  } else {
    const lipGeo = new THREE.TorusGeometry(rimR*0.92, 0.028, 6, 22);
    lipGeo.rotateY(Math.PI/2);
    const lip = new THREE.Mesh(lipGeo, rimMat);
    lip.position.x = w*0.30;
    spin.add(lip);
  }

  const discGeo = new THREE.CylinderGeometry(rimR*0.62, rimR*0.62, 0.026, 20);
  discGeo.rotateZ(-Math.PI/2);
  const disc = new THREE.Mesh(discGeo, chromeMat);
  disc.position.x = -w*0.06;
  spin.add(disc);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.20), caliperMat);
  cal.position.set(0, rimR*0.40, 0.06);
  spin.add(cal);

  const capGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.04, 12);
  capGeo.rotateZ(-Math.PI/2);
  const cap = new THREE.Mesh(capGeo, rimMat);
  cap.position.x = w*0.33;
  spin.add(cap);
}
