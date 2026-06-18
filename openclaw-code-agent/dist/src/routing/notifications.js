// =============================================================================
// Routing — Notification Formatting
// =============================================================================
export function formatPlanReview(session, plan, markdown = true) {
    const header = markdown
        ? `## Plan Review Required\n\n**Session:** \`${session.name}\`\n**ID:** \`${session.id}\``
        : `Plan Review Required\n\nSession: ${session.name}\nID: ${session.id}`;
    const fence = "```";
    const planBlock = markdown
        ? `\n\n---\n\n**Plan:**\n\n${fence}\n${plan.content}\n${fence}`
        : `\n\nPlan:\n${plan.content}`;
    const actions = markdown
        ? `\n\n**Actions:** [Approve] [Revise] [Reject]`
        : `\n\nActions: Approve / Revise / Reject`;
    return `${header}${planBlock}${actions}`;
}
export function formatWorktreeDecision(session, markdown = true) {
    const header = markdown
        ? `## Worktree Decision\n\n**Session:** \`${session.name}\`\n**Branch:** \`${session.worktreeBranch ?? "n/a"}\``
        : `Worktree Decision\n\nSession: ${session.name}\nBranch: ${session.worktreeBranch ?? "n/a"}`;
    const actions = markdown
        ? `\n\n**Actions:** [Merge] [Open PR] [Later] [Discard]`
        : `\n\nActions: Merge / Open PR / Later / Discard`;
    return `${header}${actions}`;
}
export function formatCompletion(session, markdown = true) {
    const statusIcon = session.state === "completed" ? "✅" : session.state === "failed" ? "❌" : "⚠️";
    const duration = session.durationMs ? `${Math.round(session.durationMs / 1000)}s` : "unknown";
    const cost = session.costUsd !== undefined ? `$${session.costUsd.toFixed(2)}` : "unknown";
    if (markdown) {
        return `${statusIcon} **Session Complete**\n- **Name:** ${session.name}\n- **State:** ${session.state}\n- **Duration:** ${duration}\n- **Cost:** ${cost}\n- **Branch:** \`${session.worktreeBranch ?? "n/a"}\``;
    }
    return `${statusIcon} Session Complete\n- Name: ${session.name}\n- State: ${session.state}\n- Duration: ${duration}\n- Cost: ${cost}\n- Branch: ${session.worktreeBranch ?? "n/a"}`;
}
export function formatStats(stats, markdown = true) {
    const durationSeconds = Math.round(stats.totalDurationMs / 1000);
    const durationMin = Math.floor(durationSeconds / 60);
    const durationSec = durationSeconds % 60;
    const durationStr = `${durationMin}m ${durationSec}s`;
    if (markdown) {
        return `## Agent Stats\n- **Sessions:** ${stats.sessionCount}\n- **Active:** ${stats.activeCount}\n- **Completed:** ${stats.completedCount}\n- **Failed:** ${stats.failedCount}\n- **Total Cost:** $${stats.totalCostUsd.toFixed(2)}\n- **Total Duration:** ${durationStr}`;
    }
    return `Agent Stats\n- Sessions: ${stats.sessionCount}\n- Active: ${stats.activeCount}\n- Completed: ${stats.completedCount}\n- Failed: ${stats.failedCount}\n- Total Cost: $${stats.totalCostUsd.toFixed(2)}\n- Total Duration: ${durationStr}`;
}
//# sourceMappingURL=notifications.js.map