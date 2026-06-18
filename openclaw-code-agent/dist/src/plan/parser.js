// ============================================================================
// Plan Parser
// ============================================================================
export class PlanParser {
    parse(output) {
        const claudeMatch = this.extractClaudeStyle(output);
        if (claudeMatch)
            return claudeMatch;
        const markdownMatch = this.extractMarkdownStyle(output);
        if (markdownMatch)
            return markdownMatch;
        const fallbackMatch = this.extractNumberedList(output);
        if (fallbackMatch)
            return fallbackMatch;
        return { plan: null, remaining: output };
    }
    extractClaudeStyle(output) {
        const beginMarker = "--- PLAN BEGIN ---";
        const endMarker = "--- PLAN END ---";
        const beginIdx = output.indexOf(beginMarker);
        const endIdx = output.indexOf(endMarker);
        if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return null;
        const plan = output.slice(beginIdx + beginMarker.length, endIdx).trim();
        const before = output.slice(0, beginIdx);
        const after = output.slice(endIdx + endMarker.length);
        return { plan, remaining: (before + "\n" + after).trim() };
    }
    extractMarkdownStyle(output) {
        const planHeader = "## Plan";
        const implHeader = "## Implementation";
        const planIdx = output.indexOf(planHeader);
        const implIdx = output.indexOf(implHeader);
        if (planIdx === -1 || implIdx === -1 || implIdx <= planIdx) return null;
        const plan = output.slice(planIdx + planHeader.length, implIdx).trim();
        const before = output.slice(0, planIdx);
        const after = output.slice(implIdx);
        return { plan, remaining: (before + "\n" + after).trim() };
    }
    extractNumberedList(output) {
        const lines = output.split("\n");
        const numberedLineRegex = /^(\d+)\.\s+/;
        let startIdx = -1;
        let endIdx = -1;
        let expectedNum = 1;
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(numberedLineRegex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (startIdx === -1 && num === 1) { startIdx = i; expectedNum = 2; }
                else if (startIdx !== -1 && num === expectedNum) { expectedNum++; }
                else if (startIdx !== -1) { endIdx = i - 1; break; }
            } else if (startIdx !== -1 && lines[i].trim() === "" && i + 1 < lines.length) {
                const nextMatch = lines[i + 1].match(numberedLineRegex);
                if (nextMatch && parseInt(nextMatch[1], 10) === expectedNum) continue;
                else { endIdx = i - 1; break; }
            } else if (startIdx !== -1) { endIdx = i - 1; break; }
        }
        if (startIdx !== -1 && endIdx === -1) endIdx = lines.length - 1;
        if (startIdx === -1 || expectedNum < 4) return null;
        const plan = lines.slice(startIdx, endIdx + 1).join("\n").trim();
        const before = lines.slice(0, startIdx).join("\n");
        const after = lines.slice(endIdx + 1).join("\n");
        return { plan, remaining: (before + "\n" + after).trim() };
    }
}
//# sourceMappingURL=parser.js.map