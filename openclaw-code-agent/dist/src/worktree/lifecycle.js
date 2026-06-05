// ============================================================================
// Worktree Lifecycle State Machine
// ============================================================================
const TRANSITIONS = {
    active: ["pending_decision", "no_change", "dismissed"],
    pending_decision: ["merged", "pr_open", "released", "dismissed"],
    pr_open: ["merged", "released"],
    merged: [], released: [], dismissed: [], no_change: [],
};
const STATE_DESCRIPTIONS = {
    active: "Worktree is active — the agent is working",
    pending_decision: "Agent finished — awaiting merge/PR/discard decision",
    pr_open: "Pull request has been opened",
    merged: "Branch merged into base via merge commit",
    released: "Content on base via rebase or squash",
    dismissed: "Worktree discarded — changes abandoned",
    no_change: "Agent finished with no committed changes",
};
export class WorktreeLifecycle {
    states = new Map();
    history = new Map();
    transition(sessionId, to) {
        const from = this.getState(sessionId);
        if (TRANSITIONS[from].length === 0) throw new Error(`Cannot transition from terminal state "${from}" for session ${sessionId}`);
        const allowed = TRANSITIONS[from];
        if (!allowed.includes(to)) throw new Error(`Invalid transition: "${from}" → "${to}" for session ${sessionId}. Allowed: [${allowed.join(", ")}]`);
        this.states.set(sessionId, to);
        const entry = { from, to, at: new Date().toISOString() };
        const existing = this.history.get(sessionId) || [];
        existing.push(entry);
        this.history.set(sessionId, existing);
    }
    getState(sessionId) { return this.states.get(sessionId) || "active"; }
    initialize(sessionId, initial = "active") { this.states.set(sessionId, initial); this.history.set(sessionId, []); }
    getHistory(sessionId) { return this.history.get(sessionId) || []; }
    describeState(state) { return STATE_DESCRIPTIONS[state]; }
    canTransition(sessionId, to) { return TRANSITIONS[this.getState(sessionId)].includes(to); }
    cleanup(sessionId) { this.states.delete(sessionId); this.history.delete(sessionId); }
}
//# sourceMappingURL=lifecycle.js.map