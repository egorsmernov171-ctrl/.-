// ============ 3D-шоурум для гаража ============
import * as THREE from 'three';
import { buildCar } from './carbuilder.js';
import { Environment } from './env.js';

export class Showroom {
  constructor(renderer){
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.camera.position.set(6.2, 2.4, 7.0);
    this.camera.lookAt(0, 0.75, 0);

    this.env = new Environment(this.scene, renderer);
    this.env.apply('sunset', 400);

    // платформа
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.8, 0.14, 64),
      new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.35, metalness: 0.6 }));
    disc.position.y = -0.07;
    this.scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.62, 0.05, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2d55, emissiveIntensity: 2.2, roughness: 0.4 }));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.01;
    this.scene.add(ring);

    // студийный свет
    const s1 = new THREE.SpotLight(0xffffff, 120, 30, 0.6, 0.4, 1.6);
    s1.position.set(6, 9, 6);
    this.scene.add(s1);
    const s2 = new THREE.SpotLight(0x88bbff, 70, 30, 0.7, 0.5, 1.6);
    s2.position.set(-7, 6, -5);
    this.scene.add(s2);
    const s3 = new THREE.PointLight(0xff7755, 40, 26, 2);
    s3.position.set(0, 2.5, -7);
    this.scene.add(s3);

    this.car = null;
    this.angle = 0.6;
    this.def = null;
  }

  setCar(def, style){
    if(this.car){ this.scene.remove(this.car.group); }
    this.def = def;
    this.car = buildCar(def, style);
    this.car.setLights(true);
    this.car.group.rotation.y = this.angle;
    this.scene.add(this.car.group);
  }

  applyStyle(style){
    if(this.car) this.car.applyStyle(style);
  }

  update(dt){
    this.angle += dt*0.28;
    if(this.car) this.car.group.rotation.y = this.angle;
    this.camera.position.set(Math.sin(this.angle*0.25)*2.2 + 5.6, 2.3 + Math.sin(this.angle*0.5)*0.25, Math.cos(this.angle*0.25)*2.2 + 6.4);
    this.camera.lookAt(0, 0.72, 0);
    if(this.car){
      for(const w of this.car.wheels) w.spin.rotation.x += dt*0.6;
    }
  }

  render(){
    this.renderer.render(this.scene, this.camera);
  }
}
