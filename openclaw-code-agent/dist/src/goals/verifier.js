// =============================================================================
// Goals — Verifier Engine
// =============================================================================
import { execSync } from "node:child_process";
import { GoalEngine } from "./base";
export class VerifierGoal extends GoalEngine {
    lifecycle;
    store;
    iterationTimer;
    iterationDelayMs = 5000;
    sessionWorkdir;
    constructor(lifecycle, store) {
        super();
        this.lifecycle = lifecycle;
        this.store = store;
    }
    async start(task) {
        this.task = task;
        this._status = "running";
        const session = await this.lifecycle.launch({ name: task.name, workdir: task.workdir, instructions: task.target });
        this.sessionWorkdir = session.workdir;
        task.sessionId = session.id;
        this.store.update(session.id, { goalTaskId: task.id, state: "active" });
        this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
    }
    async iterate() {
        if (!this.task || this._status !== "running") return;
        const task = this.task;
        if (task.currentIteration >= task.maxIterations) {
            this._status = "failed";
            task.state = "failed";
            task.lastOutput = `Max iterations (${task.maxIterations}) reached. Goal failed.`;
            task.updatedAt = new Date().toISOString();
            await this.lifecycle.kill(task.sessionId, "max_iterations_reached");
            return;
        }
        let output;
        let exitCode = 0;
        try {
            output = execSync(task.verifierCommand, { cwd: this.sessionWorkdir ?? task.workdir, encoding: "utf-8", timeout: 60000 });
        } catch (err) {
            output = err.stdout?.toString() ?? "";
            output += err.stderr?.toString() ?? "";
            exitCode = err.status ?? 1;
        }
        task.lastOutput = output;
        task.currentIteration += 1;
        task.updatedAt = new Date().toISOString();
        if (exitCode === 0) {
            this._status = "completed";
            task.state = "completed";
            task.completedAt = new Date().toISOString();
            await this.lifecycle.kill(task.sessionId, "goal_completed");
        } else {
            await this.lifecycle.respond(task.sessionId, `Verifier failed (iteration ${task.currentIteration}/${task.maxIterations}):\n\n${output}\n\nPlease fix the issues and try again.`);
            this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
        }
    }
    async stop() {
        if (this.iterationTimer) { clearTimeout(this.iterationTimer); this.iterationTimer = undefined; }
        this._status = "stopped";
        if (this.task) {
            this.task.state = "stopped";
            this.task.updatedAt = new Date().toISOString();
            await this.lifecycle.kill(this.task.sessionId, "goal_stopped");
        }
    }
}
//# sourceMappingURL=verifier.js.map