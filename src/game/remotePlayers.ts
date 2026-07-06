import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "../controllers/shared/physics-world.ts";
import { cuboidCollider } from "../controllers/shared/colliders.ts";
import type { CarState } from "./types.ts";

const PROXY_HALF_EXTENTS: [number, number, number] = [1.1, 0.5, 2.5];
const SUNKEN_Y = -60;

interface RemoteCar {
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
}

export interface NetworkPlayer {
  id: string;
  state: CarState;
}

/**
 * Each remote player's car is mirrored locally as a kinematic Rapier body
 * driven by their (already-smoothed) network state — so the LOCAL dynamic
 * car can physically bump against it, while the remote client stays the
 * true authority over its own simulation.
 */
export class RemotePlayers {
  private readonly cars = new Map<string, RemoteCar>();

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scene: THREE.Scene,
    private readonly template: THREE.Object3D
  ) {}

  private ensure(id: string): RemoteCar {
    let entry = this.cars.get(id);
    if (entry) return entry;
    const object = this.template.clone(true);
    this.scene.add(object);
    const body = this.physics.createBody(
      { type: "kinematicPosition", position: [0, SUNKEN_Y, 0] },
      object
    );
    cuboidCollider(this.physics.world, body, PROXY_HALF_EXTENTS, { friction: 0.5 });
    entry = { object, body };
    this.cars.set(id, entry);
    return entry;
  }

  syncFromNetwork(players: Iterable<NetworkPlayer>, selfId: string): void {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === selfId || !p.state) continue;
      seen.add(p.id);
      const entry = this.ensure(p.id);
      if (!p.state.alive) {
        entry.body.setNextKinematicTranslation({ x: 0, y: SUNKEN_Y, z: 0 });
        continue;
      }
      entry.body.setNextKinematicTranslation({ x: p.state.x, y: p.state.y, z: p.state.z });
      const q = p.state.q ?? [0, 0, 0, 1];
      entry.body.setNextKinematicRotation({ x: q[0], y: q[1], z: q[2], w: q[3] });
    }
    for (const id of [...this.cars.keys()]) {
      if (!seen.has(id)) this.remove(id);
    }
  }

  remove(id: string): void {
    const entry = this.cars.get(id);
    if (!entry) return;
    this.scene.remove(entry.object);
    this.physics.removeBody(entry.body);
    this.cars.delete(id);
  }

  count(): number {
    return this.cars.size;
  }

  disposeAll(): void {
    for (const id of [...this.cars.keys()]) this.remove(id);
  }
}
