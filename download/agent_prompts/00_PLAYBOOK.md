# PracticePro Agent System
## Operations Playbook

---

## OVERVIEW

This system lets you run PracticePro as a company using multiple AI agents working in parallel. You are the human-in-the-loop (CEO/founder). The Orchestrator is your chief of staff — it coordinates all other agents.

## THE 6 AGENTS

### 1. ORCHESTRATOR (Your Chief of Staff)
- **Role**: Coordinates all agents, breaks down your instructions into tasks
- **When to start**: First — always start this one before any other
- **Prompt file**: `01_ORCHESTRATOR_Agent.md`

### 2. CODEX (Engineering)
- **Role**: Writes and fixes code — frontend, backend, build tooling
- **When to start**: When the Orchestrator assigns a coding task
- **Prompt file**: `02_CODEX_Engineering_Agent.md`

### 3. ALOA (AI & Product Intelligence)
- **Role**: AI behavior, legal logic, jurisdiction engine, citation classifier
- **When to start**: When tasks involve AI prompts, legal accuracy, or DraftPro logic
- **Prompt file**: `03_ALOA_AI_Product_Agent.md`

### 4. DESIGNER (UI/UX)
- **Role**: Visual design, CSS, responsive layout, mobile interactions
- **When to start**: When tasks involve styling, layout, or user experience
- **Prompt file**: `04_DESIGNER_UI_UX_Agent.md`

### 5. OPS (DevOps)
- **Role**: Vercel deploys, GitHub Actions, Convex, environment
- **When to start**: When tasks involve deployment or infrastructure
- **Prompt file**: `05_OPS_DevOps_Agent.md`

### 6. AUDIT (Quality & Compliance)
- **Role**: Code audits, legal accuracy verification, security review
- **When to start**: After code changes are made, before releases
- **Prompt file**: `06_AUDIT_Quality_Agent.md`

---

## HOW TO START

### Step 1: Start the Orchestrator
1. Open a new conversation
2. Paste the contents of `01_ORCHESTRATOR_Agent.md`
3. Tell it: "Read the worklog and give me a status report"
4. The Orchestrator will tell you what's done, what's pending, and what needs attention

### Step 2: Start Other Agents (as needed)
When the Orchestrator says "Start the CODEX agent for TASK-001":
1. Open a new conversation (separate tab)
2. Paste the contents of `02_CODEX_Engineering_Agent.md`
3. Tell it: "Read the worklog. Your task is TASK-001."
4. The agent reads the worklog, finds its task, and starts working

### Step 3: Oversee
- The Orchestrator reports back to you with status updates
- You can run multiple agents in parallel (e.g., CODEX + DESIGNER)
- Agents communicate via the shared worklog file
- You intervene when an agent is blocked or needs a decision

---

## COMMUNICATION FLOW

```
You (Human)
    ↕ (instructions + status reports)
Orchestrator
    ↕ (task assignments via worklog)
    ├── CODEX (writes code)
    ├── ALOA (AI/legal logic)
    ├── DESIGNER (UI/styling)
    ├── OPS (deploy/infra)
    └── AUDIT (quality check)
```

All agents read and write to: `/home/z/my-project/worklog.md`

---

## WORKLOG FORMAT

Each task entry in the worklog looks like:

```
---
Task ID: TASK-001
Agent: CODEX
Status: complete
Summary: Fixed PDF preview pagination
Details: Modified DocumentDetailView.tsx, added page-by-page navigation
Handoff to: AUDIT (please verify the fix)
```

This is how agents coordinate — they read each other's entries.

---

## PARALLEL WORK EXAMPLE

**You say**: "Fix the PDF preview and deploy the latest changes"

**Orchestrator breaks this into**:
- TASK-001 (CODEX): Fix PDF preview pagination
- TASK-002 (DESIGNER): Style the PDF viewer toolbar
- TASK-003 (OPS): Deploy after TASK-001 and TASK-002 are complete

**You start 3 conversations**:
1. CODEX — "Read worklog, do TASK-001"
2. DESIGNER — "Read worklog, do TASK-002"
3. OPS — "Read worklog, do TASK-003 (wait for TASK-001 and TASK-002 to complete first)"

CODEX and DESIGNER work in parallel. OPS waits. When all done, Orchestrator reports: "All tasks complete. PDF preview fixed and deployed."

---

## FILE LOCATIONS

All agent prompts: `/home/z/my-project/download/agent_prompts/`
- `00_ARCHITECTURE_OVERVIEW.md` — This overview
- `01_ORCHESTRATOR_Agent.md` — Start here
- `02_CODEX_Engineering_Agent.md` — Code agent
- `03_ALOA_AI_Product_Agent.md` — AI/legal agent
- `04_DESIGNER_UI_UX_Agent.md` — Design agent
- `05_OPS_DevOps_Agent.md` — DevOps agent
- `06_AUDIT_Quality_Agent.md` — QA agent

---

## TIPS

1. **Start with the Orchestrator** — it tells you what to do
2. **Run agents in parallel** when tasks are independent
3. **Sequence agents** when tasks depend on each other
4. **Read the worklog** yourself to see what's happening
5. **Intervene** when an agent is blocked or needs a decision
6. **Keep agent prompts updated** — if you learn something new about the codebase, tell the Orchestrator and it will propagate
