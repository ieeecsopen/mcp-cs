import { describe, it, expect } from "vitest";
import { diagnoseProject, inspectPorts } from "../src/tools/doctor.js";

describe("Doctor Diagnostic Suite", () => {
  it("diagnoses current Node.js project successfully", () => {
    const report = diagnoseProject(process.cwd());
    expect(report.projectType).toContain("Node.js / JavaScript / TypeScript");
  });

  it("inspects network ports without throwing", () => {
    const ports = inspectPorts([3000, 6379, 5432]);
    expect(Array.isArray(ports)).toBe(true);
    expect(ports.length).toBe(3);
    expect(ports[0]).toHaveProperty("port");
    expect(ports[0]).toHaveProperty("inUse");
  });
});
