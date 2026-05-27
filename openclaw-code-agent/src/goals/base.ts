// =============================================================================
// Goals — Base Engine
// =============================================================================
// Shared types and abstract base class for all goal engines.  Every goal
// (verifier, ralph, etc.) extends GoalEngine and implements the iteration
// loop in its own way.
//
// Section 9 of the specification.

import type { GoalTask, GoalState } from "../types";

/**
 * Abstract base class for all goal engines.
 * A GoalEngine manages a long-running task by repeatedly iterating until
 * the task reaches a terminal state (completed, failed, or stopped).
 */
export abstract class GoalEngine {
  protected task?: GoalTask;
  protected timer?: ReturnType<typeof setInterval>;
  protected _status: GoalState = "stopped";

  /** Start the goal engine with the given task. */
  abstract start(task: GoalTask): Promise<void>;

  /** Stop the goal engine and any underlying resources. */
  abstract stop(): Promise<void>;

  /** Return the current engine status. */
  getStatus(): GoalState {
    return this._status;
  }

  /** Return the task currently being processed (if any). */
  getTask(): GoalTask | undefined {
    return this.task;
  }
}
