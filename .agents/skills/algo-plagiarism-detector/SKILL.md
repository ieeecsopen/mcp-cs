---
name: algo-plagiarism-detector
description: Compare two code submissions using token-level AST analysis to detect copied logic or academic dishonesty using MCS algo_check_plagiarism.
---

# Code Plagiarism & AST Similarity Detector

Use this skill when auditing competitive programming submissions, hackathon entries, or student assignments.

## Procedure
1. Extract the raw source code of the two submissions (`codeA` and `codeB`).
2. Call `algo_check_plagiarism` to compute the Jaccard AST token similarity index.
3. Review the verdict (`SUSPICIOUS`, `MODERATE_SIMILARITY`, or `LOW_SIMILARITY`).
