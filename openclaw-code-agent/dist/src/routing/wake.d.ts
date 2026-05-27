import type { Session } from "../types";
export type WakeReason = "plan_approval" | "completed" | "error" | "worktree_decision";
export interface WakePayload {
    session: Session;
    reason: WakeReason;
    context: Record<string, any>;
    timestamp: string;
}
/**
 * WakeRouter manages the two-step completion contract between the plugin
 * and the OpenClaw orchestrator:
 *   1. Plugin delivers a canonical outcome status (wake).
 *   2. Orchestrator reads full output and sends a concise factual summary
 *      to the origin route / thread.
 */
export declare class WakeRouter {
    /**
     * Notify the orchestrator that a session needs attention.
     * In a full implementation this calls the OpenClaw SDK wake endpoint;
     * here we log the wake for debugging / development.
     */
    wakeOrchestrator(session: Session, reason: WakeReason, context?: Record<string, any>): Promise<void>;
    /**
     * Send a completion summary to the origin route and thread.
     * The orchestrator consumes this to deliver a concise factual summary
     * to the user in the original chat channel.
     */
    sendCompletionSummary(session: Session, summary: string): Promise<void>;
}
//# sourceMappingURL=wake.d.ts.map