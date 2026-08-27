---
name: security-auditor
description: Security pre-flight audit skill to detect leaked API keys, tokens, and credentials, and automatically sanitize them with MCS security tools.
---

# Security Pre-Flight Audit Workflow

Use this skill before git commits, pull requests, or production releases to prevent credential leaks.

## Step-by-Step Procedure

1. **Scan for High-Entropy Credentials**:
   - Invoke `security_scan_secrets` across repository files.
2. **Review Detected Leaks**:
   - If secrets (OpenAI, AWS, GitHub PATs) are found, preview with `security_auto_sanitize` (`dryRun: true`).
3. **Auto-Sanitize**:
   - Apply sanitization (`dryRun: false`) to move keys to `.env` and `.env.example`.
