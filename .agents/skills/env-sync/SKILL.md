---
name: env-sync
description: Activate when a developer is onboarding, pulling upstream commits with new environment variables, experiencing missing process.env crashes, or preparing .env.example files for team distribution — trigger phrasings include "sync my .env with .env.example", "am I missing any environment variables", "check my env keys", "update .env.example with new secrets", "why is process.env.KEY undefined", or "audit my environment config". Uses MCS doctor_check_env to perform bidirectional differential analysis between local secret files and public environment templates.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [env-sync, environment-variables, secrets-management, dotenv, config-validation, onboarding, process-env]
---

# Environment Variable Synchronizer & Differential Audit Runbook

## Mission

Eliminate `undefined` runtime configuration crashes across development teams. When engineers add new features requiring third-party API keys or database connection strings, teammates pulling `git main` frequently suffer broken builds because the new keys were never documented in `.env.example`. This skill performs bidirectional disparity checks between `.env` and `.env.example`, flagging missing variables, detecting unredacted secret leaks, and keeping configuration templates perfectly synchronized.

---

## Bidirectional Synchronization Model

```
                    ┌─────────────────────────┐
                    │      .env (Local)       │  <-- Contains real local secrets
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │   Bidirectional Diff Engine     │
                │     (doctor_check_env)          │
                └────────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  .env.example (Public)  │  <-- Contains safe dummy templates
                    └─────────────────────────┘
```

### The Two Disparity Failure States

1. **Missing in `.env` (Runtime Crash Risk)**:
   - Variable is defined in `.env.example` but absent in local `.env`.
   - Result: App throws `TypeError: Cannot read properties of undefined` at runtime.
2. **Missing in `.env.example` (Team Onboarding Failure)**:
   - Developer added `STRIPE_WEBHOOK_SECRET="whsec_123"` to `.env` but forgot to add `STRIPE_WEBHOOK_SECRET=""` to `.env.example`.
   - Result: Other developers and CI pipelines break upon checkout.

---

## Step-by-Step Execution Protocol

### Phase 1: Environment File Discovery
1. Check for standard environment file variants:
   - `.env`, `.env.local`, `.env.development`, `.env.test`, `.env.production`.
   - `.env.example`, `.env.template`, `.env.sample`.
2. Parse key-value pairs ignoring comments (`#`) and empty lines.

### Phase 2: Execute Differential Analysis
1. Invoke `doctor_check_env` on the target directory.
2. Segregate findings into:
   - `missingKeys`: Keys present in `.env.example` but missing locally.
   - `extraKeys`: Keys present locally in `.env` but undocumented in `.env.example`.
   - `unredactedSecrets`: Keys in `.env.example` that contain suspicious real secret values (e.g. `sk-proj-...`).

### Phase 3: Synchronize & Repair
1. **Append Missing Keys to `.env`**:
   ```bash
   # Add missing keys with default dummy placeholders
   echo 'NEW_KEY="placeholder_value"' >> .env
   ```
2. **Update `.env.example` with Sanitized Placeholders**:
   ```bash
   # Append new keys to .env.example with stripped values
   echo 'NEW_KEY=""' >> .env.example
   ```

---

## Quality & Security Gate Checklist

- [ ] **No Real Secrets in `.env.example`**: Verify `.env.example` contains only empty quotes or descriptive hints (`"https://..."`).
- [ ] **`.gitignore` Enforced**: Verify `.env` and `.env.local` are explicitly present in `.gitignore`.
- [ ] **Zod Schema Synchronization**: If project uses `env.ts` / `t3-env`, verify all `.env` keys exist in the Zod runtime schema.
- [ ] **Trailing Newlines Preserved**: Ensure newly appended keys maintain POSIX-compliant trailing newlines.
