// ============ Небо, освещение, время суток, отражения ============
import * as THREE from 'three';

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uTop, uHorizon, uBottom, uSunColor, uSunDir;
uniform float uStars, uHaze;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(up, 0.55));
  col = mix(col, uBottom, pow(clamp(-d.y, 0.0, 1.0), 0.45));
  vec3 sd = normalize(uSunDir);
  float s = max(dot(d, sd), 0.0);
  col += uSunColor * pow(s, 1200.0) * 8.0;
  col += uSunColor * pow(s, 14.0) * 0.30 * uHaze;
  col = mix(col, uHorizon, pow(1.0 - abs(d.y), 8.0) * 0.35 * uHaze);
  if(uStars > 0.001){
    vec3 q = floor(d * 260.0);
    float r = fract(sin(dot(q, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    float star = smoothstep(0.9965, 1.0, r) * uStars * clamp(up * 1.4, 0.0, 1.0);
    col += vec3(star) * (0.6 + 0.4*sin(r*30.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const PRESETS = {
  day: {
    top:'#2f6fd0', horizon:'#a8c6e8', bottom:'#1b1e24', sun:'#fff6e0',
    sunDir: new THREE.Vector3(0.45, 0.62, 0.35),
    sunColor:'#fff4dd', sunInt:3.1, hemiSky:'#9fc0ea', hemiGround:'#4a4436', hemiInt:0.75,
    fog:'#a9c3dd', fogNear:60, fogFar:520, stars:0, haze:0.5, exposure:1.0,
  },
  sunset: {
    top:'#1d3a6b', horizon:'#ff9a4d', bottom:'#241a18', sun:'#ffd9a0',
    sunDir: new THREE.Vector3(-0.75, 0.16, -0.25),
    sunColor:'#ffb066', sunInt:2.4, hemiSky:'#6f7fb0', hemiGround:'#3a2c22', hemiInt:0.55,
    fog:'#c9703f', fogNear:50, fogFar:420, stars:0.15, haze:1.0, exposure:1.05,
  },
  night: {
    top:'#04060f', horizon:'#131b2c', bottom:'#05070a', sun:'#8fa8d8',
    sunDir: new THREE.Vector3(0.3, 0.55, -0.4),
    sunColor:'#8fa8d8', sunInt:0.35, hemiSky:'#1a2438', hemiGround:'#0a0c10', hemiInt:0.35,
    fog:'#0a0e18', fogNear:30, fogFar:330, stars:1.0, haze:0.25, exposure:1.25,
  },
};

export class Environment {
  constructor(scene, renderer){
    this.scene = scene;
    this.renderer = renderer;
    this.preset = 'day';

    const geo = new THREE.SphereGeometry(1200, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0.4,0.6,0.3) },
        uStars: { value: 0 }, uHaze: { value: 0.5 },
      },
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    const s = 90;
    this.sun.shadow.camera.left = -s; this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s; this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9fc0ea, 0x4a4436, 0.7);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(this.amb);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envScene = new THREE.Scene();
    this.envScene.add(this.sky);
    this.envTex = null;
  }

  apply(name, drawDist){
    const p = PRESETS[name] || PRESETS.day;
    this.preset = name;
    const u = this.skyMat.uniforms;
    u.uTop.value.set(p.top).convertSRGBToLinear();
    u.uHorizon.value.set(p.horizon).convertSRGBToLinear();
    u.uBottom.value.set(p.bottom).convertSRGBToLinear();
    u.uSunColor.value.set(p.sun).convertSRGBToLinear();
    u.uSunDir.value.copy(p.sunDir).normalize();
    u.uStars.value = p.stars;
    u.uHaze.value = p.haze;

    this.sun.position.copy(p.sunDir).normalize().multiplyScalar(180);
    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunInt;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiInt;
    this.amb.intensity = name === 'night' ? 0.16 : 0.12;

    if(this.scene.fog){
      this.scene.fog.color.set(p.fog);
      this.scene.fog.near = p.fogNear;
      this.scene.fog.far = Math.max(180, drawDist || p.fogFar);
    }
    this.renderer.toneMappingExposure = p.exposure;

    // перегенерация окружения для отражений
    if(this.envTex) this.envTex.dispose();
    this.envTex = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.scene.environment = this.envTex.texture;
    this.scene.background = this.envTex.texture;
    // сценарий: фон рисуем небом, а не env-текстурой
    this.scene.background = null;
    this.isNight = name === 'night';
  }

  update(carPos){
    this.sun.target.position.copy(carPos);
    this.sun.position.copy(carPos).add(this.skyMat.uniforms.uSunDir.value.clone().multiplyScalar(180));
    this.sky.position.set(carPos.x, 0, carPos.z);
  }
}
