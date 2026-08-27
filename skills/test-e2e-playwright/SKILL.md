---
name: test-e2e-playwright
description: Activate when creating, generating, or debugging Playwright end-to-end (E2E) browser automation tests for web applications — trigger phrasings include "write a Playwright test for this user flow", "create an E2E login test", "debug failed Playwright test", "setup automated browser testing", "test form submission with Playwright", or "record visual regression test". Enforces web-first assertions, resilient user-facing accessibility locators (getByRole, getByLabel), and authentication state re-use.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [playwright, e2e-testing, browser-automation, web-testing, integration-tests, visual-regression]
---

# Playwright End-to-End (E2E) Test Suite Runbook

## Mission

Build resilient, flake-free, and high-speed end-to-end browser test suites. Flaky E2E tests caused by brittle CSS/XPath selectors (`div > div:nth-child(3)`), hardcoded `sleep(5000)` timeouts, and repetitive login workflows destroy team trust in CI. This skill writes Playwright test specs using user-facing accessible locators (`getByRole`), auto-waiting web assertions, and authenticated storage state re-use.

---

## Locator Resilience Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Playwright Locator Hierarchy (Best to Worst)            │
├──────────────────────┬─────────────────────────────┬───────────────────────┤
│ Tier / Locator       │ Code Example                │ Flakiness Resilience  │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 1. Role & Accessible │ `page.getByRole('button',   │ ⭐⭐⭐⭐⭐ (Most Resilient)│
│    Name              │   { name: /submit/i })`     │                       │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 2. Form Label        │ `page.getByLabel('Email')`  │ ⭐⭐⭐⭐                  │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 3. Test ID Attribute │ `page.getByTestId('cart')`  │ ⭐⭐⭐                   │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ 4. Brittle CSS/XPath │ `page.locator('.btn-primary')` ❌ Avoid (Brittle)     │
└──────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## Playwright Spec Template (`e2e/auth-flow.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("allows a user to log in and access the dashboard", async ({ page }) => {
    // 1. Navigate to login page
    await page.goto("/login");

    // 2. Fill form using accessible locators
    await page.getByLabel(/email address/i).fill("testuser@sliit.lk");
    await page.getByLabel(/password/i).fill("SecurePassword123!");

    // 3. Submit form
    await page.getByRole("button", { name: /sign in/i }).click();

    // 4. Web-first assertion with auto-waiting
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
```

---

## Quality Gate Checklist

- [ ] **No Hardcoded Sleeps**: Replaced all `page.waitForTimeout()` with auto-waiting assertions (`await expect(locator).toBeVisible()`).
- [ ] **Accessible Locators Used**: Uses `getByRole`, `getByLabel`, `getByPlaceholder` exclusively.
- [ ] **Artifacts on Failure**: `playwright.config.ts` captures screenshots and trace files on test failure (`trace: 'on-first-retry'`).
