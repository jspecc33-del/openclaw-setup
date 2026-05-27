import type { Session, PlanArtifact, PlanApproval } from "../types";
interface SessionStoreLike {
    get(id: string): Session | undefined;
    update(id: string, patch: Partial<Session>): Session;
}
interface HarnessLike {
    send(sessionId: string, message: string): Promise<void>;
}
/**
 * Manages the plan approval/review workflow for sessions.
 *
 * Flow:
 *   1. Plan detected → set session state to "awaiting_plan_approval"
 *   2. Orchestrator reviews (delegate) or user gets buttons (ask)
 *   3. Approve  → harness continues execution
 *   4. Reject   → session killed
 *   5. Revise   → harness replans with feedback
 */
export declare class PlanApprovalFlow {
    private store;
    private harness;
    constructor(store: SessionStoreLike, harness: HarnessLike);
    /**
     * Called when a plan has been detected in harness output.
     *
     * @param sessionId — the session that produced a plan
     * @param plan — the parsed plan artifact
     * @param planApproval — the approval mode configured for this session
     */
    handlePlanDetected(sessionId: string, plan: PlanArtifact, planApproval?: PlanApproval): Promise<void>;
    /**
     * Approve a pending plan and signal the harness to continue execution.
     *
     * @param sessionId — the session whose plan is being approved
     */
    approve(sessionId: string): Promise<void>;
    /**
     * Reject a pending plan and kill the session.
     *
     * @param sessionId — the session whose plan is being rejected
     */
    reject(sessionId: string): Promise<void>;
    /**
     * Request a revision of the pending plan with user feedback.
     * Returns the session to active state so the harness can replan.
     *
     * @param sessionId — the session whose plan needs revision
     * @param feedback — user/orchestrator feedback on what to change
     */
    requestRevision(sessionId: string, feedback: string): Promise<void>;
    /**
     * Check whether a session has a pending plan awaiting approval.
     *
     * @param sessionId — the session to check
     * @returns true if a plan is pending approval
     */
    hasPendingPlan(sessionId: string): boolean;
    /**
     * Get the pending plan for a session, if any.
     *
     * @param sessionId — the session to query
     * @returns the pending plan artifact, or undefined
     */
    getPendingPlan(sessionId: string): PlanArtifact | undefined;
}
export {};
//# sourceMappingURL=approval.d.ts.map