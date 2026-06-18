import { GoalEngine } from "./base";
import type { GoalTask } from "../types";
import { SessionLifecycle } from "../sessions/lifecycle";
import { SessionStore } from "../sessions/store";
export declare class RalphGoal extends GoalEngine {
    private lifecycle;
    private store;
    private iterationTimer?;
    private iterationDelayMs;
    constructor(lifecycle: SessionLifecycle, store: SessionStore);
    /**
     * Launch a coding session with the goal instructions, then begin polling
     * the output buffer for the completion signal.
     */
    start(task: GoalTask): Promise<void>;
    /**
     * One iteration of the Ralph loop:
     * 1. Fetch buffered output from the session.
     * 2. Search for the completion signal.
     * 3. Update goal state accordingly.
     */
    iterate(): Promise<void>;
    /**
     * Stop the goal engine and kill the underlying session.
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=ralph.d.ts.map