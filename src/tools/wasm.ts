import vm from "vm";
import { ExecutionResult } from "./algo.js";

/**
 * Executes JavaScript/TypeScript code within an in-memory isolated Node.js VM context.
 * Provides sub-millisecond execution without requiring any external compilers.
 */
export function runInVmSandbox(
  code: string,
  stdin: string = "",
  timeoutMs: number = 3000
): ExecutionResult {
  const startTime = Date.now();
  let stdout = "";
  let stderr = "";

  const sandbox = {
    console: {
      log: (...args: unknown[]) => {
        stdout += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
      },
      error: (...args: unknown[]) => {
        stderr += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
      },
      warn: (...args: unknown[]) => {
        stderr += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
      },
      info: (...args: unknown[]) => {
        stdout += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
      },
    },
    // Mock standard input buffer
    __stdin: stdin,
    readline: (() => {
      const lines = stdin.split("\n");
      let lineIndex = 0;
      return () => (lineIndex < lines.length ? lines[lineIndex++] : null);
    })(),
    process: {
      stdin: {
        read: () => stdin,
      },
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Map,
    Set,
    BigInt,
  };

  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code);
    script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    const durationMs = Date.now() - startTime;
    return {
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      exitCode: 0,
      durationMs,
      timedOut: false,
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errMessage = error instanceof Error ? error.message : String(error);
    const timedOut = errMessage.includes("timed out") || durationMs >= timeoutMs;

    return {
      stdout: stdout.trimEnd(),
      stderr: timedOut ? `Execution timed out after ${timeoutMs}ms` : errMessage,
      exitCode: 1,
      durationMs,
      timedOut,
    };
  }
}

/**
 * In-process WebAssembly binary evaluator supporting raw WASM byte execution.
 */
export async function runWasmModule(
  wasmBytesBase64: string,
  functionName: string = "main",
  args: number[] = [],
  timeoutMs: number = 3000
): Promise<ExecutionResult> {
  const startTime = Date.now();
  try {
    const buffer = Buffer.from(wasmBytesBase64, "base64");
    const wasmModule = await WebAssembly.compile(buffer);
    
    let stdout = "";
    const importObject = {
      env: {
        print: (val: number) => {
          stdout += String(val) + "\n";
        },
        abort: () => {
          throw new Error("WASM execution aborted");
        },
      },
    };

    const instance = await WebAssembly.instantiate(wasmModule, importObject);
    const exportedFunc = instance.exports[functionName] as ((...a: number[]) => unknown) | undefined;

    if (typeof exportedFunc !== "function") {
      throw new Error(`Exported function '${functionName}' not found in WASM module.`);
    }

    const result = exportedFunc(...args);
    if (result !== undefined) {
      stdout += String(result);
    }

    const durationMs = Date.now() - startTime;
    return {
      stdout: stdout.trimEnd(),
      stderr: "",
      exitCode: 0,
      durationMs,
      timedOut: false,
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      durationMs,
      timedOut: false,
    };
  }
}
