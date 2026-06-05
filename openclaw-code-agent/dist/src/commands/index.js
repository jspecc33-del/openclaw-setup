// =============================================================================
// Commands — Chat Command Handlers
// =============================================================================
import { toolsByName } from "../tools";
export function findSessionByName(store, name) {
    return store.list().find((s) => s.name === name);
}
function findGoalEngineByName(ctx, name) {
    for (const [_id, engine] of ctx.goalEngines) {
        const task = engine.getTask();
        if (task && task.name === name) return engine;
    }
    return undefined;
}
function makeCommands(ctx) {
    return {
        agent: async (args) => {
            if (args.length < 2) return "Usage: /agent <name> <...instructions>";
            const session = await toolsByName["agent_launch"].handler({ name: args[0], instructions: args.slice(1).join(" ") }, ctx);
            return `Session launched: ${session.name} (${session.id})\nState: ${session.state}\nWorkdir: ${session.workdir}`;
        },
        agent_sessions: async (_args) => {
            const sessions = await toolsByName["agent_sessions"].handler({}, ctx);
            if (sessions.length === 0) return "No sessions found.";
            return `Sessions (${sessions.length}):\n${sessions.map((s) => `- ${s.name} | ${s.state} | ${s.harness} | ${s.workdir}`).join("\n")}`;
        },
        agent_output: async (args) => {
            if (args.length < 1) return "Usage: /agent_output <name>";
            const session = findSessionByName(ctx.store, args[0]);
            if (!session) return `Session not found: ${args[0]}`;
            const result = await toolsByName["agent_output"].handler({ sessionId: session.id }, ctx);
            return `Output for ${args[0]} (${result.length} lines total):\n\n${result.output.length > 0 ? result.output.slice(-2000) : "(no output yet)"}`;
        },
        agent_respond: async (args) => {
            if (args.length < 2) return "Usage: /agent_respond <name> <...message>";
            const session = findSessionByName(ctx.store, args[0]);
            if (!session) return `Session not found: ${args[0]}`;
            await toolsByName["agent_respond"].handler({ sessionId: session.id, message: args.slice(1).join(" ") }, ctx);
            return `Message sent to ${args[0]}.`;
        },
        agent_kill: async (args) => {
            if (args.length < 1) return "Usage: /agent_kill <name>";
            const session = findSessionByName(ctx.store, args[0]);
            if (!session) return `Session not found: ${args[0]}`;
            await toolsByName["agent_kill"].handler({ sessionId: session.id, reason: "user_command" }, ctx);
            return `Session killed: ${args[0]}`;
        },
        agent_stats: async (_args) => {
            const stats = await toolsByName["agent_stats"].handler({}, ctx);
            const durationSec = Math.round(stats.totalDurationMs / 1000);
            const durationMin = Math.floor(durationSec / 60);
            return `Agent Stats\n- Sessions: ${stats.sessionCount}\n- Active: ${stats.activeCount}\n- Completed: ${stats.completedCount}\n- Failed: ${stats.failedCount}\n- Total Cost: $${stats.totalCostUsd.toFixed(2)}\n- Total Duration: ${durationMin}m ${durationSec % 60}s`;
        },
        goal: async (args) => {
            if (args.length < 2) return "Usage: /goal <name> <...instructions>";
            const task = await toolsByName["goal_launch"].handler({ name: args[0], type: "ralph", target: args.slice(1).join(" "), completionSignal: "DONE" }, ctx);
            return `Goal launched: ${task.name} (${task.id})\nType: ${task.type} | Max iterations: ${task.maxIterations}`;
        },
        goal_status: async (args) => {
            if (args.length >= 1) {
                const engine = findGoalEngineByName(ctx, args[0]);
                if (!engine) return `Goal not found: ${args[0]}`;
                const task = engine.getTask();
                const result = await toolsByName["goal_status"].handler({ goalId: task.id }, ctx);
                return `Goal: ${result.name}\nState: ${result.state}\nIteration: ${result.currentIteration}/${result.maxIterations}\nUpdated: ${result.updatedAt}`;
            }
            const results = await toolsByName["goal_status"].handler({}, ctx);
            if (results.length === 0) return "No goals found.";
            return `Goals (${results.length}):\n${results.map((g) => `- ${g.name} | ${g.type} | ${g.state} | ${g.currentIteration}/${g.maxIterations}`).join("\n")}`;
        },
        goal_stop: async (args) => {
            if (args.length < 1) return "Usage: /goal_stop <name>";
            const engine = findGoalEngineByName(ctx, args[0]);
            if (!engine) return `Goal not found: ${args[0]}`;
            const task = engine.getTask();
            await toolsByName["goal_stop"].handler({ goalId: task.id }, ctx);
            return `Goal stopped: ${args[0]}`;
        },
    };
}
function parseCommandLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("/") && !trimmed.startsWith(".")) return null;
    const parts = trimmed.slice(1).split(/\s+/);
    if (parts.length === 0) return null;
    return { command: parts[0], args: parts.slice(1) };
}
export function registerCommands(ctx) {
    const commands = makeCommands(ctx);
    return async (line) => {
        const parsed = parseCommandLine(line);
        if (!parsed) return "";
        const handler = commands[parsed.command];
        if (!handler) return `Unknown command: /${parsed.command}. Available: ${Object.keys(commands).join(", ")}`;
        try { return await handler(parsed.args, ctx); }
        catch (err) { return `Error: ${err.message ?? String(err)}`; }
    };
}
export function getCommandNames() {
    return ["agent", "agent_sessions", "agent_output", "agent_respond", "agent_kill", "agent_stats", "goal", "goal_status", "goal_stop"];
}
//# sourceMappingURL=index.js.map