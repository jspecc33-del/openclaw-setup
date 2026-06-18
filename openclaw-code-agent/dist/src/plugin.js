/**
 * plugin.ts - OpenClaw Code Agent plugin entrypoint.
 *
 * Wires together all subsystems on load and tears them down on unload.
 * This is the central integration point that connects sessions, harnesses,
 * worktrees, plans, goals, tools, commands, and routing.
 */
import * as os from "os";
import * as path from "path";
import { definePlugin } from "openclaw/plugin-sdk/plugin-entry";
import { getConfig } from "./config";
// Sessions subsystem
import { SessionStore } from "./sessions/store";
import { SessionLifecycle } from "./sessions/lifecycle";
import { Monitor } from "./sessions/monitor";
import { ClaudeCodeHarness } from "./harness/claude-code";
import { CodexHarness } from "./harness/codex";
// Worktree subsystem
import { WorktreeIsolation } from "./worktree/isolation";
import { WorktreeFollowThrough } from "./worktree/followthrough";
import { WorktreeLifecycle } from "./worktree/lifecycle";
// Plan subsystem
import { PlanApprovalFlow } from "./plan/approval";
import { PlanParser } from "./plan/parser";
// Tools and commands
import { allTools } from "./tools";
import { registerCommands } from "./commands";
// Routing
import { WakeRouter } from "./routing/wake";
import * as NotificationFormatter from "./routing/notifications";
// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------
let pluginConfig;
let sessionStore;
let sessionLifecycle;
let monitor;
let worktreeIsolation;
let worktreeFollowThrough;
let worktreeLifecycle;
let planApprovalFlow;
let planParser;
let wakeRouter;
let toolContext;
let goalEngines;
let sessionGoals;
// ---------------------------------------------------------------------------
// Harness adapter factory
// ---------------------------------------------------------------------------
function createHarnessAdapter(session, config) {
    if (session.harness === "codex") {
        return new CodexHarness(session, config);
    }
    return new ClaudeCodeHarness(session, config);
}
// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------
/** All 16 tool contract names exported by this plugin. */
const TOOL_CONTRACTS = [
    "agent_launch",
    "agent_respond",
    "agent_request_plan_approval",
    "agent_send_plan_offer",
    "agent_output",
    "agent_sessions",
    "agent_kill",
    "agent_stats",
    "agent_merge",
    "agent_pr",
    "agent_worktree_status",
    "agent_worktree_cleanup",
    "goal_launch",
    "goal_status",
    "goal_stop",
];
export default definePlugin({
    name: "openclaw-code-agent",
    version: "1.0.0",
    description: "Managed background coding sessions for Claude Code and Codex",
    contracts: {
        tools: TOOL_CONTRACTS,
    },
    async onLoad(ctx) {
        // 1. Resolve configuration
        pluginConfig = getConfig(ctx?.config);
        const dataDir = ctx?.dataDir ?? path.join(os.homedir(), ".openclaw", "code-agent");
        // 2. Initialize sessions subsystem
        sessionStore = new SessionStore(dataDir);
        worktreeIsolation = new WorktreeIsolation();
        worktreeFollowThrough = new WorktreeFollowThrough();
        worktreeLifecycle = new WorktreeLifecycle();
        planParser = new PlanParser();
        sessionLifecycle = new SessionLifecycle(sessionStore, pluginConfig, worktreeIsolation, createHarnessAdapter);
        const harnessLike = {
            send: (sessionId, message) => sessionLifecycle.respond(sessionId, message),
        };
        planApprovalFlow = new PlanApprovalFlow(sessionStore, harnessLike);
        // 3. Initialize goals
        goalEngines = new Map();
        sessionGoals = new Map();
        // 4. Initialize routing
        wakeRouter = new WakeRouter();
        // 5. Build tool context
        toolContext = {
            config: pluginConfig,
            store: sessionStore,
            lifecycle: sessionLifecycle,
            goalEngines,
            sessionGoals,
            worktreeIsolation,
            worktreeFollowThrough,
            worktreeLifecycle,
            planApprovalFlow,
            planParser,
            wakeRouter,
            notificationFormatter: NotificationFormatter,
        };
        // 6. Register tool handlers
        for (const tool of allTools) {
            ctx?.tools?.register?.(tool.name, (args) => tool.handler(args, toolContext));
        }
        // 7. Register chat commands
        const commandHandler = registerCommands(toolContext);
        ctx?.commands?.register?.("/agent", commandHandler);
        ctx?.commands?.register?.("/agent_sessions", commandHandler);
        ctx?.commands?.register?.("/agent_output", commandHandler);
        ctx?.commands?.register?.("/agent_respond", commandHandler);
        ctx?.commands?.register?.("/agent_kill", commandHandler);
        ctx?.commands?.register?.("/agent_stats", commandHandler);
        ctx?.commands?.register?.("/goal", commandHandler);
        ctx?.commands?.register?.("/goal_status", commandHandler);
        ctx?.commands?.register?.("/goal_stop", commandHandler);
        // 8. Start background monitor loop
        monitor = new Monitor(sessionStore, sessionLifecycle, pluginConfig);
        monitor.start();
        // 9. Log initialization
        const log = ctx?.logger?.info ?? console.log;
        log("[openclaw-code-agent] Plugin loaded. Harness: %s, Mode: %s, Plan: %s, Worktree: %s", pluginConfig.defaultHarness, pluginConfig.permissionMode, pluginConfig.planApproval, pluginConfig.defaultWorktreeStrategy);
    },
    async onUnload(ctx) {
        const log = ctx?.logger?.info ?? console.log;
        // 1. Stop the monitor
        monitor?.stop();
        // 2. Tear down active sessions gracefully
        for (const session of sessionStore?.list() ?? []) {
            if (session.state === "active" || session.state === "awaiting_plan_approval") {
                await sessionLifecycle?.kill(session.id, "plugin_unload").catch(() => { });
            }
        }
        // 3. Stop all running goals
        for (const [_id, engine] of goalEngines ?? []) {
            await engine.stop().catch(() => { });
        }
        goalEngines?.clear();
        sessionGoals?.clear();
        log("[openclaw-code-agent] Plugin unloaded.");
    },
});
//# sourceMappingURL=plugin.js.map