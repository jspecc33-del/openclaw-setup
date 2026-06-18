// =============================================================================
// Routing — Wake Router
// =============================================================================
// WakeRouter is responsible for notifying the OpenClaw orchestrator when a
// session requires attention (plan approval, completion, error, worktree
// decision) and for sending canonical completion summaries back to the origin
// route and thread.
//
// Section 11.1 of the specification.
/**
 * WakeRouter manages the two-step completion contract between the plugin
 * and the OpenClaw orchestrator:
 *   1. Plugin delivers a canonical outcome status (wake).
 *   2. Orchestrator reads full output and sends a concise factual summary
 *      to the origin route / thread.
 */
export class WakeRouter {
    /**
     * Notify the orchestrator that a session needs attention.
     * In a full implementation this calls the OpenClaw SDK wake endpoint;
     * here we log the wake for debugging / development.
     */
    async wakeOrchestrator(session, reason, context = {}) {
        const payload = {
            session,
            reason,
            context,
            timestamp: new Date().toISOString(),
        };
        // Placeholder: in production this calls the OpenClaw SDK wake mechanism.
        // e.g. await openclawSdk.wake({ route: session.originRoute, threadId: session.originThreadId, payload });
        console.log(`[WAKE] reason=${reason} session=${session.id} name=${session.name}`);
        console.log(`[WAKE] payload=${JSON.stringify(payload, null, 2)}`);
    }
    /**
     * Send a completion summary to the origin route and thread.
     * The orchestrator consumes this to deliver a concise factual summary
     * to the user in the original chat channel.
     */
    async sendCompletionSummary(session, summary) {
        const route = session.originRoute ?? "default";
        const threadId = session.originThreadId ?? session.id;
        const payload = {
            route,
            threadId,
            sessionId: session.id,
            sessionName: session.name,
            summary,
            costUsd: session.costUsd ?? 0,
            durationMs: session.durationMs ?? 0,
            timestamp: new Date().toISOString(),
        };
        // Placeholder: in production this dispatches via the OpenClaw SDK.
        // e.g. await openclawSdk.sendMessage(route, threadId, { text: summary });
        console.log(`[COMPLETION] route=${route} thread=${threadId}`);
        console.log(`[COMPLETION] summary=${summary}`);
        console.log(`[COMPLETION] payload=${JSON.stringify(payload, null, 2)}`);
    }
}
//# sourceMappingURL=wake.js.map