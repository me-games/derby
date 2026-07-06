import * as THREE from "three";
import { matchmake, type Matchmaking, type MatchmakingView } from "@genex-ai/multiplayer";
import { getColyseusAuth } from "@genex-ai/embed-sdk";
import { GENEX } from "../genex.config.ts";
import type { CarState } from "../game/types.ts";
import type { NetworkPlayer } from "../game/remotePlayers.ts";

export interface MatchEndedResult {
  winnerId: string | null;
  loserId?: string | null;
  draw?: boolean;
  scores?: Record<string, number>;
}

const TICK_MS = 66;

export class MultiplayerSession {
  private handle: Matchmaking<CarState> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private eliminatedFlag = false;
  private latestState: CarState = { x: 0, y: 0, z: 0, q: [0, 0, 0, 1], alive: true };

  onMatched: (() => void) | null = null;
  onMatchEnded: ((result: MatchEndedResult) => void) | null = null;

  async start(): Promise<void> {
    const mm = await matchmake<CarState>({
      url: GENEX.colyseusUrl,
      room: GENEX.slug,
      auth: () => getColyseusAuth(),
    });
    this.handle = mm;
    mm.on("matched", () => {
      this.eliminatedFlag = false;
      this.startTick();
      this.onMatched?.();
    });
    mm.on("matchEnded", (payload) => {
      this.stopTick();
      this.onMatchEnded?.(payload as MatchEndedResult);
    });
  }

  get isMatched(): boolean {
    return this.handle?.session != null;
  }

  get selfId(): string | null {
    return this.handle?.session?.id ?? null;
  }

  get players(): Iterable<NetworkPlayer> {
    return this.handle?.session?.players.values() ?? [];
  }

  get matchmakingInfo(): MatchmakingView | null {
    return this.handle?.matchmaking ?? null;
  }

  onLeave(cb: (id: string) => void): void {
    this.handle?.session?.on("leave", cb);
  }

  updateLocalPose(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.latestState = {
      x: position.x,
      y: position.y,
      z: position.z,
      q: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      alive: !this.eliminatedFlag,
    };
  }

  reportEliminated(): void {
    if (this.eliminatedFlag) return;
    this.eliminatedFlag = true;
    this.handle?.eliminated();
  }

  private startTick(): void {
    this.stopTick();
    this.tickTimer = setInterval(() => {
      this.handle?.session?.me.set(this.latestState);
    }, TICK_MS);
  }

  private stopTick(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
