import * as THREE from "three";
import type { PhysicsWorld } from "../controllers/shared/physics-world.ts";
import { cylinderCollider } from "../controllers/shared/colliders.ts";

export const ARENA_RADIUS = 20;
export const ARENA_HALF_HEIGHT = 0.5;
export const FALL_ELIMINATION_Y = -8;

export async function createArena(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  physics: PhysicsWorld
): Promise<void> {
  const textureLoader = new THREE.TextureLoader();
  const floorMap = await textureLoader.loadAsync(
    "./assets/textures/yellow-and-black-hazard-stripe-rubber-arena-floor/basecolor.png"
  );
  floorMap.colorSpace = THREE.SRGBColorSpace;
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(6, 6);
  floorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const topMaterial = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.85, metalness: 0.05 });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 });

  const floorGeometry = new THREE.CylinderGeometry(
    ARENA_RADIUS,
    ARENA_RADIUS,
    ARENA_HALF_HEIGHT * 2,
    64,
    1
  );
  const floorMesh = new THREE.Mesh(floorGeometry, [sideMaterial, topMaterial, sideMaterial]);
  floorMesh.position.set(0, -ARENA_HALF_HEIGHT, 0);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const floorBody = physics.createBody(
    { type: "fixed", position: [0, -ARENA_HALF_HEIGHT, 0] },
    floorMesh
  );
  cylinderCollider(physics.world, floorBody, ARENA_HALF_HEIGHT, ARENA_RADIUS, { friction: 0.9 });

  const skyTexture = await textureLoader.loadAsync(
    "./assets/skybox/carnival-fairground-arena-at-dusk-with-string-ligh.jpg"
  );
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTexture;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(skyTexture).texture;

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
  sun.position.set(18, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -ARENA_RADIUS - 5;
  sun.shadow.camera.right = ARENA_RADIUS + 5;
  sun.shadow.camera.top = ARENA_RADIUS + 5;
  sun.shadow.camera.bottom = -ARENA_RADIUS - 5;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.001;
  scene.add(sun);
}
