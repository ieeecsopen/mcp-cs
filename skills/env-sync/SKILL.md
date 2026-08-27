---
name: env-sync
description: Compare and synchronize .env files against .env.example templates using MCS doctor_check_env.
---

# Environment Variable Synchronizer

Use this skill when onboarding to a project or updating `.env` keys.

## Procedure
1. Call `doctor_check_env` to inspect discrepancies between `.env` and `.env.example`.
2. Add any missing keys to `.env` with placeholder values.
3. Add any uncommitted secret keys to `.env.example` with dummy values.
