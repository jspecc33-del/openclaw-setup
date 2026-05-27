// =============================================================================
// Goals — Ralph Engine
// =============================================================================
// RalphGoal implements a "signal-hunting" loop: it launches a coding session,
// periodically checks the session output for a completion signal string
// (e.g. "DONE"), and marks the goal complete when the signal is found.
//
//  * signal found    → mark goal completed
//  * not found       → continue session, schedule next check
//  * maxIterations   → mark goal failed
//
// Section 9.2 of the specification.

import { GoalEngine } from "./base";
import type { GoalTask, GoalState } from "../types";

// Placeholder imports — real implementations live in sibling modules
import { SessionLifecycle } from "../sessions/lifecycle";
import { SessionStore } from "../sessions/store";

export class RalphGoal extends GoalEngine {
  private lifecycle: SessionLifecycle;
  private store: SessionStore;
  private iterationTimer?: ReturnType<typeof setTimeout>;
  private iterationDelayMs: number = 5000;

  constructor(lifecycle: SessionLifecycle, store: SessionStore) {
    super();
    this.lifecycle = lifecycle;
    this.store = store;
  }

  /**
   * Launch a coding session with the goal instructions, then begin polling
   * the output buffer for the completion signal.
   */
  async start(task: GoalTask): Promise<void> {
    this.task = task;
    this._status = "running";

    const session = await this.lifecycle.launch({
      name: task.name,
      workdir: task.workdir,
      instructions: task.target,
    });

    task.sessionId = session.id;
    this.store.update(session.id, { goalTaskId: task.id, state: "active" });

    this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
  }

  /**
   * One iteration of the Ralph loop:
   * 1. Fetch buffered output from the session.
   * 2. Search for the completion signal.
   * 3. Update goal state accordingly.
   */
  async iterate(): Promise<void> {
    if (!this.task || this._status !== "running") return;

    const task = this.task;

    // Guard: max iterations
    if (task.currentIteration >= task.maxIterations) {
      this._status = "failed";
      task.state = "failed";
      task.lastOutput = `Max iterations (${task.maxIterations}) reached without completion signal. Goal failed.`;
      task.updatedAt = new Date().toISOString();
      await this.lifecycle.kill(task.sessionId, "max_iterations_reached");
      return;
    }

    // Read the latest output from the session buffer
    const output = this.store.getOutput(task.sessionId);
    task.lastOutput = output;
    task.currentIteration += 1;
    task.updatedAt = new Date().toISOString();

    // Check for the completion signal in the buffered output
    if (task.completionSignal && output.includes(task.completionSignal)) {
      this._status = "completed";
      task.state = "completed";
      task.completedAt = new Date().toISOString();
      await this.lifecycle.kill(task.sessionId, "goal_completed");
      return;
    }

    // Signal not found yet — schedule another check
    this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
  }

  /**
   * Stop the goal engine and kill the underlying session.
   */
  async stop(): Promise<void> {
    if (this.iterationTimer) {
      clearTimeout(this.iterationTimer);
      this.iterationTimer = undefined;
    }
    this._status = "stopped";
    if (this.task) {
      this.task.state = "stopped";
      this.task.updatedAt = new Date().toISOString();
      await this.lifecycle.kill(this.task.sessionId, "goal_stopped");
    }
  }
}
