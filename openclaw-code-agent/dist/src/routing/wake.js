// =============================================================================
// Routing — Wake Router
// =============================================================================
export class WakeRouter {
    async wakeOrchestrator(session, reason, context = {}) {
        const payload = { session, reason, context, timestamp: new Date().toISOString() };
        console.log(`[WAKE] reason=${reason} session=${session.id} name=${session.name}`);
        console.log(`[WAKE] payload=${JSON.stringify(payload, null, 2)}`);
    }
    async sendCompletionSummary(session, summary) {
        const route = session.originRoute ?? "default";
        const threadId = session.originThreadId ?? session.id;
        const payload = {
            route, threadId, sessionId: session.id, sessionName: session.name,
            summary, costUsd: session.costUsd ?? 0, durationMs: session.durationMs ?? 0,
            timestamp: new Date().toISOString(),
        };
        console.log(`[COMPLETION] route=${route} thread=${threadId}`);
        console.log(`[COMPLETION] summary=${summary}`);
        console.log(`[COMPLETION] payload=${JSON.stringify(payload, null, 2)}`);
    }
}
//# sourceMappingURL=wake.js.map