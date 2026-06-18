import type { WorktreeLifecycleState } from "../types";
/**
 * Manages the lifecycle state machine for worktree sessions.
 * Tracks transitions and enforces valid state changes.
 */
export declare class WorktreeLifecycle {
    /** In-memory store of sessionId → current state */
    private states;
    /** History of transitions for audit: sessionId → array of { from, to, at } */
    private history;
    /**
     * Transition a session's worktree to a new state.
     * Validates the transition against the state machine rules.
     *
     * @param sessionId — the session identifier
     * @param to — the target state
     * @throws if the transition is invalid
     */
    transition(sessionId: string, to: WorktreeLifecycleState): void;
    /**
     * Get the current worktree lifecycle state for a session.
     * Defaults to "active" if no state has been set.
     *
     * @param sessionId — the session identifier
     * @returns the current state
     */
    getState(sessionId: string): WorktreeLifecycleState;
    /**
     * Initialize the state for a new session.
     *
     * @param sessionId — the session identifier
     * @param initial — the initial state (default: "active")
     */
    initialize(sessionId: string, initial?: WorktreeLifecycleState): void;
    /**
     * Get the transition history for a session.
     *
     * @param sessionId — the session identifier
     * @returns array of transition records
     */
    getHistory(sessionId: string): Array<{
        from: WorktreeLifecycleState;
        to: WorktreeLifecycleState;
        at: string;
    }>;
    /**
     * Get a human-readable description of a state.
     */
    describeState(state: WorktreeLifecycleState): string;
    /**
     * Check if a transition would be valid without executing it.
     *
     * @param sessionId — the session identifier
     * @param to — the target state
     * @returns true if the transition is valid
     */
    canTransition(sessionId: string, to: WorktreeLifecycleState): boolean;
    /**
     * Remove all state and history for a session (cleanup).
     *
     * @param sessionId — the session identifier
     */
    cleanup(sessionId: string): void;
}
//# sourceMappingURL=lifecycle.d.ts.map