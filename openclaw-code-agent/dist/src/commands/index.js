// =============================================================================
// Commands — Chat Command Handlers
// =============================================================================
// Parses chat commands (e.g. /agent, /goal) and delegates to the
// corresponding tool handlers.  Each command resolves session/goal names
// to IDs before invoking the underlying tool.
//
// Section 12 of the specification.
import { toolsByName } from "../tools";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Find a session by its human-readable name.  Names are unique within the
 * active session set.  Returns undefined if no match.
 */
export function findSessionByName(store, name) {
    const sessions = store.list();
    return sessions.find((s) => s.name === name);
}
/**
 * Find a goal engine by the human-readable goal name.
 */
function findGoalEngineByName(ctx, name) {
    for (const [_id, engine] of ctx.goalEngines) {
        const task = engine.getTask();
        if (task && task.name === name) {
            return engine;
        }
    }
    return undefined;
}
function makeCommands(ctx) {
    return {
        /**
         * /agent <name> <...instructions>
         * Launch a new background coding session.
         */
        agent: async (args) => {
            if (args.length < 2) {
                return "Usage: /agent <name> <...instructions>";
            }
            const name = args[0];
            const instructions = args.slice(1).join(" ");
            const tool = toolsByName["agent_launch"];
            const session = await tool.handler({ name, instructions }, ctx);
            return `Session launched: ${session.name} (${session.id})\nState: ${session.state}\nWorkdir: ${session.workdir}`;
        },
        /**
         * /agent_sessions
         * List all active and recent sessions.
         */
        agent_sessions: async (_args) => {
            const tool = toolsByName["agent_sessions"];
            const sessions = await tool.handler({}, ctx);
            if (sessions.length === 0) {
                return "No sessions found.";
            }
            const lines = sessions.map((s) => `- ${s.name} | ${s.state} | ${s.harness} | ${s.workdir}`);
            return `Sessions (${sessions.length}):\n${lines.join("\n")}`;
        },
        /**
         * /agent_output <name>
         * Show buffered output for a session identified by name.
         */
        agent_output: async (args) => {
            if (args.length < 1) {
                return "Usage: /agent_output <name>";
            }
            const name = args[0];
            const session = findSessionByName(ctx.store, name);
            if (!session) {
                return `Session not found: ${name}`;
            }
            const tool = toolsByName["agent_output"];
            const result = await tool.handler({ sessionId: session.id }, ctx);
            const preview = result.output.length > 0
                ? result.output.slice(-2000)
                : "(no output yet)";
            return `Output for ${name} (${result.length} lines total):\n\n${preview}`;
        },
        /**
         * /agent_respond <name> <...message>
         * Send a follow-up message to a session identified by name.
         */
        agent_respond: async (args) => {
            if (args.length < 2) {
                return "Usage: /agent_respond <name> <...message>";
            }
            const name = args[0];
            const message = args.slice(1).join(" ");
            const session = findSessionByName(ctx.store, name);
            if (!session) {
                return `Session not found: ${name}`;
            }
            const tool = toolsByName["agent_respond"];
            await tool.handler({ sessionId: session.id, message }, ctx);
            return `Message sent to ${name}.`;
        },
        /**
         * /agent_kill <name>
         * Kill a session identified by name.
         */
        agent_kill: async (args) => {
            if (args.length < 1) {
                return "Usage: /agent_kill <name>";
            }
            const name = args[0];
            const session = findSessionByName(ctx.store, name);
            if (!session) {
                return `Session not found: ${name}`;
            }
            const tool = toolsByName["agent_kill"];
            await tool.handler({ sessionId: session.id, reason: "user_command" }, ctx);
            return `Session killed: ${name}`;
        },
        /**
         * /agent_stats
         * Show aggregate usage statistics.
         */
        agent_stats: async (_args) => {
            const tool = toolsByName["agent_stats"];
            const stats = await tool.handler({}, ctx);
            const durationSec = Math.round(stats.totalDurationMs / 1000);
            const durationMin = Math.floor(durationSec / 60);
            const durationStr = `${durationMin}m ${durationSec % 60}s`;
            return (`Agent Stats\n` +
                `- Sessions: ${stats.sessionCount}\n` +
                `- Active: ${stats.activeCount}\n` +
                `- Completed: ${stats.completedCount}\n` +
                `- Failed: ${stats.failedCount}\n` +
                `- Total Cost: $${stats.totalCostUsd.toFixed(2)}\n` +
                `- Total Duration: ${durationStr}`);
        },
        /**
         * /goal <name> <...instructions>
         * Launch a goal loop (defaults to ralph type).
         */
        goal: async (args) => {
            if (args.length < 2) {
                return "Usage: /goal <name> <...instructions>";
            }
            const name = args[0];
            const target = args.slice(1).join(" ");
            const tool = toolsByName["goal_launch"];
            const task = await tool.handler({ name, type: "ralph", target, completionSignal: "DONE" }, ctx);
            return `Goal launched: ${task.name} (${task.id})\nType: ${task.type} | Max iterations: ${task.maxIterations}`;
        },
        /**
         * /goal_status [name]
         * Show the status of one or all goals.
         */
        goal_status: async (args) => {
            const tool = toolsByName["goal_status"];
            if (args.length >= 1) {
                const name = args[0];
                const engine = findGoalEngineByName(ctx, name);
                if (!engine) {
                    return `Goal not found: ${name}`;
                }
                const task = engine.getTask();
                const result = await tool.handler({ goalId: task.id }, ctx);
                return (`Goal: ${result.name}\n` +
                    `State: ${result.state}\n` +
                    `Iteration: ${result.currentIteration}/${result.maxIterations}\n` +
                    `Updated: ${result.updatedAt}`);
            }
            const results = await tool.handler({}, ctx);
            if (results.length === 0) {
                return "No goals found.";
            }
            const lines = results.map((g) => `- ${g.name} | ${g.type} | ${g.state} | ${g.currentIteration}/${g.maxIterations}`);
            return `Goals (${results.length}):\n${lines.join("\n")}`;
        },
        /**
         * /goal_stop <name>
         * Stop a goal identified by name.
         */
        goal_stop: async (args) => {
            if (args.length < 1) {
                return "Usage: /goal_stop <name>";
            }
            const name = args[0];
            const engine = findGoalEngineByName(ctx, name);
            if (!engine) {
                return `Goal not found: ${name}`;
            }
            const task = engine.getTask();
            const tool = toolsByName["goal_stop"];
            await tool.handler({ goalId: task.id }, ctx);
            return `Goal stopped: ${name}`;
        },
    };
}
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
/**
 * Parse a raw chat line into command name and arguments.
 * Supports: "/command arg1 arg2 ..." and ".command arg1 arg2 ..."
 */
function parseCommandLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("/") && !trimmed.startsWith(".")) {
        return null;
    }
    const parts = trimmed.slice(1).split(/\s+/);
    if (parts.length === 0)
        return null;
    return { command: parts[0], args: parts.slice(1) };
}
/**
 * Register all chat command handlers onto the plugin context.
 * Returns a dispatch function that processes incoming chat lines.
 */
export function registerCommands(ctx) {
    const commands = makeCommands(ctx);
    const dispatch = async (line) => {
        const parsed = parseCommandLine(line);
        if (!parsed) {
            return ""; // Not a command — pass through
        }
        const handler = commands[parsed.command];
        if (!handler) {
            return `Unknown command: /${parsed.command}. Available: ${Object.keys(commands).join(", ")}`;
        }
        try {
            return await handler(parsed.args, ctx);
        }
        catch (err) {
            return `Error: ${err.message ?? String(err)}`;
        }
    };
    return dispatch;
}
/** Export the command names for discovery / help generation. */
export function getCommandNames() {
    return [
        "agent",
        "agent_sessions",
        "agent_output",
        "agent_respond",
        "agent_kill",
        "agent_stats",
        "goal",
        "goal_status",
        "goal_stop",
    ];
}
//# sourceMappingURL=index.js.map