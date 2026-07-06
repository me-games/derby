import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import type { PhysicsWorld } from "../controllers/shared/physics-world.ts";
import { cuboidCollider } from "../controllers/shared/colliders.ts";
import { VehicleController } from "../controllers/vehicle/vehicle-controller.ts";
import { vehiclePresets } from "../controllers/vehicle/presets.ts";

const CAR_MODEL_URL = "./assets/models/colorful-toy-bumper-car-with-rounded-rubber-bumper.glb";
const TARGET_WIDTH = 2.1;

const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 20);
wheelGeometry.rotateZ(Math.PI / 2);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.75 });

let cachedTemplate: THREE.Group | null = null;

function createCarLoader(): GLTFLoader {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("./draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

export async function loadCarBodyTemplate(): Promise<THREE.Group> {
  if (cachedTemplate) return cachedTemplate;
  const gltf = await createCarLoader().loadAsync(CAR_MODEL_URL);
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(TARGET_WIDTH / (size.x || 1));

  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBox.min.y;

  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  cachedTemplate = model;
  return model;
}

export function makeCarBodyInstance(template: THREE.Group): THREE.Object3D {
  return template.clone(true);
}

export interface BuiltCar {
  car: VehicleController;
  chassisObject: THREE.Object3D;
  chassisColliders: RAPIER.Collider[];
}

export function buildCar(
  physics: PhysicsWorld,
  scene: THREE.Scene,
  bodyMesh: THREE.Object3D,
  position: THREE.Vector3,
  rotationY = 0
): BuiltCar {
  const preset = vehiclePresets["arcade-kart"];
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const car = new VehicleController({
    world: physics.world,
    position,
    rotation,
    carConfig: preset.carConfig,
  });

  const chassisColliders: RAPIER.Collider[] = [];
  for (const c of preset.chassisColliders) {
    chassisColliders.push(
      cuboidCollider(physics.world, car.body, [c.halfExtents.x, c.halfExtents.y, c.halfExtents.z], {
        position: [c.offset.x, c.offset.y, c.offset.z],
        density: c.density,
        restitution: 0.4,
        friction: 0.5,
      })
    );
  }

  for (const slot of preset.wheelSlots) {
    const wheel = car.addWheel({
      ...preset.wheelShared,
      ...slot,
      position: new THREE.Vector3(slot.position.x, slot.position.y, slot.position.z),
    });
    const mesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
    mesh.castShadow = true;
    wheel.modelObject.add(mesh);
  }

  car.chassisObject.add(bodyMesh);
  scene.add(car.chassisObject);
  physics.registerBody(car.body, car.chassisObject);

  return { car, chassisObject: car.chassisObject, chassisColliders };
}
