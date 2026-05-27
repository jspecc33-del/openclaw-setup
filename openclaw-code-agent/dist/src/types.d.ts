/**
 * types.ts - Shared TypeScript type definitions for the OpenClaw Code Agent plugin.
 *
 * This file contains all domain types, enums, and interfaces used across subsystems.
 * Every module imports from here. Keep this file dependency-free.
 */
/** Supported coding agent harnesses. */
export type HarnessType = "claude-code" | "codex";
/** When the plugin asks for permission before taking action. */
export type PermissionMode = "plan" | "direct";
/** How plan approval is handled. */
export type PlanApproval = "delegate" | "ask" | "off";
/** How worktree isolation and follow-through is handled. */
export type WorktreeStrategy = "delegate" | "ask" | "off" | "manual" | "auto-merge" | "auto-pr";
/** Lifecycle state of a coding session. */
export type SessionState = "pending" | "active" | "awaiting_plan_approval" | "completing" | "completed" | "failed" | "killed" | "suspended";
/** Lifecycle state of a worktree after the agent finishes. */
export type WorktreeLifecycleState = "active" | "pending_decision" | "pr_open" | "merged" | "released" | "dismissed" | "no_change";
/** Goal loop variant. */
export type GoalType = "verifier" | "ralph";
/** Runtime state of a goal task. */
export type GoalState = "running" | "paused" | "completed" | "failed" | "stopped";
/** A managed background coding session. */
export interface Session {
    /** UUIDv4 primary key. */
    id: string;
    /** Human-readable session name (unique within the plugin instance). */
    name: string;
    /** Which harness drives this session. */
    harness: HarnessType;
    /** Current lifecycle state. */
    state: SessionState;
    /** Working directory on disk (absolute path). */
    workdir: string;
    /** Isolated branch name created for this session (when worktree is enabled). */
    worktreeBranch?: string;
    /** Original branch before worktree creation. */
    baseBranch?: string;
    /** Absolute filesystem path to the git worktree. */
    worktreePath?: string;
    /** Post-completion worktree decision state. */
    worktreeState?: WorktreeLifecycleState;
    /** GitHub PR URL if a PR was opened for this session. */
    prUrl?: string;
    /** ID of the associated goal task (if this session is part of a goal loop). */
    goalTaskId?: string;
    /** Chat route that launched this session (for routing responses back). */
    originRoute?: string;
    /** Thread ID within the origin route. */
    originThreadId?: string;
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 last-update timestamp. */
    updatedAt: string;
    /** ISO 8601 completion timestamp (if finished). */
    completedAt?: string;
    /** Accumulated cost estimate in USD (optional telemetry). */
    costUsd?: number;
    /** Total wall-clock duration in milliseconds. */
    durationMs?: number;
    /** Where the session sits in the plan-approval flow. */
    planApprovalState?: "pending" | "approved" | "rejected" | "revising";
    /** The plan currently under review (if any). */
    pendingPlan?: PlanArtifact;
    /** Free-form metadata for extensions and debug info. */
    metadata: Record<string, any>;
}
/** A structured plan extracted from harness output. */
export interface PlanArtifact {
    /** UUIDv4 for this plan. */
    id: string;
    /** The session that produced this plan. */
    sessionId: string;
    /** Raw plan text content. */
    content: string;
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 approval timestamp. */
    approvedAt?: string;
    /** ISO 8601 revision timestamp. */
    revisedAt?: string;
    /** Current review status. */
    status: "pending" | "approved" | "rejected" | "revising";
}
/** An explicit goal-loop task that drives a session repeatedly. */
export interface GoalTask {
    /** UUIDv4 primary key. */
    id: string;
    /** The session this goal is attached to. */
    sessionId: string;
    /** Human-readable goal name. */
    name: string;
    /** Goal loop variant. */
    type: GoalType;
    /** Current runtime state. */
    state: GoalState;
    /** Working directory (may differ from session workdir). */
    workdir: string;
    /** High-level description of the desired outcome. */
    target: string;
    /** Shell command used to verify success (verifier type only). */
    verifierCommand?: string;
    /** String pattern that signals completion (ralph type only). */
    completionSignal?: string;
    /** Maximum allowed iterations before marking failed. */
    maxIterations: number;
    /** How many iterations have already run. */
    currentIteration: number;
    /** Most recent harness output captured for decision-making. */
    lastOutput?: string;
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 last-update timestamp. */
    updatedAt: string;
    /** ISO 8601 completion timestamp (if finished). */
    completedAt?: string;
}
/** Full plugin configuration shape. */
export interface PluginConfig {
    /** Default working directory for new sessions. */
    defaultWorkdir: string;
    /** Default harness when not specified at launch. */
    defaultHarness: HarnessType;
    /** When to ask for user permission. */
    permissionMode: PermissionMode;
    /** How plan approval is handled. */
    planApproval: PlanApproval;
    /** Default worktree isolation strategy. */
    defaultWorktreeStrategy: WorktreeStrategy;
    /** Per-harness configuration. */
    harnesses: {
        claudeCode: {
            /** Path to the `claude` executable (defaults to $PATH lookup). */
            executablePath?: string;
            /** Whitelist of tools the harness may invoke. */
            allowedTools?: string[];
            /** Execution policy for sandboxing. */
            execPolicy?: "sandbox" | "allow";
        };
        codex: {
            /** Path to the `codex` executable (defaults to $PATH lookup). */
            executablePath?: string;
            /** Base URL for the Codex App Server HTTP API. */
            appServerUrl?: string;
            /** Reasoning effort level for API requests. */
            reasoningEffort?: "low" | "medium" | "high";
            /** Whether to send service_tier: "fast" for lower latency. */
            fastMode?: boolean;
        };
    };
    /** Fallback notification channel when no origin route is available. */
    fallbackChannel?: string;
    /** Map of session-name prefixes to notification channels. */
    agentChannels?: Record<string, string>;
    /** Maximum session duration before auto-kill (ms). */
    maxSessionDurationMs: number;
    /** Max number of output lines buffered per session. */
    sessionOutputBufferSize: number;
    /** Age after which completed sessions are eligible for auto-cleanup (ms). */
    autoCleanupCompletedAfterMs: number;
}
/** Aggregate statistics returned by agent_stats. */
export interface AgentStats {
    sessionCount: number;
    totalCostUsd: number;
    totalDurationMs: number;
    activeCount: number;
    completedCount: number;
    failedCount: number;
}
/** Lightweight JSON Schema subset for tool parameter definitions. */
export interface JSONSchema {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
    description?: string;
}
/** Context object passed to every tool handler. */
export interface ToolContext {
    config: PluginConfig;
    store: import("./sessions/store").SessionStore;
    lifecycle: import("./sessions/lifecycle").SessionLifecycle;
    goalEngines: Map<string, import("./goals/base").GoalEngine>;
    sessionGoals: Map<string, string>;
    worktreeIsolation: import("./worktree/isolation").WorktreeIsolation;
    worktreeFollowThrough: import("./worktree/followthrough").WorktreeFollowThrough;
    worktreeLifecycle: import("./worktree/lifecycle").WorktreeLifecycle;
    planApprovalFlow: import("./plan/approval").PlanApprovalFlow;
    planParser: import("./plan/parser").PlanParser;
    wakeRouter: import("./routing/wake").WakeRouter;
    notificationFormatter: typeof import("./routing/notifications");
}
/** Parameters passed to SessionLifecycle.launch(). */
export type LaunchParams = {
    /** Human-readable session name (must be unique). */
    name: string;
    /** Harness to use (falls back to config.defaultHarness). */
    harness?: HarnessType;
    /** Working directory (falls back to config.defaultWorkdir). */
    workdir?: string;
    /** Initial instructions / prompt sent to the coding agent. */
    instructions?: string;
    /** Worktree strategy override (falls back to config.defaultWorktreeStrategy). */
    worktreeStrategy?: WorktreeStrategy;
    /** Plan approval override (falls back to config.planApproval). */
    planApproval?: PlanApproval;
    /** Chat route for routing responses back. */
    originRoute?: string;
    /** Thread ID within the origin route. */
    originThreadId?: string;
};
//# sourceMappingURL=types.d.ts.map