---
name: campus-assignment-cleaner
description: Pre-flight university LMS assignment validator that strips build artifacts (.DS_Store, node_modules, __pycache__) and verifies student ID headers.
---

# LMS Assignment Submission Pre-Flight Validator

Use this skill before students zip and upload their lab assignments to Moodle, Blackboard, Canvas, or university portals.

## Pre-Flight Checklist

1. **Student Identification**:
   - Verify that all source files contain a top comment with `Student Name`, `Student ID / Reg No`, and `Module Code`.
2. **Exclude Bloated & Hidden Files**:
   - Ensure `node_modules/`, `dist/`, `.next/`, `__pycache__/`, `.venv/`, `.DS_Store`, and `Thumbs.db` are removed.
3. **Executable Validation**:
   - Verify that `package.json` contains valid `start` / `test` scripts, or `requirements.txt` / `Makefile` is present.
4. **ZIP Archive Creation**:
   - Package into `<StudentID>_<ModuleName>_Assignment<N>.zip`.
