import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { inspectPorts } from "../tools/doctor.js";
import { parseSqliteOrMockSchema, generateMermaidErd } from "../tools/db.js";
import { stressTest } from "../tools/algo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startUiServer(port: number = 4100): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    // Resolve HTML paths
    const resolveHtml = (filename: string) => {
      let p = path.join(__dirname, filename);
      if (!fs.existsSync(p)) {
        p = path.join(__dirname, "../../src/ui", filename);
      }
      return p;
    };

    const dashboardPath = resolveHtml("dashboard.html");
    const landingPath = resolveHtml("landing.html");
    const detailPath = resolveHtml("skill-detail.html");

    const server = http.createServer(async (req, res) => {
      // Disable browser caching
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Enable CORS for development
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url || "/", `http://localhost:${port}`);

      // Route: Landing page
      if (parsedUrl.pathname === "/skill-detail" || parsedUrl.pathname === "/specification") {
        try {
          const htmlContent = fs.readFileSync(detailPath, "utf8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlContent);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error loading skill detail HTML");
        }
        return;
      }
      if (parsedUrl.pathname === "/landing" || parsedUrl.pathname === "/skills") {
        try {
          const htmlContent = fs.readFileSync(landingPath, "utf8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlContent);
        } catch (err: unknown) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error loading landing HTML: " + (err instanceof Error ? err.message : String(err)));
        }
        return;
      }

      // Default Route for local CLI: Serve Developer Dashboard
      if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html" || parsedUrl.pathname === "/dashboard" || parsedUrl.pathname === "/console") {
        try {
          let file = fs.existsSync(dashboardPath) ? dashboardPath : landingPath;
          const htmlContent = fs.readFileSync(file, "utf8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlContent);
        } catch (err: unknown) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error loading dashboard HTML: " + (err instanceof Error ? err.message : String(err)));
        }
        return;
      }

      // API: Scan Ports
      if (parsedUrl.pathname === "/api/ports" && req.method === "GET") {
        const ports = [3000, 3001, 3306, 4000, 5000, 5173, 5432, 6379, 8000, 8080, 8888, 9000];
        const status = inspectPorts(ports);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      }

      // Read JSON Body helper
      const readBody = async (): Promise<any> => {
        return new Promise((resolveBody) => {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              resolveBody(JSON.parse(body || "{}"));
            } catch {
              resolveBody({});
            }
          });
        });
      };

      // API: Kill Process by PID
      if (parsedUrl.pathname === "/api/kill-process" && req.method === "POST") {
        const body = await readBody();
        const pid = Number(body.pid);
        if (!pid || isNaN(pid) || pid <= 1) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid PID provided" }));
          return;
        }

        try {
          process.kill(pid, "SIGTERM");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: `Killed process ${pid}` }));
        } catch (err: unknown) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      // API: Parse SQL Schema to Mermaid ERD
      if (parsedUrl.pathname === "/api/erd" && req.method === "POST") {
        const body = await readBody();
        const schemaSql = body.schema || "";
        const tables = parseSqliteOrMockSchema(schemaSql);
        const mermaid = generateMermaidErd(tables);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ mermaid, tables }));
        return;
      }

      // API: Stress Test Solution
      if (parsedUrl.pathname === "/api/stress-test" && req.method === "POST") {
        const body = await readBody();
        const { solution, bruteForce, generator, language, iterations } = body;
        const result = stressTest(
          solution || "",
          bruteForce || "",
          generator || "",
          language || "javascript",
          iterations || 20
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 MCS Interactive Visual Dashboard running!`);
      console.log(`🔗 URL: http://localhost:${port}`);
      console.log(`======================================================\n`);
      
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${openCmd} http://localhost:${port}`);
      
      resolve(server);
    });

    server.on("error", reject);
  });
}
