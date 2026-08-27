import { describe, it, expect } from "vitest";
import { getEnabledModules } from "../src/index.js";

describe("Modular Tool Filtering", () => {
  it("enables all modules by default", () => {
    const modules = getEnabledModules();
    expect(modules.has("algo")).toBe(true);
    expect(modules.has("doctor")).toBe(true);
    expect(modules.has("security")).toBe(true);
    expect(modules.has("db")).toBe(true);
  });

  it("filters specific modules from environment variable", () => {
    const modules = getEnabledModules("algo,security");
    expect(modules.has("algo")).toBe(true);
    expect(modules.has("security")).toBe(true);
    expect(modules.has("db")).toBe(false);
    expect(modules.has("doctor")).toBe(false);
  });
});
