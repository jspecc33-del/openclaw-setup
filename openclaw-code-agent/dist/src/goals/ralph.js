// =============================================================================
// Goals — Ralph Engine
// =============================================================================
import { GoalEngine } from "./base";
export class RalphGoal extends GoalEngine {
    lifecycle;
    store;
    iterationTimer;
    iterationDelayMs = 5000;
    constructor(lifecycle, store) {
        super();
        this.lifecycle = lifecycle;
        this.store = store;
    }
    async start(task) {
        this.task = task;
        this._status = "running";
        const session = await this.lifecycle.launch({ name: task.name, workdir: task.workdir, instructions: task.target });
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
            task.lastOutput = `Max iterations (${task.maxIterations}) reached without completion signal. Goal failed.`;
            task.updatedAt = new Date().toISOString();
            await this.lifecycle.kill(task.sessionId, "max_iterations_reached");
            return;
        }
        const output = this.store.getOutput(task.sessionId);
        task.lastOutput = output;
        task.currentIteration += 1;
        task.updatedAt = new Date().toISOString();
        if (task.completionSignal && output.includes(task.completionSignal)) {
            this._status = "completed";
            task.state = "completed";
            task.completedAt = new Date().toISOString();
            await this.lifecycle.kill(task.sessionId, "goal_completed");
            return;
        }
        this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
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
//# sourceMappingURL=ralph.js.map