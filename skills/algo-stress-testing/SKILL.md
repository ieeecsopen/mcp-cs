---
name: algo-stress-testing
description: Autonomous workflow to stress-test algorithms by comparing fast solutions against brute-force baselines on randomized inputs using MCS algo_stress_test.
---

# Algorithm Stress-Testing Workflow

Use this skill when the user is trying to find bugs, Wrong Answer (WA), or edge-case failures in a complex algorithmic solution.

## Step-by-Step Procedure

1. **Identify the Core Logic**:
   - Understand the expected input, constraints, and output format.
2. **Draft the Reference (Brute-Force) Solution**:
   - Write a simple, obviously correct $O(N^2)$ or $O(N^3)$ algorithm.
3. **Draft the Randomized Testcase Generator**:
   - Write a short function that prints valid randomized test data within constraints.
4. **Execute `algo_stress_test`**:
   - Call the `algo_stress_test` tool passing `solutionCode`, `bruteForceCode`, and `generatorCode`.
5. **Analyze Counter-Examples**:
   - If a failure is found, inspect the smallest failing input and fix the optimal solution.
