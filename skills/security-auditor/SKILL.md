---
name: security-auditor
description: Activate before git commits, Pull Requests, or production releases to scan the repository for hardcoded secrets, private keys, API tokens, and JWT credentials — trigger phrasings include "scan my repo for leaked secrets", "did I commit any API keys", "audit security before PR", "check for hardcoded passwords", "sanitize my credentials", or "find exposed tokens in code". Uses MCS security_scan_secrets and security_auto_sanitize to locate high-entropy credentials and automatically replace them with process.env references.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [security-auditor, secret-scanner, credential-leaks, api-keys, tokens, sanitization, pre-commit-audit]
---

# Security Pre-Flight & Secret Sanitizer Runbook

## Mission

Prevent catastrophic credential leaks and accidental commits of private API keys, JWT tokens, AWS credentials, and SSH private keys to public Git repositories. Compromised keys lead to automated bot exploitation, AWS billing shocks, and data breaches. This skill performs regex and high-entropy pattern matching across all source code files, identifies exposed credentials, and automatically refactors code to use environment variables.

---

## Secret Detection Pattern Spectrum

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Detected Secret Signatures & Prefixes                   │
├──────────────────────┬─────────────────────────────┬───────────────────────┤
│ Secret Type          │ Detection Pattern           │ Default Env Var Name  │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ OpenAI / Claude Key  │ `sk-[a-zA-Z0-9]{32,}`       │ `OPENAI_API_KEY`      │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ GitHub PAT           │ `ghp_[a-zA-Z0-9]{36}`       │ `GITHUB_TOKEN`        │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ AWS Access Key ID    │ `AKIA[0-9A-Z]{16}`          │ `AWS_ACCESS_KEY_ID`   │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ Private RSA/EC Key   │ `-----BEGIN PRIVATE KEY---` │ `PRIVATE_KEY`         │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ Stripe Secret Key    │ `sk_live_[0-9a-zA-Z]{24}`   │ `STRIPE_SECRET_KEY`   │
└──────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## Step-by-Step Security Protocol

### Phase 1: Automated Secret Discovery
1. Invoke `security_scan_secrets` passing `targetDir: process.cwd()`.
2. Inspect all text files excluding `.git`, `node_modules`, `dist`, `.next`, and lockfiles.
3. Classify matches by file path, line number, secret type, and masked preview snippet.

### Phase 2: Safe Auto-Sanitization
1. Preview proposed code replacements using `security_auto_sanitize` with `dryRun: true`.
2. Execute real sanitization with `dryRun: false`:
   - Replace hardcoded string in source code with `process.env.VARIABLE_NAME`.
   - Append `VARIABLE_NAME="<secret>"` to `.env`.
   - Append `VARIABLE_NAME=""` to `.env.example`.

---

## Quality Gate Checklist

- [ ] **Zero High-Entropy Secrets**: All source files pass `security_scan_secrets` with 0 findings.
- [ ] **`.env` Excluded from Git**: `git status` verifies `.env` is ignored.
- [ ] **Git History Cleaned**: If a key was previously committed, advise running `git filter-repo` or BFG Repo-Cleaner.
- [ ] **Key Rotation Triggered**: If a live production key was pushed upstream, immediately revoke and rotate the credential.
