// ============================================================================
// Plan Approval Flow
// ============================================================================
export class PlanApprovalFlow {
    store;
    harness;
    constructor(store, harness) {
        this.store = store;
        this.harness = harness;
    }
    async handlePlanDetected(sessionId, plan, planApproval = "delegate") {
        const session = this.store.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        this.store.update(sessionId, {
            state: "awaiting_plan_approval",
            planApprovalState: "pending",
            pendingPlan: plan,
            updatedAt: new Date().toISOString(),
        });
        if (planApproval === "delegate") {
            return;
        }
        if (planApproval === "ask") {
            return;
        }
        await this.approve(sessionId);
    }
    async approve(sessionId) {
        const session = this.store.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const plan = session.pendingPlan;
        if (!plan) {
            throw new Error(`No pending plan for session: ${sessionId}`);
        }
        const now = new Date().toISOString();
        const updatedPlan = { ...plan, status: "approved", approvedAt: now };
        this.store.update(sessionId, {
            state: "active",
            planApprovalState: "approved",
            pendingPlan: updatedPlan,
            updatedAt: now,
        });
        await this.harness.send(sessionId, "Plan approved. Proceed with implementation.");
    }
    async reject(sessionId) {
        const session = this.store.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const plan = session.pendingPlan;
        const now = new Date().toISOString();
        if (plan) {
            this.store.update(sessionId, { planApprovalState: "rejected", pendingPlan: { ...plan, status: "rejected" } });
        }
        this.store.update(sessionId, { state: "killed", planApprovalState: "rejected", updatedAt: now });
        await this.harness.send(sessionId, "Plan rejected. Stopping session.");
    }
    async requestRevision(sessionId, feedback) {
        const session = this.store.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        const plan = session.pendingPlan;
        const now = new Date().toISOString();
        if (plan) {
            this.store.update(sessionId, { pendingPlan: { ...plan, status: "revising", revisedAt: now } });
        }
        this.store.update(sessionId, { state: "active", planApprovalState: "revising", updatedAt: now });
        await this.harness.send(sessionId, `Plan revision requested: ${feedback}`);
    }
    hasPendingPlan(sessionId) {
        const session = this.store.get(sessionId);
        if (!session)
            return false;
        return (session.state === "awaiting_plan_approval" && session.planApprovalState === "pending" && session.pendingPlan !== undefined);
    }
    getPendingPlan(sessionId) {
        const session = this.store.get(sessionId);
        return session?.pendingPlan;
    }
}
//# sourceMappingURL=approval.js.map