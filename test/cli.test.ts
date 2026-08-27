import { describe, it, expect } from "vitest";
import { runCli } from "../src/cli/index.js";

describe("Direct Terminal CLI Commands", () => {
  it("handles doctor diagnostic CLI command", async () => {
    const handled = await runCli(["doctor"]);
    expect(handled).toBe(true);
  });

  it("handles ports inspection CLI command", async () => {
    const handled = await runCli(["ports"]);
    expect(handled).toBe(true);
  });

  it("handles security scan CLI command", async () => {
    const handled = await runCli(["scan"]);
    expect(handled).toBe(true);
  });

  it("returns false for stdio server execution", async () => {
    const handled = await runCli([]);
    expect(handled).toBe(false);
  });
});
