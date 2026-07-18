# PracticePro Agent System — Architecture Overview

## How This Works

You are the human-in-the-loop. Each agent runs as a separate conversation. The Orchestrator is the first agent you start — it coordinates all the others.

## Communication Protocol

Agents communicate via a shared worklog file at `/home/z/my-project/worklog.md`. Each agent:
1. Reads the worklog before starting work
2. Appends its findings/decisions/results to the worklog when done
3. References other agents' work by Task ID

**Worklog entry format:**
```
---
Task ID: <task id>
Agent: <agent name>
Status: <in-progress | complete | blocked>
Summary: <1-2 sentence human-readable summary>
Details: <key findings, files modified, decisions made>
Handoff to: <next agent name + what they need to do>
```

## The Agents

### 1. ORCHESTRATOR (you start this first)
- Role: Project manager + coordinator
- Runs in this conversation
- Reads your instructions, breaks them into tasks, assigns to other agents
- Tracks what's done, what's blocked, what's next
- You talk to this agent; it talks to the others via the worklog

### 2. CODEX (Engineering)
- Role: Senior full-stack engineer
- Handles: Vite/React/TypeScript code, Convex backend, bug fixes, features
- Knows: The codebase structure, the tech stack, the file conventions
- Prompt file: `02_CODEX_Engineering_Agent.md`

### 3. ALOA (AI & Product Intelligence)
- Role: AI/UX strategist
- Handles: ALOA chat behavior, DraftPro drafting pipeline, jurisdiction engine, citation classifier
- Knows: The AI system prompts, the Gemini integration, the legal logic
- Prompt file: `03_ALOA_AI_Product_Agent.md`

### 4. DESIGNER (UI/UX)
- Role: Frontend designer
- Handles: CSS/Tailwind, responsive design, mobile layout, component styling
- Knows: The STYLE_GUIDE.md, the brand colors, the component patterns
- Prompt file: `04_DESIGNER_UI_UX_Agent.md`

### 5. OPS (DevOps & Deployment)
- Role: Infrastructure engineer
- Handles: Vercel deploys, GitHub Actions, Convex deployments, environment variables
- Knows: The vercel.json, the build pipeline, the APK build workflow
- Prompt file: `05_OPS_DevOps_Agent.md`

### 6. AUDIT (Quality & Compliance)
- Role: QA engineer + legal compliance reviewer
- Handles: Code audits, TypeScript errors, legal accuracy, security review
- Knows: The audit checklist, the citation classifier tests, the routing check
- Prompt file: `06_AUDIT_Quality_Agent.md`

## How to Use

1. **Start the Orchestrator** — paste its prompt into a new conversation. Tell it what you want done.
2. **The Orchestrator tells you** which agents to spin up and what to tell them.
3. **Start each agent** in a separate conversation by pasting its prompt file.
4. **Agents read the worklog** to know what other agents have done.
5. **Agents append to the worklog** when they complete their tasks.
6. **You oversee** — the Orchestrator reports back to you with status updates.

## File Locations

All agent prompts are in: `/home/z/my-project/download/agent_prompts/`

## Key Shared Resources All Agents Need

- **Worklog**: `/home/z/my-project/worklog.md` (shared coordination file)
- **Codebase**: `/home/z/my-project/` (Vite/React/TypeScript + Convex)
- **Style Guide**: `/home/z/my-project/STYLE_GUIDE.md`
- **Audit Report**: `/home/z/my-project/download/PracticePro_PreLaunch_Audit.pdf`
- **Convex URL**: `https://gregarious-malamute-537.convex.cloud`
- **Vercel URL**: `https://practice-pro-vega.vercel.app`
- **GitHub**: `https://github.com/R2deetwo/PracticeProVEGA.git`
