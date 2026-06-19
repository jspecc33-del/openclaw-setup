// =============================================================================
// Goals — Base Engine
// =============================================================================
// Shared types and abstract base class for all goal engines.  Every goal
// (verifier, ralph, etc.) extends GoalEngine and implements the iteration
// loop in its own way.
//
// Section 9 of the specification.
/**
 * Abstract base class for all goal engines.
 * A GoalEngine manages a long-running task by repeatedly iterating until
 * the task reaches a terminal state (completed, failed, or stopped).
 */
export class GoalEngine {
    task;
    timer;
    _status = "stopped";
    /** Return the current engine status. */
    getStatus() {
        return this._status;
    }
    /** Return the task currently being processed (if any). */
    getTask() {
        return this.task;
    }
}
//# sourceMappingURL=base.js.map