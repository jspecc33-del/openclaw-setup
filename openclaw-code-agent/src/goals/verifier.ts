// =============================================================================
// Goals — Verifier Engine
// =============================================================================
// VerifierGoal implements a "test-until-pass" loop: it launches a coding
// session, waits for the session to emit output, then runs an external
// verifier command (e.g. `pnpm test`).
//
//  * exit 0  → mark goal completed
//  * non-zero → feed output back into the session as a follow-up prompt
//  * maxIterations reached → mark goal failed
//
// Section 9.1 of the specification.

import { execSync } from "node:child_process";
import { GoalEngine } from "./base";
import type { GoalTask, GoalState } from "../types";

// Placeholder imports — real implementations live in sibling modules
import { SessionLifecycle } from "../sessions/lifecycle";
import { SessionStore } from "../sessions/store";

export class VerifierGoal extends GoalEngine {
  private lifecycle: SessionLifecycle;
  private store: SessionStore;
  private iterationTimer?: ReturnType<typeof setTimeout>;
  private iterationDelayMs: number = 5000;
  // Resolved workdir from the launched session (may be a worktree path)
  private sessionWorkdir?: string;

  constructor(lifecycle: SessionLifecycle, store: SessionStore) {
    super();
    this.lifecycle = lifecycle;
    this.store = store;
  }

  /**
   * Launch a coding session for the goal task, then enter the iterate loop.
   */
  async start(task: GoalTask): Promise<void> {
    this.task = task;
    this._status = "running";

    // Launch the underlying coding session via the lifecycle manager
    const session = await this.lifecycle.launch({
      name: task.name,
      workdir: task.workdir,
      instructions: task.target,
    });

    // Capture the session's actual workdir (may be an isolated worktree path)
    this.sessionWorkdir = session.workdir;

    // Link the session back to the goal task
    task.sessionId = session.id;
    this.store.update(session.id, { goalTaskId: task.id, state: "active" });

    // Begin the first iteration after a short delay to let the session start
    this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
  }

  /**
   * One iteration of the verifier loop:
   * 1. Read the latest buffered output from the session.
   * 2. Run the verifier command in the session's working directory.
   * 3. Interpret the exit code and update goal state.
   */
  async iterate(): Promise<void> {
    if (!this.task || this._status !== "running") return;

    const task = this.task;

    // Guard: do not exceed max iterations
    if (task.currentIteration >= task.maxIterations) {
      this._status = "failed";
      task.state = "failed";
      task.lastOutput = `Max iterations (${task.maxIterations}) reached. Goal failed.`;
      task.updatedAt = new Date().toISOString();
      await this.lifecycle.kill(task.sessionId, "max_iterations_reached");
      return;
    }

    // Run the verifier command in the session's actual workdir so it tests
    // the agent's changes rather than the base checkout.
    let output: string;
    let exitCode: number = 0;
    try {
      output = execSync(task.verifierCommand!, {
        cwd: this.sessionWorkdir ?? task.workdir,
        encoding: "utf-8",
        timeout: 60000,
      });
    } catch (err: any) {
      output = err.stdout?.toString() ?? "";
      output += err.stderr?.toString() ?? "";
      exitCode = err.status ?? 1;
    }

    task.lastOutput = output;
    task.currentIteration += 1;
    task.updatedAt = new Date().toISOString();

    if (exitCode === 0) {
      // Verifier passed — goal is complete
      this._status = "completed";
      task.state = "completed";
      task.completedAt = new Date().toISOString();
      await this.lifecycle.kill(task.sessionId, "goal_completed");
    } else {
      // Verifier failed — send the output back to the session as a follow-up
      await this.lifecycle.respond(
        task.sessionId,
        `Verifier failed (iteration ${task.currentIteration}/${task.maxIterations}):\n\n${output}\n\nPlease fix the issues and try again.`
      );

      // Schedule the next iteration
      this.iterationTimer = setTimeout(() => this.iterate(), this.iterationDelayMs);
    }
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
