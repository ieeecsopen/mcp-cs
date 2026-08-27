---
name: repo-doctor
description: Activate when a developer encounters a broken repository state, failed startup commands, missing runtime dependencies, unconfigured virtual environments, or mysterious build crashes — trigger phrasings include "why won't my project start", "run a health check on this repo", "diagnose my codebase", "npm run dev is failing with missing module", "check if my environment is broken", "fix my setup issues", or "troubleshoot my local dev environment". Uses MCS doctor tools (doctor_diagnose_project, doctor_check_env, doctor_port_inspect) to run comprehensive diagnostics across Node.js, Python, Next.js, and Docker runtimes, generating actionable remediation commands.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [repo-doctor, diagnostics, environment-health, troubleshooting, runtime-errors, setup-repair, dependency-audit]
---

# Repository Doctor & Health Diagnostics Runbook

## Mission

Diagnose, triage, and repair broken developer repositories in seconds. New contributors and students lose hours to missing `.env` files, uninstalled `node_modules`, locked TCP ports, incompatible Node.js engine versions, and unlinked virtual environments. This skill performs non-destructive static analysis across the codebase, identifying the exact root cause of startup failures and generating deterministic one-line remediation commands.

---

## Diagnostic State Machine & Triage Workflow

```
                        ┌────────────────────────────────────────┐
                        │      Initiate `repo-doctor` Run        │
                        └───────────────────┬────────────────────┘
                                            │
                                            ▼
                        ┌────────────────────────────────────────┐
                        │ Phase 1: Stack & File Tree Discovery   │
                        │ (Detect Node, Next.js, Python, Docker) │
                        └───────────────────┬────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
   ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
   │ Dependency Validation │   │ Environment Variable  │   │ Network Socket Audit  │
   │ (Check node_modules,  │   │ Sync (.env vs         │   │ (Inspect ports 3000,  │
   │  pnpm-lock, venv)     │   │  .env.example)        │   │  5173, 5432, 6379)    │
   └───────────┬───────────┘   └───────────┬───────────┘   └───────────┬───────────┘
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │
                                           ▼
                        ┌────────────────────────────────────────┐
                        │ Phase 4: Remediation Plan Generation   │
                        │ (Output prioritized copy-paste commands)
                        └────────────────────────────────────────┘
```

---

## Step-by-Step Diagnostic Protocol

### Phase 1: Stack Discovery & Dependency Inspection
1. **Analyze Manifest Files**:
   - Inspect `package.json` (Node/TypeScript), `requirements.txt` / `pyproject.toml` (Python), `Cargo.toml` (Rust), `go.mod` (Go), `Dockerfile` / `docker-compose.yml`.
2. **Execute Static Health Check**:
   - Run `doctor_diagnose_project` passing `projectPath: process.cwd()`.
   - Verify presence of binary lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`).
   - Check if `node_modules` exists and contains dependencies declared in `package.json`.

---

### Phase 2: Environment Variable Disparity Check
1. **Detect Missing Environment Secrets**:
   - Run `doctor_check_env` to diff active `.env` against the reference `.env.example`.
2. **Flag Disparity Types**:
   - **Missing Keys**: Keys present in `.env.example` that are absent in `.env` (will cause runtime `undefined` crashes).
   - **Empty / Default Secrets**: Keys present but set to obvious placeholders like `your-secret-key-here` or `changeme`.
   - **Uncommitted Secrets**: Keys added to `.env` that should be documented in `.env.example` for team members.

---

### Phase 3: Port Conflict & Socket Audit
1. **Inspect Standard Application Ports**:
   - Run `doctor_port_inspect` on `[3000, 3001, 5173, 5432, 6379, 8000, 8080]`.
2. **Identify Conflicting PIDs**:
   - If an `EADDRINUSE` collision is detected, identify the holding process name (e.g. `node`, `redis-server`, `com.docker.backend`) and PID.

---

## Automated Remediation Recipes

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Doctor Problem & Remediation Matrix                            │
├──────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ Detected Failure Signature           │ One-Line Fix Action                                 │
├──────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ✖ Missing `node_modules`             │ `npm install` (or `pnpm install` / `yarn install`)  │
├──────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ✖ Missing `.env` file                │ `cp .env.example .env`                              │
├──────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ✖ Missing `.env` Keys (`DATABASE_URL`)│ `echo 'DATABASE_URL="postgresql://..."' >> .env`    │
├──────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ✖ Port 3000 occupied by zombie PID   │ `lsof -ti:3000 | xargs kill -9`                     │
├──────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ✖ Missing Python Virtualenv          │ `python3 -m venv .venv && source .venv/bin/activate`│
└──────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

---

## Example Health Diagnostic Report Output

```markdown
### 🩺 MCS Repository Diagnostic Summary

- **Project Root**: `/Users/hesaraperera/Desktop/web-app`
- **Runtime Stack**: `Node.js (v22.13.0)` • `Next.js 15.1.0` • `TypeScript 5.7`
- **Health Score**: **78/100 (Needs Attention)**

---

#### 🚨 Issues Detected:
1. **[CRITICAL] Missing `.env` Configuration**:
   - `.env.example` requires 4 variables: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `NEXTAUTH_SECRET`.
   - **Status**: No `.env` file found in project root.
2. **[WARNING] Port 3000 Conflict**:
   - Port `3000` is currently locked by a zombie background process (`node` PID `94881`).
3. **[RESOLVED] Dependency State**:
   - `node_modules` present and in sync with `package-lock.json`.

---

#### ⚡ 1-Click Remediation Commands:
```bash
# 1. Initialize environment template
cp .env.example .env

# 2. Terminate zombie process on port 3000
kill -9 94881

# 3. Start development server cleanly
npm run dev
```
```

---

## Verification & Post-Diagnosis Quality Checklist

- [ ] **No Destructive Overwrites**: Remediation commands must never delete uncommitted `.env` files or working trees.
- [ ] **Exact PID Validation**: Before suggesting `kill -9 <PID>`, verify the PID is a non-system user process.
- [ ] **Lockfile Consistency**: Warn if `pnpm-lock.yaml` and `package-lock.json` both exist (split lockfile conflict).
- [ ] **Node Version Compatibility**: Verify that local `process.version` satisfies the `engines.node` field in `package.json`.
