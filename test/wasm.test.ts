import { describe, it, expect } from "vitest";
import { runInVmSandbox, runWasmModule } from "../src/tools/wasm.js";

describe("WASM & VM Sandbox Engine", () => {
  it("executes JavaScript in an isolated VM sandbox with stdout capture", () => {
    const code = `
      const a = 15;
      const b = 25;
      console.log(a + b);
    `;
    const result = runInVmSandbox(code);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("40");
    expect(result.timedOut).toBe(false);
  });

  it("handles execution timeout in VM sandbox", () => {
    const infiniteLoop = `while (true) {}`;
    const result = runInVmSandbox(infiniteLoop, "", 300);
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(true);
  });

  it("executes raw WASM binary module in-memory", async () => {
    // Minimal valid WASM binary module that adds two integers: export function add(a, b) -> a + b
    // (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
    const wasmHex = "0061736d0100000001070160027f7f017f030201000707010361646400000a09010700200020016a0b";
    const wasmBase64 = Buffer.from(wasmHex, "hex").toString("base64");

    const result = await runWasmModule(wasmBase64, "add", [12, 34]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("46");
  });
});
