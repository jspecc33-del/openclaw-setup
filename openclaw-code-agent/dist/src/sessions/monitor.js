// ============================================================
// OpenClaw Code Agent — Session Monitor
// ============================================================
// Periodic health checks: timeouts, zombie detection, and
// auto-cleanup of completed session output.
export class Monitor {
    store;
    lifecycle;
    config;
    intervalMs;
    intervalId;
    constructor(store, lifecycle, config) {
        this.store = store;
        this.lifecycle = lifecycle;
        this.config = config;
        this.intervalMs = 30000; // 30 seconds
        this.intervalId = null;
    }
    /** Start the periodic monitor loop. */
    start() {
        if (this.intervalId)
            return; // Already running
        this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    }
    /** Stop the periodic monitor loop. */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    // --- Tick --------------------------------------------------
    async tick() {
        const sessions = this.store.list();
        const now = Date.now();
        for (const session of sessions) {
            await this.checkTimeout(session, now);
            await this.checkZombie(session);
            this.checkAutoCleanup(session, now);
        }
    }
    // --- Timeout check -----------------------------------------
    async checkTimeout(session, now) {
        if (session.state !== "active" && session.state !== "awaiting_plan_approval") {
            return;
        }
        const createdAt = new Date(session.createdAt).getTime();
        if (now - createdAt > this.config.maxSessionDurationMs) {
            await this.lifecycle.kill(session.id, `Session exceeded max duration (${this.config.maxSessionDurationMs}ms)`);
        }
    }
    // --- Zombie detection --------------------------------------
    async checkZombie(session) {
        if (session.state !== "active" && session.state !== "completing") {
            return;
        }
        const harness = this.lifecycle.getHarness(session.id);
        if (!harness)
            return;
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
        }
        catch {
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
    checkAutoCleanup(session, now) {
        if (session.state !== "completed" && session.state !== "killed") {
            return;
        }
        if (!session.completedAt)
            return;
        const completedTime = new Date(session.completedAt).getTime();
        if (now - completedTime > this.config.autoCleanupCompletedAfterMs) {
            this.store.clearOutput(session.id);
        }
    }
}
//# sourceMappingURL=monitor.js.map