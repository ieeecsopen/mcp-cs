import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { diagnoseProject, checkEnvSync, inspectPorts } from "../tools/doctor.js";
import { scanSecrets } from "../tools/security.js";
import { parseSqliteOrMockSchema, generateMermaidErd } from "../tools/db.js";
import { auditAssets } from "../tools/perf.js";
import { startUiServer } from "../ui/server.js";

export async function runCli(args: string[]): Promise<boolean> {
  const command = args[0]?.toLowerCase();

  // If no CLI subcommand matched, return false to let MCP server start
  if (!command || command.startsWith("-")) {
    if (args.includes("--ui") || args.includes("-u")) {
      const portIndex = args.findIndex((a) => a === "--port" || a === "-p");
      const port = portIndex !== -1 && args[portIndex + 1] ? Number(args[portIndex + 1]) : 4100;
      await startUiServer(port);
      return true;
    }
    return false;
  }

  // 1. `mcs ui`
  if (command === "ui" || command === "dashboard") {
    const port = args[1] ? Number(args[1]) : 4100;
    await startUiServer(port);
    return true;
  }

  // 2. `mcs doctor`
  if (command === "doctor" || command === "diagnose") {
    console.log("\n🩺 Running MCS Project Diagnostics...\n");
    const diag = diagnoseProject(process.cwd());
    console.log(`📁 Project Root: ${diag.projectPath}`);
    console.log(`⚡ Type:         ${diag.projectType.join(", ") || "General Project"}`);

    if (diag.issues && diag.issues.length > 0) {
      console.log(`\n⚠️  Detected Issues:`);
      diag.issues.forEach((iss) => console.log(`   ✖ ${iss}`));
    } else {
      console.log(`✔ All core setup requirements look healthy.`);
    }

    if (diag.recommendations && diag.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      diag.recommendations.forEach((rec) => console.log(`   → ${rec}`));
    }

    console.log("\n🔒 Checking .env Synchronization...");
    const envDiff = checkEnvSync(process.cwd());
    if (envDiff.missingKeys.length === 0) {
      console.log("✔ .env is 100% in sync with .env.example\n");
    } else {
      console.log(`⚠️  Missing keys in .env: ${envDiff.missingKeys.join(", ")}\n`);
    }

    return true;
  }

  // 3. `mcs ports`
  if (command === "ports" || command === "port") {
    console.log("\n🌐 Inspecting Common Localhost Sockets...\n");
    const ports = inspectPorts([3000, 3001, 3306, 4000, 5000, 5173, 5432, 6379, 8000, 8080]);
    console.log("PORT\tSTATUS\t\tPID\tPROCESS");
    console.log("--------------------------------------------------");
    ports.forEach((p) => {
      const status = p.inUse ? "● IN USE" : "  FREE";
      const pid = "—";
      const proc = p.process ? p.process : "—";
      console.log(`:${p.port}\t${status}\t${pid}\t${proc}`);
    });
    console.log("");
    return true;
  }

  // 4. `mcs scan` / `mcs security`
  if (command === "scan" || command === "security") {
    console.log("\n🛡️  Scanning Codebase for Leaked Secrets & API Keys...\n");
    const findings = scanSecrets(process.cwd());
    if (findings.length === 0) {
      console.log("✔ No exposed API keys or private credentials found.\n");
    } else {
      console.log(`🚨 Found ${findings.length} potential security leaks:`);
      findings.forEach((f) => {
        console.log(`   ✖ [${f.type}] ${f.file}:${f.line}`);
        if (f.preview) console.log(`     Match: ${f.preview.trim()}`);
      });
      console.log("");
    }
    return true;
  }

  // 5. `mcs erd [schema.sql]`
  if (command === "erd") {
    const file = args[1] || "schema.sql";
    if (!fs.existsSync(file)) {
      console.log(`\n✖ File not found: ${file}`);
      console.log("Usage: mcs erd <path-to-schema.sql>\n");
      return true;
    }
    const sql = fs.readFileSync(file, "utf8");
    const tables = parseSqliteOrMockSchema(sql);
    const erd = generateMermaidErd(tables);
    console.log(`\n📊 Generated Mermaid ERD for ${tables.length} tables:\n`);
    console.log(erd);
    return true;
  }

  // 6. `mcs perf`
  if (command === "perf" || command === "assets") {
    console.log("\n⚡ Auditing Project Image Assets...\n");
    const report = auditAssets(process.cwd(), 250);
    console.log(`📁 Files Scanned: ${report.scannedFilesCount}`);
    console.log(`💾 Large Assets (>250KB): ${report.largeAssets.length}`);
    console.log(`🚀 Potential Bandwidth Savings: ${report.totalPotentialSavingsMb} MB\n`);
    report.largeAssets.slice(0, 5).forEach((a) => {
      console.log(`   - ${a.file} (${a.sizeKb}KB) -> WebP estimated: ${a.estimatedWebpSizeKb}KB`);
    });
    console.log("");
    return true;
  }

  // 7. `mcs inspector`
  if (command === "inspector" || command === "inspect") {
    console.log("\n🔍 Launching Official Model Context Protocol Inspector...\n");
    const indexPath = path.join(__dirname, "../index.js");
    execSync(`npx @modelcontextprotocol/inspector node "${indexPath}"`, { stdio: "inherit" });
    return true;
  }

  // Unknown command: Show help
  console.log("\n⚡ MCS — Universal Developer & AlgoJudge Suite\n");
  console.log("Commands:");
  console.log("  mcs ui                 Launch the interactive web console");
  console.log("  mcs doctor             Run project diagnostics and .env sync check");
  console.log("  mcs ports              Inspect local network port listeners and PIDs");
  console.log("  mcs scan               Scan codebase for leaked secrets & API keys");
  console.log("  mcs erd <schema.sql>   Generate Mermaid ERD from SQL file");
  console.log("  mcs perf               Audit image asset compression");
  console.log("  mcs inspector          Launch official MCP web inspector");
  console.log("\nMCP Server Mode (Default for Cursor/Claude/Antigravity):");
  console.log("  mcs                    Start MCP stdio protocol server\n");
  return true;
}
