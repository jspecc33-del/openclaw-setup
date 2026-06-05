// ============================================================================
// Worktree Isolation
// ============================================================================
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
export class WorktreeIsolation {
    generateShortId() { return Math.random().toString(36).substring(2, 8); }
    sanitizeSessionName(name) {
        return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").substring(0, 40);
    }
    execGit(workdir, args) {
        const cmd = `git -C "${workdir}" ${args.join(" ")}`;
        try {
            return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        } catch (err) {
            throw new Error(`Git command failed: ${cmd}\n${err.stderr?.toString() || ""}`);
        }
    }
    isGitRepo(workdir) {
        try {
            const gitDir = path.join(workdir, ".git");
            if (fs.existsSync(gitDir)) return true;
            execSync(`git -C "${workdir}" rev-parse --git-dir`, { encoding: "utf-8", stdio: "pipe" });
            return true;
        } catch { return false; }
    }
    hasGhCli() {
        try { execSync("gh --version", { encoding: "utf-8", stdio: "pipe" }); return true; }
        catch { return false; }
    }
    getCurrentBranch(workdir) { return this.execGit(workdir, ["branch", "--show-current"]); }
    async create(workdir, sessionName) {
        if (!this.isGitRepo(workdir)) throw new Error(`Not a Git repository: ${workdir}`);
        const baseBranch = this.getCurrentBranch(workdir);
        const shortId = this.generateShortId();
        const sanitized = this.sanitizeSessionName(sessionName);
        const branch = `oca/${sanitized}-${shortId}`;
        const parentDir = path.dirname(workdir);
        const worktreeDirName = `oca-${sanitized}-${shortId}`;
        let worktreePath = path.resolve(parentDir, worktreeDirName);
        try {
            fs.accessSync(parentDir, fs.constants.W_OK);
            if (fs.existsSync(worktreePath)) worktreePath = path.join(os.tmpdir(), worktreeDirName);
        } catch { worktreePath = path.join(os.tmpdir(), worktreeDirName); }
        this.execGit(workdir, ["branch", branch]);
        this.execGit(workdir, ["worktree", "add", worktreePath, branch]);
        return { branch, worktreePath, baseBranch };
    }
    async remove(worktreePath) {
        let branch;
        try { branch = execSync(`git -C "${worktreePath}" branch --show-current`, { encoding: "utf-8", stdio: "pipe" }).trim(); } catch {}
        try {
            const gitFile = path.join(worktreePath, ".git");
            let mainRepoDir;
            if (fs.existsSync(gitFile)) {
                const gitFileContent = fs.readFileSync(gitFile, "utf-8");
                const match = gitFileContent.match(/gitdir:\s*(.+)/);
                if (match) {
                    const worktreeAdminDir = path.resolve(worktreePath, match[1].trim());
                    mainRepoDir = path.dirname(path.dirname(worktreeAdminDir));
                }
            }
            if (mainRepoDir) {
                this.execGit(mainRepoDir, ["worktree", "remove", "-f", worktreePath]);
                if (branch) this.execGit(mainRepoDir, ["branch", "-D", branch]);
            } else {
                try { execSync(`git worktree remove -f "${worktreePath}"`, { encoding: "utf-8", stdio: "pipe" }); }
                catch { fs.rmSync(worktreePath, { recursive: true, force: true }); }
                if (branch) {
                    try { execSync(`git branch -D "${branch}"`, { encoding: "utf-8", stdio: "pipe" }); } catch {}
                }
            }
        } catch (err) { throw new Error(`Failed to remove worktree at ${worktreePath}: ${err.message}`); }
    }
}
//# sourceMappingURL=isolation.js.map