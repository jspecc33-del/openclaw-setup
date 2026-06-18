// =============================================================================
// Tools — All 15 Tool Definitions
// =============================================================================
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { VerifierGoal } from "../goals/verifier";
import { RalphGoal } from "../goals/ralph";
function resolveWorktreeStrategy(input) {
    const valid = ["delegate", "ask", "off", "manual", "auto-merge", "auto-pr"];
    return valid.includes(input) ? input : "delegate";
}
function resolvePlanApproval(input) {
    const valid = ["delegate", "ask", "off"];
    return valid.includes(input) ? input : "delegate";
}
const agentLaunch = {
    name: "agent_launch",
    description: "Start a background coding session with the specified harness and instructions.",
    parameters: { type: "object", properties: { name: { type: "string" }, harness: { type: "string", enum: ["claude-code", "codex"] }, workdir: { type: "string" }, instructions: { type: "string" }, worktreeStrategy: { type: "string", enum: ["delegate", "ask", "off", "manual", "auto-merge", "auto-pr"] }, planApproval: { type: "string", enum: ["delegate", "ask", "off"] }, originRoute: { type: "string" }, originThreadId: { type: "string" } }, required: ["name"] },
    handler: async (args, ctx) => {
        return await ctx.lifecycle.launch({ name: args.name, harness: args.harness ?? ctx.config.defaultHarness, workdir: args.workdir ?? ctx.config.defaultWorkdir, instructions: args.instructions, worktreeStrategy: resolveWorktreeStrategy(args.worktreeStrategy ?? ctx.config.defaultWorktreeStrategy), planApproval: resolvePlanApproval(args.planApproval ?? ctx.config.planApproval), originRoute: args.originRoute, originThreadId: args.originThreadId });
    },
};
const agentRespond = {
    name: "agent_respond",
    description: "Send a message to an active coding session.",
    parameters: { type: "object", properties: { sessionId: { type: "string" }, message: { type: "string" } }, required: ["sessionId", "message"] },
    handler: async (args, ctx) => { await ctx.lifecycle.respond(args.sessionId, args.message); return { sent: true }; },
};
const agentRequestPlanApproval = {
    name: "agent_request_plan_approval",
    description: "Escalate a pending plan to the user for approval.",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session) throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.pendingPlan) throw new Error(`No pending plan for session ${args.sessionId}`);
        ctx.store.update(args.sessionId, { planApprovalState: "pending", state: "awaiting_plan_approval" });
        return { escalated: true, plan: session.pendingPlan.content };
    },
};
const agentSendPlanOffer = {
    name: "agent_send_plan_offer",
    description: "Send a Start Plan / Dismiss choice to the user for a session with a pending plan.",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session) throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.pendingPlan) throw new Error(`No pending plan for session ${args.sessionId}`);
        return { sent: true, plan: session.pendingPlan.content };
    },
};
const agentOutput = {
    name: "agent_output",
    description: "Read buffered stdout/stderr output from a session.",
    parameters: { type: "object", properties: { sessionId: { type: "string" }, since: { type: "number" } }, required: ["sessionId"] },
    handler: async (args, ctx) => ({ output: ctx.store.getOutput(args.sessionId, args.since), length: ctx.store.getOutputLength(args.sessionId) }),
};
const agentSessions = {
    name: "agent_sessions",
    description: "List active and recent sessions.",
    parameters: { type: "object", properties: { filter: { type: "object", properties: { state: { type: "string" }, harness: { type: "string", enum: ["claude-code", "codex"] } } } } },
    handler: async (args, ctx) => ctx.store.list(args.filter),
};
const agentKill = {
    name: "agent_kill",
    description: "Stop a running session and mark it as killed.",
    parameters: { type: "object", properties: { sessionId: { type: "string" }, reason: { type: "string" } }, required: ["sessionId"] },
    handler: async (args, ctx) => { await ctx.lifecycle.kill(args.sessionId, args.reason); return { killed: true, sessionId: args.sessionId }; },
};
const agentStats = {
    name: "agent_stats",
    description: "Show aggregate usage statistics.",
    parameters: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
        const sessions = ctx.store.list();
        let totalCostUsd = 0, totalDurationMs = 0, activeCount = 0, completedCount = 0, failedCount = 0;
        for (const s of sessions) {
            totalCostUsd += s.costUsd ?? 0;
            totalDurationMs += s.durationMs ?? 0;
            if (s.state === "active" || s.state === "awaiting_plan_approval" || s.state === "completing") activeCount++;
            else if (s.state === "completed") completedCount++;
            else if (s.state === "failed" || s.state === "killed") failedCount++;
        }
        return { sessionCount: sessions.length, totalCostUsd: Math.round(totalCostUsd * 100) / 100, totalDurationMs, activeCount, completedCount, failedCount };
    },
};
const agentMerge = {
    name: "agent_merge",
    description: "Merge a session's worktree branch back into the base branch.",
    parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session) throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.worktreeBranch || !session.baseBranch) return { success: false, message: "Session has no worktree branch to merge." };
        try {
            execSync(`git checkout ${session.baseBranch}`, { cwd: session.workdir });
            const mergeOutput = execSync(`git merge ${session.worktreeBranch} --no-edit`, { cwd: session.workdir, encoding: "utf-8" });
            const sha = execSync("git rev-parse HEAD", { cwd: session.workdir, encoding: "utf-8" }).trim();
            ctx.store.update(args.sessionId, { worktreeState: "merged" });
            return { success: true, message: mergeOutput.trim(), sha };
        } catch (err) { return { success: false, message: `Merge failed: ${err.message}` }; }
    },
};
const agentPr = {
    name: "agent_pr",
    description: "Create a GitHub Pull Request from the session's worktree branch.",
    parameters: { type: "object", properties: { sessionId: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["sessionId"] },
    handler: async (args, ctx) => {
        const session = ctx.store.get(args.sessionId);
        if (!session) throw new Error(`Session not found: ${args.sessionId}`);
        if (!session.worktreeBranch) return { success: false, message: "Session has no worktree branch for PR." };
        try {
            const title = args.title ?? session.name;
            const bodyFlag = args.body ? `--body "${args.body}"` : "--fill";
            const output = execSync(`gh pr create --head "${session.worktreeBranch}" --title "${title}" ${bodyFlag}`, { cwd: session.workdir, encoding: "utf-8" });
            const prUrl = output.trim();
            ctx.store.update(args.sessionId, { prUrl, worktreeState: "pr_open" });
            return { success: true, prUrl, message: `PR created: ${prUrl}` };
        } catch (err) { return { success: false, message: `PR creation failed: ${err.message}` }; }
    },
};
const agentWorktreeStatus = {
    name: "agent_worktree_status",
    description: "Show the worktree lifecycle state for a session.",
    parameters: { type: "object", properties: { sessionId: { type: "string" } } },
    handler: async (args, ctx) => {
        if (args.sessionId) {
            const session = ctx.store.get(args.sessionId);
            if (!session) throw new Error(`Session not found: ${args.sessionId}`);
            return { sessionId: session.id, name: session.name, worktreeState: session.worktreeState ?? "no_change", worktreeBranch: session.worktreeBranch, worktreePath: session.worktreePath, baseBranch: session.baseBranch };
        }
        return ctx.store.list().map((s) => ({ sessionId: s.id, name: s.name, worktreeState: s.worktreeState ?? "no_change", worktreeBranch: s.worktreeBranch, worktreePath: s.worktreePath, baseBranch: s.baseBranch }));
    },
};
const agentWorktreeCleanup = {
    name: "agent_worktree_cleanup",
    description: "Preview or execute cleanup of worktree branches.",
    parameters: { type: "object", properties: { mode: { type: "string", enum: ["preview_safe", "dismiss"] }, sessionId: { type: "string" } }, required: ["mode"] },
    handler: async (args, ctx) => {
        const cleaned = [], dismissed = [];
        if (args.mode === "preview_safe") {
            const sessions = args.sessionId ? [ctx.store.get(args.sessionId)].filter(Boolean) : ctx.store.list();
            for (const s of sessions) if (s.worktreeState === "merged" || s.worktreeState === "released" || s.worktreeState === "dismissed") cleaned.push(s.id);
            return { cleaned, dismissed: [] };
        }
        if (args.mode === "dismiss") {
            const sessions = args.sessionId ? [ctx.store.get(args.sessionId)].filter(Boolean) : ctx.store.list();
            for (const s of sessions) {
                if (s.worktreeBranch && s.worktreePath) {
                    try { execSync(`git worktree remove "${s.worktreePath}" --force`, { cwd: s.workdir }); execSync(`git branch -D "${s.worktreeBranch}"`, { cwd: s.workdir }); cleaned.push(s.worktreeBranch); } catch {}
                }
                ctx.store.update(s.id, { worktreeState: "dismissed" });
                dismissed.push(s.id);
            }
            return { cleaned, dismissed };
        }
        return { cleaned: [] };
    },
};
const goalLaunch = {
    name: "goal_launch",
    description: "Start an explicit goal loop (verifier or ralph) with a target task.",
    parameters: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: ["verifier", "ralph"] }, target: { type: "string" }, verifierCommand: { type: "string" }, completionSignal: { type: "string" }, maxIterations: { type: "number" }, workdir: { type: "string" } }, required: ["name", "type", "target"] },
    handler: async (args, ctx) => {
        const now = new Date().toISOString();
        const task = { id: randomUUID(), sessionId: "", name: args.name, type: args.type, state: "running", workdir: args.workdir ?? ctx.config.defaultWorkdir, target: args.target, verifierCommand: args.verifierCommand, completionSignal: args.completionSignal, maxIterations: args.maxIterations ?? 10, currentIteration: 0, createdAt: now, updatedAt: now };
        if (args.type === "verifier") {
            if (!args.verifierCommand) throw new Error('verifierCommand is required for "verifier" goal type');
            const engine = new VerifierGoal(ctx.lifecycle, ctx.store);
            ctx.goalEngines.set(task.id, engine);
            await engine.start(task);
        } else if (args.type === "ralph") {
            if (!args.completionSignal) throw new Error('completionSignal is required for "ralph" goal type');
            const engine = new RalphGoal(ctx.lifecycle, ctx.store);
            ctx.goalEngines.set(task.id, engine);
            await engine.start(task);
        }
        ctx.sessionGoals.set(task.sessionId, task.id);
        return task;
    },
};
const goalStatus = {
    name: "goal_status",
    description: "Get the status of one or all goal tasks.",
    parameters: { type: "object", properties: { goalId: { type: "string" } } },
    handler: async (args, ctx) => {
        if (args.goalId) {
            const engine = ctx.goalEngines.get(args.goalId);
            if (!engine) throw new Error(`Goal not found: ${args.goalId}`);
            const task = engine.getTask();
            if (!task) throw new Error(`Goal engine ${args.goalId} has no active task`);
            return { goalId: task.id, name: task.name, type: task.type, state: task.state, currentIteration: task.currentIteration, maxIterations: task.maxIterations, sessionId: task.sessionId, updatedAt: task.updatedAt, completedAt: task.completedAt };
        }
        const results = [];
        for (const [_id, engine] of ctx.goalEngines) {
            const task = engine.getTask();
            if (task) results.push({ goalId: task.id, name: task.name, type: task.type, state: task.state, currentIteration: task.currentIteration, maxIterations: task.maxIterations, sessionId: task.sessionId, updatedAt: task.updatedAt, completedAt: task.completedAt });
        }
        return results;
    },
};
const goalStop = {
    name: "goal_stop",
    description: "Stop a running goal task and kill its underlying session.",
    parameters: { type: "object", properties: { goalId: { type: "string" } }, required: ["goalId"] },
    handler: async (args, ctx) => {
        const engine = ctx.goalEngines.get(args.goalId);
        if (!engine) throw new Error(`Goal not found: ${args.goalId}`);
        await engine.stop();
        ctx.goalEngines.delete(args.goalId);
        return { stopped: true, goalId: args.goalId };
    },
};
export const allTools = [agentLaunch, agentRespond, agentRequestPlanApproval, agentSendPlanOffer, agentOutput, agentSessions, agentKill, agentStats, agentMerge, agentPr, agentWorktreeStatus, agentWorktreeCleanup, goalLaunch, goalStatus, goalStop];
export const toolsByName = Object.fromEntries(allTools.map((t) => [t.name, t]));
//# sourceMappingURL=index.js.map