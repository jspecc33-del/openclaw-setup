// ============================================================
// OpenClaw Code Agent — Session Monitor
// ============================================================
// Periodic health checks: timeouts, zombie detection, and
// auto-cleanup of completed session output.

import { PluginConfig } from "../types";
import { SessionStore } from "./store";
import { SessionLifecycle } from "./lifecycle";

export class Monitor {
  private store: SessionStore;
  private lifecycle: SessionLifecycle;
  private config: PluginConfig;
  private intervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null;

  constructor(
    store: SessionStore,
    lifecycle: SessionLifecycle,
    config: PluginConfig,
  ) {
    this.store = store;
    this.lifecycle = lifecycle;
    this.config = config;
    this.intervalMs = 30000; // 30 seconds
    this.intervalId = null;
  }

  /** Start the periodic monitor loop. */
  start(): void {
    if (this.intervalId) return; // Already running
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
  }

  /** Stop the periodic monitor loop. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // --- Tick --------------------------------------------------

  private async tick(): Promise<void> {
    const sessions = this.store.list();
    const now = Date.now();

    for (const session of sessions) {
      await this.checkTimeout(session, now);
      await this.checkZombie(session);
      this.checkAutoCleanup(session, now);
    }
  }

  // --- Timeout check -----------------------------------------

  private async checkTimeout(session: any, now: number): Promise<void> {
    if (session.state !== "active" && session.state !== "awaiting_plan_approval") {
      return;
    }
    const createdAt = new Date(session.createdAt).getTime();
    if (now - createdAt > this.config.maxSessionDurationMs) {
      await this.lifecycle.kill(
        session.id,
        `Session exceeded max duration (${this.config.maxSessionDurationMs}ms)`,
      );
    }
  }

  // --- Zombie detection --------------------------------------

  private async checkZombie(session: any): Promise<void> {
    if (session.state !== "active" && session.state !== "completing") {
      return;
    }
    const harness = this.lifecycle.getHarness(session.id);
    if (!harness) return;

    try {
      const status = await harness.getStatus();
      if (!status.running && status.exitCode !== undefined) {
        // Process exited but state still active — mark based on exit code
        const isCleanExit = status.exitCode === 0;
        this.store.update(session.id, {
          state: isCleanExit ? "completed" : "failed",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(session.createdAt).getTime(),
        });
        this.lifecycle.removeHarness(session.id);
      }
    } catch {
      // Status check failed — harness may be in bad state
      this.store.update(session.id, {
        state: "failed",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(session.createdAt).getTime(),
      });
      this.lifecycle.removeHarness(session.id);
    }
  }

  // --- Auto-cleanup ------------------------------------------

  private checkAutoCleanup(session: any, now: number): void {
    if (session.state !== "completed" && session.state !== "killed") {
      return;
    }
    if (!session.completedAt) return;

    const completedTime = new Date(session.completedAt).getTime();
    if (now - completedTime > this.config.autoCleanupCompletedAfterMs) {
      this.store.clearOutput(session.id);
    }
  }
}
