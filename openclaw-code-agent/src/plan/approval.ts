// ============================================================================
// Plan Approval Flow — Plan review UX: approve, revise, reject, delegate
// Spec: Section 8.2
// ============================================================================

import type {
  Session,
  PlanArtifact,
  PlanApproval,
  SessionState,
} from "../types";

// Minimal interfaces for store and lifecycle — avoids a hard dependency
// on the full SessionStore / SessionLifecycle implementations.
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
export class PlanApprovalFlow {
  private store: SessionStoreLike;
  private harness: HarnessLike;

  constructor(store: SessionStoreLike, harness: HarnessLike) {
    this.store = store;
    this.harness = harness;
  }

  /**
   * Called when a plan has been detected in harness output.
   *
   * @param sessionId — the session that produced a plan
   * @param plan — the parsed plan artifact
   * @param planApproval — the approval mode configured for this session
   */
  async handlePlanDetected(
    sessionId: string,
    plan: PlanArtifact,
    planApproval: PlanApproval = "delegate"
  ): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session state
    this.store.update(sessionId, {
      state: "awaiting_plan_approval" as SessionState,
      planApprovalState: "pending",
      pendingPlan: plan,
      updatedAt: new Date().toISOString(),
    });

    // Route based on approval mode
    if (planApproval === "delegate") {
      // Orchestrator reviews — the harness pauses and the orchestrator
      // will call approve(), reject(), or requestRevision() later.
      // No immediate action needed here; the state change signals the
      // orchestrator that a plan is pending review.
      return;
    }

    if (planApproval === "ask") {
      // User-facing mode: the UI layer (outside this class) should
      // present approve/revise/reject buttons to the user.
      // The state change signals the UI that user input is required.
      return;
    }

    // "off" — plan approval is disabled; auto-approve
    await this.approve(sessionId);
  }

  /**
   * Approve a pending plan and signal the harness to continue execution.
   *
   * @param sessionId — the session whose plan is being approved
   */
  async approve(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const plan = session.pendingPlan;
    if (!plan) {
      throw new Error(`No pending plan for session: ${sessionId}`);
    }

    // Update plan and session state
    const now = new Date().toISOString();
    const updatedPlan: PlanArtifact = {
      ...plan,
      status: "approved",
      approvedAt: now,
    };

    this.store.update(sessionId, {
      state: "active" as SessionState,
      planApprovalState: "approved",
      pendingPlan: updatedPlan,
      updatedAt: now,
    });

    // Signal harness to continue with approved plan
    await this.harness.send(sessionId, "Plan approved. Proceed with implementation.");
  }

  /**
   * Reject a pending plan and kill the session.
   *
   * @param sessionId — the session whose plan is being rejected
   */
  async reject(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const plan = session.pendingPlan;
    const now = new Date().toISOString();

    // Mark plan as rejected
    if (plan) {
      const updatedPlan: PlanArtifact = {
        ...plan,
        status: "rejected",
      };
      this.store.update(sessionId, {
        planApprovalState: "rejected",
        pendingPlan: updatedPlan,
      });
    }

    // Kill the session — set terminal state
    this.store.update(sessionId, {
      state: "killed" as SessionState,
      planApprovalState: "rejected",
      updatedAt: now,
    });

    // Signal the harness to stop
    await this.harness.send(sessionId, "Plan rejected. Stopping session.");
  }

  /**
   * Request a revision of the pending plan with user feedback.
   * Returns the session to active state so the harness can replan.
   *
   * @param sessionId — the session whose plan needs revision
   * @param feedback — user/orchestrator feedback on what to change
   */
  async requestRevision(sessionId: string, feedback: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const plan = session.pendingPlan;
    const now = new Date().toISOString();

    // Mark plan as revising
    if (plan) {
      const updatedPlan: PlanArtifact = {
        ...plan,
        status: "revising",
        revisedAt: now,
      };
      this.store.update(sessionId, {
        pendingPlan: updatedPlan,
      });
    }

    // Return session to active state so harness continues
    this.store.update(sessionId, {
      state: "active" as SessionState,
      planApprovalState: "revising",
      updatedAt: now,
    });

    // Send feedback to harness — the harness should replan based on feedback
    const revisionMessage = `Plan revision requested: ${feedback}`;
    await this.harness.send(sessionId, revisionMessage);
  }

  /**
   * Check whether a session has a pending plan awaiting approval.
   *
   * @param sessionId — the session to check
   * @returns true if a plan is pending approval
   */
  hasPendingPlan(sessionId: string): boolean {
    const session = this.store.get(sessionId);
    if (!session) return false;
    return (
      session.state === "awaiting_plan_approval" &&
      session.planApprovalState === "pending" &&
      session.pendingPlan !== undefined
    );
  }

  /**
   * Get the pending plan for a session, if any.
   *
   * @param sessionId — the session to query
   * @returns the pending plan artifact, or undefined
   */
  getPendingPlan(sessionId: string): PlanArtifact | undefined {
    const session = this.store.get(sessionId);
    return session?.pendingPlan;
  }
}
