---
name: test-e2e-playwright
description: Generate resilient Playwright end-to-end browser test specs with user-facing accessibility locators and screenshot regression checks.
---

# Playwright E2E Test Suite Architect

Use this skill when writing end-to-end integration tests for web applications.

## Locator Best Practices
1. **User-Facing Locators**: Use `getByRole()`, `getByLabel()`, and `getByText()` instead of brittle CSS/XPath selectors.
2. **Auto-Waiting**: Rely on Playwright's built-in web-first assertions (`await expect(page.getByRole('button')).toBeVisible()`).
3. **Auth State Re-use**: Store authenticated storage states in `playwright/.auth/user.json` to skip repetitive logins.
