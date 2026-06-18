import type { Session, AgentStats } from "../types";
import type { PlanArtifact } from "../types";
/**
 * Format a plan review message with Approve / Revise / Reject actions.
 */
export declare function formatPlanReview(session: Session, plan: PlanArtifact, markdown?: boolean): string;
/**
 * Format a worktree decision prompt with Merge / Open PR / Later / Discard
 * actions.
 */
export declare function formatWorktreeDecision(session: Session, markdown?: boolean): string;
/**
 * Format the canonical completion status for a session.
 */
export declare function formatCompletion(session: Session, markdown?: boolean): string;
/**
 * Format aggregate agent stats for display.
 */
export declare function formatStats(stats: AgentStats, markdown?: boolean): string;
//# sourceMappingURL=notifications.d.ts.map