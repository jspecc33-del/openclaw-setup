// ============================================================================
// Worktree Lifecycle State Machine
// Spec: Section 7.3
// ============================================================================

import type { WorktreeLifecycleState } from "../types";

/**
 * Valid state transitions for the worktree lifecycle.
 * Map: from-state → array of allowed to-states.
 */
const TRANSITIONS: Record<WorktreeLifecycleState, WorktreeLifecycleState[]> = {
  active: ["pending_decision", "no_change", "dismissed"],
  pending_decision: ["merged", "pr_open", "released", "dismissed"],
  pr_open: ["merged", "released"],
  // Terminal states — no outgoing transitions
  merged: [],
  released: [],
  dismissed: [],
  no_change: [],
};

/**
 * Human-readable descriptions for each state.
 */
const STATE_DESCRIPTIONS: Record<WorktreeLifecycleState, string> = {
  active: "Worktree is active — the agent is working",
  pending_decision: "Agent finished — awaiting merge/PR/discard decision",
  pr_open: "Pull request has been opened",
  merged: "Branch merged into base via merge commit",
  released: "Content on base via rebase or squash",
  dismissed: "Worktree discarded — changes abandoned",
  no_change: "Agent finished with no committed changes",
};

/**
 * Manages the lifecycle state machine for worktree sessions.
 * Tracks transitions and enforces valid state changes.
 */
export class WorktreeLifecycle {
  /** In-memory store of sessionId → current state */
  private states: Map<string, WorktreeLifecycleState> = new Map();

  /** History of transitions for audit: sessionId → array of { from, to, at } */
  private history: Map<string, Array<{ from: WorktreeLifecycleState; to: WorktreeLifecycleState; at: string }>> = new Map();

  /**
   * Transition a session's worktree to a new state.
   * Validates the transition against the state machine rules.
   *
   * @param sessionId — the session identifier
   * @param to — the target state
   * @throws if the transition is invalid
   */
  transition(sessionId: string, to: WorktreeLifecycleState): void {
    const from = this.getState(sessionId);

    // Terminal states cannot transition
    if (TRANSITIONS[from].length === 0) {
      throw new Error(
        `Cannot transition from terminal state "${from}" for session ${sessionId}`
      );
    }

    // Validate the transition
    const allowed = TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid transition: "${from}" → "${to}" for session ${sessionId}. ` +
        `Allowed: [${allowed.join(", ")}]`
      );
    }

    // Execute the transition
    this.states.set(sessionId, to);

    // Record in history
    const entry = { from, to, at: new Date().toISOString() };
    const existing = this.history.get(sessionId) || [];
    existing.push(entry);
    this.history.set(sessionId, existing);
  }

  /**
   * Get the current worktree lifecycle state for a session.
   * Defaults to "active" if no state has been set.
   *
   * @param sessionId — the session identifier
   * @returns the current state
   */
  getState(sessionId: string): WorktreeLifecycleState {
    return this.states.get(sessionId) || "active";
  }

  /**
   * Initialize the state for a new session.
   *
   * @param sessionId — the session identifier
   * @param initial — the initial state (default: "active")
   */
  initialize(sessionId: string, initial: WorktreeLifecycleState = "active"): void {
    this.states.set(sessionId, initial);
    this.history.set(sessionId, []);
  }

  /**
   * Get the transition history for a session.
   *
   * @param sessionId — the session identifier
   * @returns array of transition records
   */
  getHistory(sessionId: string): Array<{ from: WorktreeLifecycleState; to: WorktreeLifecycleState; at: string }> {
    return this.history.get(sessionId) || [];
  }

  /**
   * Get a human-readable description of a state.
   */
  describeState(state: WorktreeLifecycleState): string {
    return STATE_DESCRIPTIONS[state];
  }

  /**
   * Check if a transition would be valid without executing it.
   *
   * @param sessionId — the session identifier
   * @param to — the target state
   * @returns true if the transition is valid
   */
  canTransition(sessionId: string, to: WorktreeLifecycleState): boolean {
    const from = this.getState(sessionId);
    return TRANSITIONS[from].includes(to);
  }

  /**
   * Remove all state and history for a session (cleanup).
   *
   * @param sessionId — the session identifier
   */
  cleanup(sessionId: string): void {
    this.states.delete(sessionId);
    this.history.delete(sessionId);
  }
}
