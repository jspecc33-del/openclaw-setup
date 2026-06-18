// ============================================================================
// Plan Parser — Extract structured plan artifacts from harness output
// Spec: Section 8.1
// ============================================================================
/**
 * Detects and extracts plan artifacts from harness output.
 * Supports multiple marker styles used by different harnesses.
 */
export class PlanParser {
    /**
     * Parse harness output and extract any embedded plan.
     *
     * Detection order (first match wins):
     *   1. Claude Code style:  --- PLAN BEGIN --- ... --- PLAN END ---
     *   2. Markdown style:     ## Plan ... ## Implementation
     *   3. Fallback:           numbered list lines (1. ... 2. ...)
     *
     * @param output — raw harness output string
     * @returns parsed plan and remaining output
     */
    parse(output) {
        // 1. Claude Code style markers
        const claudeMatch = this.extractClaudeStyle(output);
        if (claudeMatch)
            return claudeMatch;
        // 2. Markdown section style (## Plan → ## Implementation)
        const markdownMatch = this.extractMarkdownStyle(output);
        if (markdownMatch)
            return markdownMatch;
        // 3. Fallback: numbered list pattern
        const fallbackMatch = this.extractNumberedList(output);
        if (fallbackMatch)
            return fallbackMatch;
        // No plan detected
        return { plan: null, remaining: output };
    }
    /**
     * Extract plan between --- PLAN BEGIN --- and --- PLAN END --- markers.
     */
    extractClaudeStyle(output) {
        const beginMarker = "--- PLAN BEGIN ---";
        const endMarker = "--- PLAN END ---";
        const beginIdx = output.indexOf(beginMarker);
        const endIdx = output.indexOf(endMarker);
        if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
            return null;
        }
        const planStart = beginIdx + beginMarker.length;
        const plan = output.slice(planStart, endIdx).trim();
        const before = output.slice(0, beginIdx);
        const after = output.slice(endIdx + endMarker.length);
        const remaining = (before + "\n" + after).trim();
        return { plan, remaining };
    }
    /**
     * Extract plan between ## Plan and ## Implementation markdown headers.
     */
    extractMarkdownStyle(output) {
        const planHeader = "## Plan";
        const implHeader = "## Implementation";
        const planIdx = output.indexOf(planHeader);
        const implIdx = output.indexOf(implHeader);
        if (planIdx === -1 || implIdx === -1 || implIdx <= planIdx) {
            return null;
        }
        const planStart = planIdx + planHeader.length;
        const plan = output.slice(planStart, implIdx).trim();
        const before = output.slice(0, planIdx);
        const after = output.slice(implIdx);
        const remaining = (before + "\n" + after).trim();
        return { plan, remaining };
    }
    /**
     * Fallback: detect a contiguous block of numbered list lines.
     * Looks for 3+ consecutive lines starting with "N. " where N increments.
     */
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
                if (startIdx === -1 && num === 1) {
                    startIdx = i;
                    expectedNum = 2;
                }
                else if (startIdx !== -1 && num === expectedNum) {
                    expectedNum++;
                }
                else if (startIdx !== -1) {
                    // Sequence broken — record end and reset
                    endIdx = i - 1;
                    break;
                }
            }
            else if (startIdx !== -1 && lines[i].trim() === "" && i + 1 < lines.length) {
                // Allow blank lines within the list — continue
                const nextMatch = lines[i + 1].match(numberedLineRegex);
                if (nextMatch && parseInt(nextMatch[1], 10) === expectedNum) {
                    continue;
                }
                else {
                    endIdx = i - 1;
                    break;
                }
            }
            else if (startIdx !== -1) {
                // Non-numbered, non-blank line breaks the sequence
                endIdx = i - 1;
                break;
            }
        }
        // If we started but never ended, capture to end
        if (startIdx !== -1 && endIdx === -1) {
            endIdx = lines.length - 1;
        }
        // Require at least 3 numbered items to consider it a plan
        if (startIdx === -1 || expectedNum < 4) {
            return null;
        }
        const plan = lines.slice(startIdx, endIdx + 1).join("\n").trim();
        const before = lines.slice(0, startIdx).join("\n");
        const after = lines.slice(endIdx + 1).join("\n");
        const remaining = (before + "\n" + after).trim();
        return { plan, remaining };
    }
}
//# sourceMappingURL=parser.js.map