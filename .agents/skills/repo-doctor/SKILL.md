---
name: repo-doctor
description: Automated diagnostics runbook to identify broken local runtime dependencies, missing environment variables, and active port conflicts using MCS doctor tools.
---

# Repository Doctor Diagnostics Workflow

Use this skill when onboarding to a new codebase, troubleshooting failed builds, or resolving port collisions (`EADDRINUSE`).

## Step-by-Step Procedure

1. **Run Project Diagnostics**:
   - Call `doctor_diagnose_project` to inspect language runtimes, package configurations, and missing `node_modules`.
2. **Synchronize Environment Keys**:
   - Call `doctor_check_env` to detect missing keys between `.env` and `.env.example`.
3. **Inspect Local Port Conflicts**:
   - Call `doctor_port_inspect` on common web and database ports (`3000`, `5173`, `5432`, `6379`, `8080`).
4. **Present Remediation Plan**:
   - Provide the user with exact commands to install dependencies or terminate conflicting background processes.
