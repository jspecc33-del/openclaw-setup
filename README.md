# OpenClaw Setup Guide

Companion guide for the NetworkChuck video: [OpenClaw....RIGHT NOW?? (it's not what you think)](https://youtu.be/T-HZHO_PQPY)

Every command from the video, in order, so you can follow along.

---

## What You Need

- A Linux server (VPS or local machine you can SSH into)
- An OpenAI or Anthropic account (or Ollama for local models)
- Telegram on your phone
- Coffee

### Get a VPS

I'm using [Hostinger](https://hostinger.com/ncopenclaw) — use code **NETWORKCHUCK** for a discount.

1. Go to [hostinger.com/ncopenclaw](https://hostinger.com/ncopenclaw)
2. Go to **Services** > **VPS Hosting**
3. Choose **KVM 2**
4. Enter coupon code `NETWORKCHUCK`
5. Wait for your VPS to provision

---

## 1. Connect to Your Server

Grab the SSH command from your Hostinger dashboard (or use your own server's IP).

```bash
ssh root@YOUR_SERVER_IP
```

---

## 2. Install OpenClaw

Go to [openclaw.ai](https://openclaw.ai) and grab the one-liner install command. Or just run:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

> **Note:** Documentation changes frequently. Always check [openclaw.ai](https://openclaw.ai) for the latest install command.

When the install finishes, it'll walk you through a quick start wizard.

---

## 3. Choose Your AI Model

OpenClaw is **not** an AI model — it's a harness that sits on top of other models. Pick your brain:

| Provider | How to Connect |
|----------|---------------|
| **OpenAI** (recommended) | OAuth (use existing ChatGPT Pro subscription) or API key |
| **Anthropic** | API key |
| **Ollama** | Local models, officially supported |

### Using OpenAI OAuth (existing ChatGPT subscription)

1. Select the OAuth option in the wizard
2. Copy the URL it gives you
3. Paste it in your web browser
4. Log in to your ChatGPT account
5. Don't worry about the scary message — grab the redirect URL from your browser's URL bar
6. Paste that redirect URL back in your terminal
7. Choose the default model (GPT 5.4)

---

## 4. Set Up Telegram

When asked how to talk to your agent, choose **Telegram**.

### Create a Telegram Bot

1. Open Telegram
2. Start a chat with **@BotFather**
3. Send `/newbot`
4. Name your bot (e.g., "Terry Three O")
5. Give it a username (must end in `bot`)
6. Copy the bot token

Paste the bot token into the setup wizard.

### Remaining Setup Options

| Option | What to Choose |
|--------|---------------|
| Web search | Brave (or skip) |
| API key for search | Hit enter to skip |
| Configure skills | No (for now) |
| Hooks | Enable **bootstrap**, **command logger**, and **session memory** |

---

## 5. Launch Your Agent

Choose **TUI** (terminal user interface) to hatch your agent.

```
# The wizard will ask — select TUI
```

Now you're talking to your agent. Configure it by telling it who it is:

```
You're Terry Crews. You are a NetworkChuck fan. You're chaotic.
```

Everything you say here gets written to its `soul.md` file.

---

## 6. Connect Telegram

1. Go to Telegram and find your bot
2. Send `/start`
3. Your agent will give you pairing instructions in the terminal
4. Copy the pairing info and paste it back to your agent in the TUI
5. Tell it: "Continue configuring Telegram for me"

### Test It

Send a message in Telegram:

```
Hey, you there?
```

Your agent should respond. You now have OpenClaw running and accessible from your phone.

---

## 7. Build Something Real

### Project 1: AI News Briefing

Send this to your agent via Telegram:

```
I want a cybersecurity news briefing. Scrape Reddit, check Hacker News,
find YouTube videos. Don't just give me links — rate each one and
tell me if it's worth my time to read. Then make it a web dashboard.
```

> This is what took an entire [n8n workflow video](https://youtube.com/watch?v=ONgECvZNI3o) to build. One sentence.

### Project 2: IT Engineer

Start a new context with `/new` in Telegram, then:

```
You're an IT engineer. Your first job is to monitor the server you're on.
Check everything — internet speed, RAM, CPU, security logs — and create
a dashboard for me. Go.
```

To enable high thinking mode before sending a complex prompt, toggle it in Telegram.

---

## 8. Explore the Files

Everything OpenClaw does lives in files on your server. No magic.

### OpenClaw Home Directory

```bash
cd ~/.openclaw
ls
```

### Agent Workspace

```bash
cd ~/.openclaw/workspace
ls
```

### Key Files

```bash
# Your agent's personality
cat soul.md

# Your agent's identity (name, role, facts)
cat identity.md

# Long-term memory
cat memory.md

# Daily journals
cd memory
ls
cat 2026-03-16.md  # (replace with today's date)
```

### The AGENTS.md File

This is your agent's "birth certificate" — how it wakes up, what it loads, how it behaves.

```bash
cat agents.md
```

Contains: bootstrap instructions, red lines, protocols for when to reach out vs. stay quiet.

### Verify the Gateway is Running

```bash
ps aux | grep claw
```

You should see a Node.js process — that's the OpenClaw gateway.

---

## 9. Cron Jobs and Heartbeats

These make your agent feel alive. Tell your agent:

```
Every 30 minutes, remind me to drink coffee.
```

```
Every hour, just pop in to say hi and see how I'm doing.
```

### Verify Cron Jobs

```bash
cd ~/.openclaw
cat cron/jobs
```

Or use the CLI:

```bash
openclaw cron list
```

---

## 10. ClawHub Skills

[ClawHub](https://clawhub.com) has 33,000+ skills. **Be careful** — 12% were found with malware. They've partnered with VirusTotal to scan them, but always review what you install.

### Install ClawHub CLI

```bash
npm i -g clawhub
```

### Install a Skill

```bash
clawhub install word-docx
```

Your agent now knows how to create Word documents.

---

## 11. Browser Access

Your agent has a headless browser. Try:

```
Go to networkchuck.coffee in your web browser and tell me what you see.
```

---

## 12. Sub-Agents

Deploy a sub-agent from within a conversation:

```
Deploy a sub agent to research the best way to make coffee.
```

### Telegram Commands

```
/status        — See what your agent is doing right now
/subagents list — List all active sub-agents
/new           — Start a new conversation context
```

---

## 13. Security

### Run a Security Audit

```bash
# Basic audit
openclaw security audit

# Deep scan
openclaw security audit --deep

# Auto-fix issues (careful — may break things)
openclaw security audit --fix
```

### Firewall (UFW)

Your firewall is probably not enabled. Fix that:

```bash
# Allow SSH so you don't lock yourself out
ufw allow 22/tcp

# Enable the firewall
ufw enable

# Allow specific ports as needed (e.g., for web dashboards)
ufw allow 8787/tcp
```

### Web UI

OpenClaw has a web UI on port 18789, bound to `127.0.0.1` (localhost) by default — not accessible from the internet. Good.

**Check if your web UI is exposed:**

Open `http://YOUR_PUBLIC_IP:18789` in a browser. If you can't access it, nobody else can either.

**Access it securely via SSH tunnel:**

Run this from your LOCAL machine (not the server):

```bash
ssh -L 18789:127.0.0.1:18789 YOUR_USERNAME@YOUR_SERVER_IP
```

Then open `http://localhost:18789` in your browser.

**Get your gateway token:**

```bash
openclaw config
```

Navigate to **Gateway** > **Token** > **Generate**. Copy the token and paste it into the web UI login.

---

## 14. Tool Profiles and Execution Security

### Tool Profiles

Controls what tools your agent can **see**.

```bash
# Check current profile
openclaw config get tools.profile
```

| Profile | What It Can See |
|---------|----------------|
| `coding` (default) | Read/write files, run terminal commands |
| `full` | Everything — browser, web search, all tools |

```bash
# Upgrade to full
openclaw config set tools.profile full

# Restart gateway to apply
openclaw gateway restart
```

### Tool Execution

Controls what your agent is **allowed to do** with the tools it can see.

```bash
# Check current exec config
openclaw config get tools.exec
```

**Security options:**

| Setting | What It Means |
|---------|--------------|
| `security: full` | Agent can use any tool without asking |
| `security: allowlist` | Agent can only use approved tools |
| `security: deny` | Agent can't use any tools |

**Ask options:**

| Setting | What It Means |
|---------|--------------|
| `ask: off` | Never asks permission |
| `ask: always` | Always asks before using a tool |
| `ask: on_miss` | Asks only when tool isn't on the allow list |

```bash
# Set execution security
openclaw config set tools.exec.security full

# Set ask behavior
openclaw config set tools.exec.ask off
```

### View the Full Config

```bash
cat ~/.openclaw/openclaw.json
```

---

## 15. Red Lines

In your agent's `AGENTS.md` file, there's a **red lines** section — things your agent must NEVER do.

```bash
cat ~/.openclaw/workspace/agents.md
```

Default red lines:
- Don't exfiltrate private data
- Don't run destructive commands without asking
- When in doubt, ask

**Add your own** by editing the file or telling your agent:

```
Add a red line: never modify SSH config without asking me first.
```

You can also set **yellow lines** (do it but log it) for things like firewall changes or Docker commands.

> **Important:** Red lines are prompt-level instructions. There's nothing deterministic preventing your agent from crossing them. It's a strong suggestion, not a physical barrier.

---

## 16. Telegram Security

Make sure you're the only one who can talk to your agent:

```
Make sure I'm the only one allowed to talk to you.
```

This should already be configured by default, but verify it.

---

## Quick Reference

### Useful OpenClaw CLI Commands

| Command | What It Does |
|---------|-------------|
| `openclaw security audit` | Run security audit |
| `openclaw security audit --deep` | Deep security scan |
| `openclaw security audit --fix` | Auto-fix security issues |
| `openclaw config` | Open config TUI |
| `openclaw config get tools.profile` | Check tool profile |
| `openclaw config set tools.profile full` | Set tool profile to full |
| `openclaw config get tools.exec` | Check exec security |
| `openclaw config set tools.exec.security full` | Set exec to full access |
| `openclaw config set tools.exec.ask off` | Disable tool approval prompts |
| `openclaw gateway restart` | Restart the gateway |
| `openclaw cron list` | List scheduled cron jobs |

### Key File Locations

| File | Location | Purpose |
|------|----------|---------|
| Soul | `~/.openclaw/workspace/soul.md` | Agent personality |
| Identity | `~/.openclaw/workspace/identity.md` | Agent facts/role |
| Memory | `~/.openclaw/workspace/memory.md` | Long-term memory |
| Daily Journal | `~/.openclaw/workspace/memory/YYYY-MM-DD.md` | Daily logs |
| AGENTS.md | `~/.openclaw/workspace/agents.md` | Boot instructions + red lines |
| Config | `~/.openclaw/openclaw.json` | Full OpenClaw config |
| Cron Jobs | `~/.openclaw/cron/jobs` | Scheduled tasks |

### Telegram Commands

| Command | What It Does |
|---------|-------------|
| `/start` | Start talking to your agent |
| `/new` | New conversation context |
| `/status` | See current agent status |
| `/subagents list` | List active sub-agents |

---

## Links

- [OpenClaw](https://openclaw.ai) — Official site
- [ClawHub](https://clawhub.com) — Skills marketplace
- [Hostinger VPS](https://hostinger.com/ncopenclaw) — Use code **NETWORKCHUCK**
- [NetworkChuck Academy](https://ntck.co/NCAcademy) — OpenClaw course
- [NetworkChuck Coffee](https://networkchuck.coffee) — Because everything in IT requires coffee
- [n8n Video](https://youtube.com/watch?v=ONgECvZNI3o) — The workflow OpenClaw replaced in one sentence

---

## More in This Series

This is Episode 1 of the OpenClaw series. Coming up:
- **Episode 2:** Building an AI IT Department (multiple agents, ticketing, home lab management)
- **Episode 3:** Deep dive on OpenClaw security

Subscribe so you don't miss it.
