import { describe, it, expect } from "vitest";
import { runSandboxed, stressTest, checkPlagiarism, generateEdgeCases } from "../src/tools/algo.js";

describe("AlgoJudge Tool Suite", () => {
  it("executes sandboxed Python code with stdin and stdout", () => {
    const code = `
import sys
data = sys.stdin.read().strip().split()
if data:
    nums = [int(x) for x in data]
    print(sum(nums))
`;
    const result = runSandboxed(code, "python", "10 20 30");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("60");
    expect(result.timedOut).toBe(false);
  });

  it("handles sandboxed execution timeouts gracefully", () => {
    const code = `
import time
time.sleep(2)
print("done")
`;
    const result = runSandboxed(code, "python", "", 500);
    expect(result.timedOut).toBe(true);
  });

  it("stress-tests matching algorithms successfully", () => {
    const sol = `
import sys
line = sys.stdin.read().strip()
if line:
    nums = [int(x) for x in line.split()]
    print(max(nums))
`;
    const brute = `
import sys
line = sys.stdin.read().strip()
if line:
    nums = [int(x) for x in line.split()]
    nums.sort()
    print(nums[-1])
`;
    const gen = `
import random
arr = [random.randint(1, 100) for _ in range(5)]
print(" ".join(map(str, arr)))
`;
    const result = stressTest(sol, brute, gen, "python", 5);
    expect(result.status).toBe("PASSED");
    expect(result.iterationsTested).toBe(5);
  });

  it("detects plagiarized / identical token logic", () => {
    const codeA = `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`;
    const codeB = `
# Student submission
def bubble_sort(elements):
    length = len(elements)
    for step in range(length):
        for idx in range(0, length - step - 1):
            if elements[idx] > elements[idx + 1]:
                elements[idx], elements[idx + 1] = elements[idx + 1], elements[idx]
    return elements
`;
    const result = checkPlagiarism(codeA, codeB);
    expect(result.similarityPercent).toBeGreaterThan(50);
  });

  it("generates structured adversarial edge cases", () => {
    const cases = generateEdgeCases("array", 5000);
    expect(cases.length).toBeGreaterThanOrEqual(4);
    expect(cases.some((c) => c.category === "Minimum Size")).toBe(true);
    expect(cases.some((c) => c.category === "All Identical")).toBe(true);
  });
});
