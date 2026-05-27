import type { GoalTask, GoalState } from "../types";
/**
 * Abstract base class for all goal engines.
 * A GoalEngine manages a long-running task by repeatedly iterating until
 * the task reaches a terminal state (completed, failed, or stopped).
 */
export declare abstract class GoalEngine {
    protected task?: GoalTask;
    protected timer?: ReturnType<typeof setInterval>;
    protected _status: GoalState;
    /** Start the goal engine with the given task. */
    abstract start(task: GoalTask): Promise<void>;
    /** Stop the goal engine and any underlying resources. */
    abstract stop(): Promise<void>;
    /** Return the current engine status. */
    getStatus(): GoalState;
    /** Return the task currently being processed (if any). */
    getTask(): GoalTask | undefined;
}
//# sourceMappingURL=base.d.ts.map