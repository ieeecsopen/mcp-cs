---
name: algo-edge-case-generator
description: Generate adversarial corner testcases (N=1, max bounds, identical items, extreme negatives, disconnected graphs) using MCS algo_generate_edge_cases.
---

# Algorithmic Edge-Case Generator

Use this skill when designing test suites or stress-testing solutions against corner constraints.

## Procedure
1. Identify the input structure: `array`, `graph`, `tree`, `string`, or `numbers`.
2. Call `algo_generate_edge_cases` with the corresponding structure type.
3. Inject the edge cases into unit test runners or sandboxed execution.
