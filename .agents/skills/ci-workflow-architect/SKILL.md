---
name: ci-workflow-architect
description: Activate when creating, optimizing, or debugging GitHub Actions CI/CD workflows for automated testing, linting, Docker packaging, NPM publishing, and multi-platform matrix builds — trigger phrasings include "create a GitHub Action for my project", "generate a CI workflow", "automate NPM package publishing", "setup automated Vitest/Jest CI", "build Docker image in GitHub Actions", or "fix my failed CI pipeline". Uses MCS ci_generate_workflow to produce production-grade GitHub Actions YAML configurations.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [ci-cd, github-actions, automated-testing, npm-publish, docker-ci, workflow-architect, devops-pipeline]
---

# GitHub Actions CI/CD Workflow Architect Runbook

## Mission

Build bulletproof, fast, and secure continuous integration pipelines. Unoptimized CI workflows take 15+ minutes to run, fail intermittently due to caching issues, run as insecure root containers, or accidentally publish broken releases. This skill generates standardized, production-ready GitHub Actions YAML workflows featuring dependency caching, matrix testing, secret binding, and automated release tagging.

---

## Standard Multi-Stage CI Pipeline Architecture

```
  Push / PR Event
        │
        ▼
┌───────────────────────────┐
│ Job 1: Test & Lint Matrix │
│ (Node 20, 22 on Ubuntu)   │
└─────────────┬─────────────┘
              │
              ├──────────────────────────────────┐
              ▼ (On Push to main)                ▼ (On Release Tag)
┌───────────────────────────┐      ┌───────────────────────────┐
│ Job 2: Docker OCI Build   │      │ Job 3: NPM Publish        │
│ (GHCR / Docker Hub)       │      │ (Provenance + 2FA Token)  │
└───────────────────────────┘      └───────────────────────────┘
```

---

## Standard GitHub Actions Pipeline Template (`.github/workflows/ci.yml`)

```yaml
name: CI Quality Gate

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test & Build Matrix
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "npm"

      - name: Install Dependencies
        run: npm ci

      - name: Run Test Suite
        run: npm test

      - name: Verify TypeScript Compilation
        run: npm run build
```

---

## Quality Gate Checklist

- [ ] **Dependency Caching Enabled**: `actions/setup-node` configured with `cache: 'npm'` (cuts CI run time by 60%).
- [ ] **`npm ci` Used**: `npm ci` used instead of `npm install` for deterministic dependency installation.
- [ ] **Minimal Permissions Declared**: Top-level `permissions: contents: read` declared to follow least-privilege security.
- [ ] **Secrets Bound via Actions Secrets**: Tokens accessed securely via `${{ secrets.NPM_TOKEN }}`.
