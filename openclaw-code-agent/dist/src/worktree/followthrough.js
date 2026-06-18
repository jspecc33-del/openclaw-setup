// ============================================================================
// Worktree Follow-Through
// ============================================================================
import { execSync } from "child_process";
import { WorktreeIsolation } from "./isolation";
export class WorktreeFollowThrough {
    isolation;
    constructor() { this.isolation = new WorktreeIsolation(); }
    execGit(cwd, args) {
        const cmd = `git -C "${cwd}" ${args.join(" ")}`;
        try { return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
        catch (err) { throw new Error(`Git command failed: ${cmd}\n${err.stderr?.toString() || ""}`); }
    }
    hasCommits(workdir, branch, baseBranch) {
        try { return parseInt(this.execGit(workdir, ["rev-list", "--count", `${baseBranch}..${branch}`]), 10) > 0; }
        catch { return false; }
    }
    async merge(session, strategy) {
        const { workdir, worktreeBranch, baseBranch, worktreePath } = session;
        if (!worktreeBranch || !baseBranch) return { success: false, message: "Session has no worktree branch or base branch recorded" };
        const repoPath = worktreePath || workdir;
        try {
            if (!this.hasCommits(repoPath, worktreeBranch, baseBranch)) return { success: true, message: "No commits to merge — branches are even" };
            const mainRepoPath = workdir;
            this.execGit(mainRepoPath, ["checkout", baseBranch]);
            const mergeMsg = `Merge worktree branch ${worktreeBranch} (session: ${session.name})`;
            this.execGit(mainRepoPath, ["merge", "--no-ff", "-m", mergeMsg, worktreeBranch]);
            const sha = this.execGit(mainRepoPath, ["rev-parse", "HEAD"]);
            return { success: true, message: `Successfully merged ${worktreeBranch} into ${baseBranch}`, sha };
        } catch (err) {
            const msg = err.message || "";
            if (msg.includes("CONFLICT") || msg.includes("conflict")) {
                try { this.execGit(workdir, ["merge", "--abort"]); } catch {}
                return { success: false, message: `Merge conflict detected when merging ${worktreeBranch} into ${baseBranch}. Please resolve manually.` };
            }
            return { success: false, message: `Merge failed: ${msg}` };
        }
    }
    async openPr(session, title, body) {
        const { worktreeBranch, baseBranch, workdir } = session;
        if (!worktreeBranch || !baseBranch) return { success: false, message: "Session has no worktree branch or base branch recorded" };
        if (!this.isolation.hasGhCli()) return { success: false, message: "GitHub CLI (`gh`) is not installed. Install it from https://cli.github.com/" };
        try {
            this.execGit(workdir || ".", ["push", "-u", "origin", worktreeBranch]);
            const prTitle = title || `OpenClaw: ${session.name}`;
            const prBody = body || `Changes from OpenClaw Code Agent session "${session.name}".`;
            const output = execSync(`gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --base "${baseBranch}" --head "${worktreeBranch}"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
            const prUrlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
            const prUrl = prUrlMatch ? prUrlMatch[0] : undefined;
            return { success: true, prUrl, message: prUrl ? `PR created: ${prUrl}` : "PR created successfully" };
        } catch (err) {
            return { success: false, message: `Failed to create PR: ${err.stderr?.toString() || err.message || ""}` };
        }
    }
    async discard(session) {
        const { worktreePath, worktreeBranch } = session;
        if (!worktreePath || !worktreeBranch) return { success: false, message: "Session has no worktree to discard" };
        try {
            await this.isolation.remove(worktreePath);
            return { success: true, message: `Discarded worktree at ${worktreePath} and branch ${worktreeBranch}` };
        } catch (err) { return { success: false, message: `Failed to discard worktree: ${err.message}` }; }
    }
}
//# sourceMappingURL=followthrough.js.map