---
name: ci-workflow-architect
description: Generate production-ready GitHub Actions CI/CD workflows for Next.js, NPM Publishing, Docker, or Python with MCS ci_generate_workflow.
---

# CI/CD Workflow Architect

Use this skill to automate automated testing, code quality checks, and registry publishing.

## Procedure
1. Determine the project stack (`nextjs`, `node-publish`, `docker`, `python`).
2. Call `ci_generate_workflow` with the target stack type.
3. Save the generated YAML file to `.github/workflows/`.
