---
name: test-unit-generator
description: Activate when writing, generating, or refactoring unit test suites in TypeScript, JavaScript, or Python using Vitest, Jest, or Pytest — trigger phrasings include "write unit tests for this function", "create a Vitest test suite", "test edge cases for this utility", "mock this API in Jest", "increase test coverage to 100%", or "parameterized tests for algorithmic logic". Enforces Arrange-Act-Assert (AAA) pattern, boundary condition testing, and deterministic mocking.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [unit-testing, vitest, jest, pytest, test-automation, mocking, edge-cases, code-coverage]
---

# Automated Unit Test Generator Runbook

## Mission

Generate robust, deterministic, and comprehensive unit test suites with 100% branch and edge-case coverage. Brittle tests that test implementation details instead of behavior break during refactoring and slow down development teams. This skill constructs tests following the **Arrange-Act-Assert (AAA)** pattern, incorporating parameterized boundary cases, error-path verification, and clean mocking.

---

## The Arrange-Act-Assert (AAA) Structure

```
  1. Arrange (Setup)        2. Act (Execution)        3. Assert (Verification)
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Mock external APIs   │->│ Invoke the function  │->│ Assert exact output  │
│ Initialize inputs    │   │ with test arguments  │   │ & state mutations    │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

---

## Vitest / TypeScript Test Suite Blueprint

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatCurrency, calculateTax } from "./financialUtils.js";

describe("Financial Utilities Suite", () => {
  describe("formatCurrency()", () => {
    it("formats standard positive numbers correctly", () => {
      // Arrange & Act
      const result = formatCurrency(1250.5, "USD");
      // Assert
      expect(result).toBe("$1,250.50");
    });

    it.each([
      [0, "$0.00"],
      [-42.99, "-$42.99"],
      [1000000, "$1,000,000.00"],
    ])("handles boundary case value %d -> %s", (input, expected) => {
      expect(formatCurrency(input, "USD")).toBe(expected);
    });

    it("throws a TypeError when given NaN", () => {
      expect(() => formatCurrency(NaN, "USD")).toThrowError("Invalid number");
    });
  });
});
```

---

## Quality Gate Checklist

- [ ] **Zero Global State Leakage**: All mocks restored in `beforeEach` or `afterEach` via `vi.clearAllMocks()`.
- [ ] **Parameterized Boundary Tests**: Tested for zero ($0$), negatives, empty arrays `[]`, `null`, `undefined`, and large constraints.
- [ ] **Error Branches Covered**: Explicit `expect(() => fn()).toThrow()` assertions for all validation failures.
- [ ] **Deterministic Execution**: Tests do not rely on real network calls or wall-clock timestamps (`vi.useFakeTimers()`).
