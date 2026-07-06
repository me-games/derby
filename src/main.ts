import * as THREE from "three";
import { initGameSentry, sentryCanvasSnapshot } from "@genex-ai/embed-sdk/sentry";
import { initEmbed, waitForPlayer } from "@genex-ai/embed-sdk";
import { GENEX } from "./genex.config.ts";
import { PhysicsWorld } from "./controllers/shared/physics-world.ts";
import { KeyboardInput } from "./controllers/character/keyboard-input.ts";
import { TouchJoystick, VirtualButton } from "./controllers/character/touch-joystick.ts";
import { FollowCamera } from "./controllers/character/follow-camera.ts";
import { createArena, FALL_ELIMINATION_Y } from "./game/arena.ts";
import { loadCarBodyTemplate, makeCarBodyInstance, buildCar } from "./game/car.ts";
import { RemotePlayers } from "./game/remotePlayers.ts";
import { MultiplayerSession } from "./net/multiplayer.ts";
import { Hud } from "./ui/hud.ts";

initGameSentry({ slug: GENEX.slug });
initEmbed({ slug: GENEX.slug, apiUrl: GENEX.apiUrl, dashboardOrigins: GENEX.dashboardOrigins });

const SPAWN_RADIUS = 7;
const BUMP_SOUND_COOLDOWN_MS = 220;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app");

const hud = new Hud();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.style.touchAction = "none";
app.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function randomSpawn(): { position: THREE.Vector3; angle: number } {
  const angle = Math.random() * Math.PI * 2;
  const position = new THREE.Vector3(
    Math.cos(angle) * SPAWN_RADIUS,
    1.4,
    Math.sin(angle) * SPAWN_RADIUS
  );
  return { position, angle };
}

async function boot(): Promise<void> {
  hud.setLoading("Spinning up physics…");
  const physics = await PhysicsWorld.create();

  hud.setLoading("Building the arena…");
  await createArena(scene, renderer, physics);

  hud.setLoading("Painting your bumper car…");
  const carTemplate = await loadCarBodyTemplate();

  // Sound effects load in the background — never block the game on audio
  // decoding, which can hang in some browser environments.
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const audioLoader = new THREE.AudioLoader();
  const bumpSound = new THREE.Audio(listener);
  bumpSound.setVolume(0.6);
  const eliminateSound = new THREE.Audio(listener);
  eliminateSound.setVolume(0.8);
  audioLoader
    .loadAsync("./assets/sfx/cartoon-toy-car-bump-collision-thud.mp3")
    .then((buffer) => bumpSound.setBuffer(buffer))
    .catch(() => {});
  audioLoader
    .loadAsync("./assets/sfx/arcade-game-elimination-buzzer-zap.mp3")
    .then((buffer) => eliminateSound.setBuffer(buffer))
    .catch(() => {});

  const spawn = randomSpawn();
  const localCar = buildCar(
    physics,
    scene,
    makeCarBodyInstance(carTemplate),
    spawn.position,
    spawn.angle + Math.PI
  );

  let lastBumpSoundAt = -Infinity;
  for (const collider of localCar.chassisColliders) {
    physics.setColliderEvents(collider, {
      onCollisionEnter: () => {
        const now = performance.now();
        if (now - lastBumpSoundAt < BUMP_SOUND_COOLDOWN_MS) return;
        lastBumpSoundAt = now;
        if (!bumpSound.buffer) return;
        if (bumpSound.isPlaying) bumpSound.stop();
        bumpSound.play();
      },
    });
  }

  const kb = new KeyboardInput();
  const isTouch = navigator.maxTouchPoints > 0;
  const joystick = new TouchJoystick({ wrapperStyle: { left: "24px", bottom: "24px" } });
  joystick.setVisible(isTouch);
  const brakeButton = new VirtualButton({
    label: "Brake",
    wrapperStyle: { right: "24px", bottom: "34px" },
  });
  brakeButton.setVisible(isTouch);

  const followCam = new FollowCamera(camera, {
    domElement: renderer.domElement,
    initialDistance: 9,
    initialPolarAngle: Math.PI / 2.5,
    headingAlignGain: 4,
  });

  const remotePlayers = new RemotePlayers(physics, scene, carTemplate);

  let localEliminated = false;

  function respawnLocalCar(): void {
    const next = randomSpawn();
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      next.angle + Math.PI
    );
    localCar.car.body.setTranslation(next.position, true);
    localCar.car.body.setRotation(rotation, true);
    localCar.car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    localCar.car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    localEliminated = false;
  }

  const mp = new MultiplayerSession();
  mp.onMatched = () => {
    hud.setBanner(null);
    mp.onLeave((id) => remotePlayers.remove(id));
  };
  mp.onMatchEnded = (result) => {
    const iWon = result.winnerId !== null && result.winnerId === mp.selfId;
    remotePlayers.disposeAll();
    hud.showOverlay(
      iWon ? "You win!" : "Round over",
      localEliminated ? "Waiting for a new round…" : "Better luck next round.",
      () => {
        hud.hideOverlay();
        respawnLocalCar();
      }
    );
  };

  // Rendering and driving start right away — sign-in and matchmaking happen
  // in the background so a slow/blocked identity check never blanks the game.
  hud.hideLoading();
  hud.setBanner("Signing you in…");

  void (async () => {
    await waitForPlayer();
    hud.setBanner("Finding opponents…");
    try {
      await mp.start();
    } catch {
      hud.setBanner("Multiplayer unavailable — practicing solo.");
    }
  })();

  physics.onBeforeStep(() => {
    if (mp.isMatched) {
      remotePlayers.syncFromNetwork(mp.players, mp.selfId ?? "");
    }
    const movement = localEliminated
      ? { forward: false, backward: false, steerLeft: false, steerRight: false, brake: true }
      : { ...kb.getCarMovement(), joystickL: { x: joystick.x, y: joystick.y } };
    if (!localEliminated && brakeButton.pressed) movement.brake = true;
    localCar.car.setMovement(movement);
    localCar.car.update();
  });

  const clock = new THREE.Clock();
  let hudTimer = 0;

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    physics.step(delta);

    mp.updateLocalPose(localCar.chassisObject.position, localCar.chassisObject.quaternion);

    if (!localEliminated && localCar.chassisObject.position.y < FALL_ELIMINATION_Y) {
      localEliminated = true;
      mp.reportEliminated();
      if (eliminateSound.buffer) {
        if (eliminateSound.isPlaying) eliminateSound.stop();
        eliminateSound.play();
      }
      hud.showOverlay("You're out!", "Watching the rest of the round…");
    }

    followCam.moveTo(
      localCar.chassisObject.position.x,
      localCar.chassisObject.position.y + 1,
      localCar.chassisObject.position.z,
      true
    );
    followCam.setUp(localCar.car.upAxis);
    followCam.alignHeading(localCar.car.bodyZAxis, delta);
    followCam.update(delta);

    hudTimer += delta;
    if (hudTimer > 0.3) {
      hudTimer = 0;
      if (mp.isMatched) {
        hud.setRacers(`Racers left: ${remotePlayers.count() + 1}`);
      } else {
        hud.setRacers(null);
        const info = mp.matchmakingInfo;
        if (info && info.status === "searching") {
          hud.setBanner(`Finding opponents… (${info.queue.position}/${info.queue.size} in line)`);
        }
      }
    }

    renderer.render(scene, camera);
    sentryCanvasSnapshot(renderer.domElement);
  });
}

boot().catch((err) => {
  console.error(err);
  hud.setLoading("Something went wrong loading the game.");
});
