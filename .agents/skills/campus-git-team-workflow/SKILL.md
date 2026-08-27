---
name: campus-git-team-workflow
description: Guide student teams on Git group workflows, feature branch naming, merge conflict resolution, and clean conventional commits.
---

# Student Group Git Collaboration Workflow

Use this skill to guide university student project groups on professional Git collaboration.

## Team Standards

1. **Branching Strategy**:
   - `main`: Production-ready, deployed code.
   - `dev`: Integration branch for team testing.
   - `feat/<student-name>-<feature-slug>`: Dedicated branch per team member.
2. **Conventional Commit Standard**:
   - `feat:` New feature implementation
   - `fix:` Bug fix
   - `docs:` Report or README update
   - `test:` Adding unit testcases
   - `refactor:` Code cleanup without logic changes
3. **Pull Request (PR) Checklist**:
   - Has the branch been rebased against `dev`?
   - Do all unit tests pass locally?
   - Are `.env` or build artifacts excluded from git?
