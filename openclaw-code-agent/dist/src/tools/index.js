// =============================================================================
// Tools — All 15 Tool Definitions
// =============================================================================
// Each tool is an object with: name, description, parameters (JSONSchema),
// and handler: async (args, ctx) => any.
//
// Tools register with OpenClaw contracts.tools.  Handlers reference real
// module classes (SessionLifecycle, SessionStore, etc.) via ctx.
//
// Section 10 of the specification.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { VerifierGoal } from "../goals/verifier";
import { RalphGoal } from "../goals/ralph";
// ---------------------------------------------------------------------------
// Helper: resolve worktree strategy shorthand
// ---------------------------------------------------------------------------
function resolveWorktreeStrategy(input) {
    const valid = ["delegate", "ask", "off", "manual", "auto-merge", "auto-pr"];
    return valid.includes(input) ? input : "delegate";
}
function resolvePlanApproval(input) {
    const valid = ["delegate", "ask", "off"];
    return valid.includes(input) ? input : "delegate";
}
// ---------------------------------------------------------------------------
// Tool 1: agent_launch
// ---------------------------------------------------------------------------
const agentLaunch = {
    name: "agent_launch",
    description: "Start a background coding session with the specified harness and instructions.",
    parameters: {
        type: "object",
        properties: {
            name: { type: "string", description: "Human-readable session name" },
            harness: { type: "string", enum: ["claude-code", "codex"], description: "Harness type (default: claude-code)" },
            workdir: { type: "string", description: "Working directory for the session" },
            instructions: { type: "string", description: "Initial instructions / task description" },
            worktreeStrategy: { type: "string", enum: ["delegate", "ask", "off", "manual", "auto-merge", "auto-pr"], description: "Worktree isolation strategy" },
            planApproval: { type: "string", enum: ["delegate", "ask", "off"], description: "Plan approval mode" },
            originRoute: { type: "string", description: "Chat route that launched the session" },
            originThreadId: { type: "string", description: "Thread ID for routing responses back" },
        },
        required: ["name"],
    },
    handler: async (args, ctx) => {
        const params = {
            name: args.name,
            harness: args.harness ?? ctx.config.defaultHarness,
            workdir: args.workdir ?? ctx.config.defaultWorkdir,
            instructions: args.instructions,
            worktreeStrategy: resolveWorktreeStrategy(args.worktreeStrategy ?? ctx.config.defaultWorktreeStrategy),
            planApproval: resolvePlanApproval(args.planApproval ?? ctx.config.planApproval),
            originRoute: args.originRoute,
            originThreadId: args.originThreadId,
        };
        return await ctx.lifecycle.launch(params);
    },
};
// ---------------------------------------------------------------------------
// Tool 2: agent_respond
// ---------------------------------------------------------------------------
const agentRespond = {
    name: "agent_respond",
    description: "Send a message to an active coding session.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the target session" },
            message: { type: "string", description: "Message text to send" },
        },
        required: ["sessionId", "message"],
    },
    handler: async (args, ctx) => {
        await ctx.lifecycle.respond(args.sessionId, args.message);
        return { sent: true };
    },
};
// ---------------------------------------------------------------------------
// Tool 3: agent_request_plan_approval
// ---------------------------------------------------------------------------
const agentRequestPlanApproval = {
    name: "agent_request_plan_approval",
    description: "Escalate a pending plan to the user for approval.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session with a pending plan" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session)
            throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.pendingPlan)
            throw new Error(`No pending plan for session ${args.sessionId}`);
        ctx.store.update(args.sessionId, { planApprovalState: "pending", state: "awaiting_plan_approval" });
        return { escalated: true, plan: session.pendingPlan.content };
    },
};
// ---------------------------------------------------------------------------
// Tool 4: agent_send_plan_offer
// ---------------------------------------------------------------------------
const agentSendPlanOffer = {
    name: "agent_send_plan_offer",
    description: "Send a Start Plan / Dismiss choice to the user for a session with a pending plan.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session)
            throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.pendingPlan)
            throw new Error(`No pending plan for session ${args.sessionId}`);
        return { sent: true, plan: session.pendingPlan.content };
    },
};
// ---------------------------------------------------------------------------
// Tool 5: agent_output
// ---------------------------------------------------------------------------
const agentOutput = {
    name: "agent_output",
    description: "Read buffered stdout/stderr output from a session.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session" },
            since: { type: "number", description: "Line offset to read from (0 = beginning)" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        const output = ctx.store.getOutput(args.sessionId, args.since);
        const length = ctx.store.getOutputLength(args.sessionId);
        return { output, length };
    },
};
// ---------------------------------------------------------------------------
// Tool 6: agent_sessions
// ---------------------------------------------------------------------------
const agentSessions = {
    name: "agent_sessions",
    description: "List active and recent sessions, optionally filtered by state or harness.",
    parameters: {
        type: "object",
        properties: {
            filter: {
                type: "object",
                properties: {
                    state: { type: "string", description: "Filter by session state" },
                    harness: { type: "string", enum: ["claude-code", "codex"], description: "Filter by harness type" },
                },
                description: "Optional filter criteria",
            },
        },
    },
    handler: async (args, ctx) => {
        return ctx.store.list(args.filter);
    },
};
// ---------------------------------------------------------------------------
// Tool 7: agent_kill
// ---------------------------------------------------------------------------
const agentKill = {
    name: "agent_kill",
    description: "Stop a running session and mark it as killed.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session to kill" },
            reason: { type: "string", description: "Optional reason for killing the session" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        await ctx.lifecycle.kill(args.sessionId, args.reason);
        return { killed: true, sessionId: args.sessionId };
    },
};
// ---------------------------------------------------------------------------
// Tool 8: agent_stats
// ---------------------------------------------------------------------------
const agentStats = {
    name: "agent_stats",
    description: "Show aggregate usage statistics: session count, total cost, total duration.",
    parameters: {
        type: "object",
        properties: {},
    },
    handler: async (_args, ctx) => {
        const sessions = ctx.store.list();
        let totalCostUsd = 0;
        let totalDurationMs = 0;
        let activeCount = 0;
        let completedCount = 0;
        let failedCount = 0;
        for (const s of sessions) {
            totalCostUsd += s.costUsd ?? 0;
            totalDurationMs += s.durationMs ?? 0;
            if (s.state === "active" || s.state === "awaiting_plan_approval" || s.state === "completing") {
                activeCount++;
            }
            else if (s.state === "completed") {
                completedCount++;
            }
            else if (s.state === "failed" || s.state === "killed") {
                failedCount++;
            }
        }
        return {
            sessionCount: sessions.length,
            totalCostUsd: Math.round(totalCostUsd * 100) / 100,
            totalDurationMs,
            activeCount,
            completedCount,
            failedCount,
        };
    },
};
// ---------------------------------------------------------------------------
// Tool 9: agent_merge
// ---------------------------------------------------------------------------
const agentMerge = {
    name: "agent_merge",
    description: "Merge a session's worktree branch back into the base branch.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session whose worktree to merge" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session)
            throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.worktreeBranch || !session.baseBranch) {
            return { success: false, message: "Session has no worktree branch to merge." };
        }
        try {
            execFileSync("git", ["checkout", session.baseBranch], { cwd: session.workdir });
            const mergeOutput = execFileSync("git", ["merge", session.worktreeBranch, "--no-edit"], {
                cwd: session.workdir,
                encoding: "utf-8",
            });
            const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: session.workdir, encoding: "utf-8" }).trim();
            ctx.store.update(args.sessionId, { worktreeState: "merged" });
            return { success: true, message: mergeOutput.trim(), sha };
        }
        catch (err) {
            return { success: false, message: `Merge failed: ${err.message}` };
        }
    },
};
// ---------------------------------------------------------------------------
// Tool 10: agent_pr
// ---------------------------------------------------------------------------
const agentPr = {
    name: "agent_pr",
    description: "Create a GitHub Pull Request from the session's worktree branch.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session" },
            title: { type: "string", description: "PR title (defaults to session name)" },
            body: { type: "string", description: "PR body text" },
        },
        required: ["sessionId"],
    },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session)
            throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.worktreeBranch) {
            return { success: false, message: "Session has no worktree branch for PR." };
        }
        try {
            const title = args.title ?? session.name;
            const ghArgs = ["pr", "create", "--head", session.worktreeBranch, "--title", title];
            if (args.body) {
                ghArgs.push("--body", args.body);
            }
            else {
                ghArgs.push("--fill");
            }
            const output = execFileSync("gh", ghArgs, { cwd: session.workdir, encoding: "utf-8" });
            const prUrl = output.trim();
            ctx.store.update(args.sessionId, { prUrl, worktreeState: "pr_open" });
            return { success: true, prUrl, message: `PR created: ${prUrl}` };
        }
        catch (err) {
            return { success: false, message: `PR creation failed: ${err.message}` };
        }
    },
};
// ---------------------------------------------------------------------------
// Tool 11: agent_worktree_status
// ---------------------------------------------------------------------------
const agentWorktreeStatus = {
    name: "agent_worktree_status",
    description: "Show the worktree lifecycle state for a session.",
    parameters: {
        type: "object",
        properties: {
            sessionId: { type: "string", description: "UUID of the session (omit to list all)" },
        },
    },
    handler: async (args, ctx) => {
        if (args.sessionId) {
            const session = ctx.store.get(args.sessionId);
            if (!session)
                throw new Error(`Session not found: ${args.sessionId}`);
            return {
                sessionId: session.id,
                name: session.name,
                worktreeState: session.worktreeState ?? "no_change",
                worktreeBranch: session.worktreeBranch,
                worktreePath: session.worktreePath,
                baseBranch: session.baseBranch,
            };
        }
        // No sessionId — return all sessions with worktree info
        return ctx.store.list().map((s) => ({
            sessionId: s.id,
            name: s.name,
            worktreeState: s.worktreeState ?? "no_change",
            worktreeBranch: s.worktreeBranch,
            worktreePath: s.worktreePath,
            baseBranch: s.baseBranch,
        }));
    },
};
// ---------------------------------------------------------------------------
// Tool 12: agent_worktree_cleanup
// ---------------------------------------------------------------------------
const agentWorktreeCleanup = {
    name: "agent_worktree_cleanup",
    description: 'Preview or execute cleanup of worktree branches. Mode "preview_safe" lists branches that can be safely removed. Mode "dismiss" removes the worktree and marks the session dismissed.',
    parameters: {
        type: "object",
        properties: {
            mode: { type: "string", enum: ["preview_safe", "dismiss"], description: "Cleanup mode" },
            sessionId: { type: "string", description: "Specific session to clean (omit for global preview)" },
        },
        required: ["mode"],
    },
    handler: async (args, ctx) => {
        const cleaned = [];
        const dismissed = [];
        if (args.mode === "preview_safe") {
            const sessions = args.sessionId
                ? [ctx.store.get(args.sessionId)].filter((s) => s !== undefined)
                : ctx.store.list();
            for (const s of sessions) {
                if (s.worktreeState === "merged" || s.worktreeState === "released" || s.worktreeState === "dismissed") {
                    cleaned.push(s.id);
                }
            }
            return { cleaned, dismissed: [] };
        }
        if (args.mode === "dismiss") {
            const sessions = args.sessionId
                ? [ctx.store.get(args.sessionId)].filter((s) => s !== undefined)
                : ctx.store.list();
            for (const s of sessions) {
                if (s.worktreeBranch && s.worktreePath) {
                    try {
                        execFileSync("git", ["worktree", "remove", s.worktreePath, "--force"], { cwd: s.workdir });
                        execFileSync("git", ["branch", "-D", s.worktreeBranch], { cwd: s.workdir });
                        cleaned.push(s.worktreeBranch);
                    }
                    catch {
                        // Best-effort cleanup
                    }
                }
                ctx.store.update(s.id, { worktreeState: "dismissed" });
                dismissed.push(s.id);
            }
            return { cleaned, dismissed };
        }
        return { cleaned: [] };
    },
};
// ---------------------------------------------------------------------------
// Tool 13: goal_launch
// ---------------------------------------------------------------------------
const goalLaunch = {
    name: "goal_launch",
    description: "Start an explicit goal loop (verifier or ralph) with a target task.",
    parameters: {
        type: "object",
        properties: {
            name: { type: "string", description: "Goal name / identifier" },
            type: { type: "string", enum: ["verifier", "ralph"], description: "Goal type" },
            target: { type: "string", description: "Description of what to achieve" },
            verifierCommand: { type: "string", description: "Shell command for verifier type (e.g. pnpm test)" },
            completionSignal: { type: "string", description: "Signal string for ralph type (e.g. DONE)" },
            maxIterations: { type: "number", description: "Maximum iterations before failing (default: 10)" },
            workdir: { type: "string", description: "Working directory" },
        },
        required: ["name", "type", "target"],
    },
    handler: async (args, ctx) => {
        const goalType = args.type;
        const now = new Date().toISOString();
        const task = {
            id: randomUUID(),
            sessionId: "", // populated by the goal engine on start
            name: args.name,
            type: goalType,
            state: "running",
            workdir: args.workdir ?? ctx.config.defaultWorkdir,
            target: args.target,
            verifierCommand: args.verifierCommand,
            completionSignal: args.completionSignal,
            maxIterations: args.maxIterations ?? 10,
            currentIteration: 0,
            createdAt: now,
            updatedAt: now,
        };
        // Instantiate the correct goal engine and start it
        if (goalType === "verifier") {
            if (!args.verifierCommand) {
                throw new Error('verifierCommand is required for "verifier" goal type');
            }
            const engine = new VerifierGoal(ctx.lifecycle, ctx.store);
            ctx.goalEngines.set(task.id, engine);
            await engine.start(task);
        }
        else if (goalType === "ralph") {
            if (!args.completionSignal) {
                throw new Error('completionSignal is required for "ralph" goal type');
            }
            const engine = new RalphGoal(ctx.lifecycle, ctx.store);
            ctx.goalEngines.set(task.id, engine);
            await engine.start(task);
        }
        ctx.sessionGoals.set(task.sessionId, task.id);
        return task;
    },
};
// ---------------------------------------------------------------------------
// Tool 14: goal_status
// ---------------------------------------------------------------------------
const goalStatus = {
    name: "goal_status",
    description: "Get the status of one or all goal tasks.",
    parameters: {
        type: "object",
        properties: {
            goalId: { type: "string", description: "Specific goal ID (omit for all goals)" },
        },
    },
    handler: async (args, ctx) => {
        if (args.goalId) {
            const engine = ctx.goalEngines.get(args.goalId);
            if (!engine)
                throw new Error(`Goal not found: ${args.goalId}`);
            const task = engine.getTask();
            if (!task)
                throw new Error(`Goal engine ${args.goalId} has no active task`);
            return {
                goalId: task.id,
                name: task.name,
                type: task.type,
                state: task.state,
                currentIteration: task.currentIteration,
                maxIterations: task.maxIterations,
                sessionId: task.sessionId,
                updatedAt: task.updatedAt,
                completedAt: task.completedAt,
            };
        }
        // Return all goals
        const results = [];
        for (const [_id, engine] of ctx.goalEngines) {
            const task = engine.getTask();
            if (task) {
                results.push({
                    goalId: task.id,
                    name: task.name,
                    type: task.type,
                    state: task.state,
                    currentIteration: task.currentIteration,
                    maxIterations: task.maxIterations,
                    sessionId: task.sessionId,
                    updatedAt: task.updatedAt,
                    completedAt: task.completedAt,
                });
            }
        }
        return results;
    },
};
// ---------------------------------------------------------------------------
// Tool 15: goal_stop
// ---------------------------------------------------------------------------
const goalStop = {
    name: "goal_stop",
    description: "Stop a running goal task and kill its underlying session.",
    parameters: {
        type: "object",
        properties: {
            goalId: { type: "string", description: "UUID of the goal to stop" },
        },
        required: ["goalId"],
    },
    handler: async (args, ctx) => {
        const engine = ctx.goalEngines.get(args.goalId);
        if (!engine)
            throw new Error(`Goal not found: ${args.goalId}`);
        await engine.stop();
        ctx.goalEngines.delete(args.goalId);
        return { stopped: true, goalId: args.goalId };
    },
};
// ---------------------------------------------------------------------------
// Export all tools as a single ordered array
// ---------------------------------------------------------------------------
export const allTools = [
    agentLaunch,
    agentRespond,
    agentRequestPlanApproval,
    agentSendPlanOffer,
    agentOutput,
    agentSessions,
    agentKill,
    agentStats,
    agentMerge,
    agentPr,
    agentWorktreeStatus,
    agentWorktreeCleanup,
    goalLaunch,
    goalStatus,
    goalStop,
];
/** Convenience map for direct lookup by name. */
export const toolsByName = Object.fromEntries(allTools.map((t) => [t.name, t]));
//# sourceMappingURL=index.js.map