import { GoalEngine } from "./base";
import type { GoalTask } from "../types";
import { SessionLifecycle } from "../sessions/lifecycle";
import { SessionStore } from "../sessions/store";
export declare class VerifierGoal extends GoalEngine {
    private lifecycle;
    private store;
    private iterationTimer?;
    private iterationDelayMs;
    constructor(lifecycle: SessionLifecycle, store: SessionStore);
    /**
     * Launch a coding session for the goal task, then enter the iterate loop.
     */
    start(task: GoalTask): Promise<void>;
    /**
     * One iteration of the verifier loop:
     * 1. Read the latest buffered output from the session.
     * 2. Run the verifier command in the working directory.
     * 3. Interpret the exit code and update goal state.
     */
    iterate(): Promise<void>;
    /**
     * Stop the goal engine and kill the underlying session.
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=verifier.d.ts.map