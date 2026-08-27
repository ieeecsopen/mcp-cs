---
name: port-inspector
description: Activate when a local development server or database fails to start due to port collision errors (EADDRINUSE, address already in use, port already allocated) — trigger phrasings include "port 3000 is already in use", "kill process on port 5173", "why is port 6379 occupied", "EADDRINUSE 8080", "inspect my network ports", "what process is using port 5432", or "free up my development ports". Uses MCS doctor_port_inspect and OS socket utilities (lsof, netstat, ss) to identify holding process names, PIDs, and safely terminate zombie listeners.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [port-inspector, eaddrinuse, socket-conflicts, networking, process-kill, lsof, localhost-debug]
---

# Port Inspector & Socket Collision Resolver Runbook

## Mission

Instantly identify, inspect, and resolve local TCP/UDP port collisions. When background processes crash improperly, IDE sessions close unexpectedly, or Docker containers linger, orphan processes keep ports like `3000`, `5173`, `5432`, or `6379` locked in the `LISTEN` state. This skill identifies the exact process name, PID, user, and launch command holding the port, giving developers a safe way to terminate zombie listeners without rebooting or killing unintended system services.

---

## Common Developer Port Allocation Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Standard Local Development Port Map                     │
├──────────────┬─────────────────────────────┬───────────────────────────────┤
│ Port         │ Common Service / Framework  │ Default Process Name          │
├──────────────┼─────────────────────────────┼───────────────────────────────┤
│ :3000        │ Next.js / React / Express   │ `node`                        │
│ :5173        │ Vite / SvelteKit / Vue      │ `node` / `vite`               │
│ :4100        │ MCS Visual Console          │ `node` / `mcs`                │
│ :5432        │ PostgreSQL Server           │ `postgres` / `com.docker`     │
│ :6379        │ Redis Cache / Queue         │ `redis-server` / `docker`     │
│ :8000 / :8080│ FastAPI / Django / Spring   │ `python` / `java`             │
│ :3306        │ MySQL / MariaDB             │ `mysqld`                      │
└──────────────┴─────────────────────────────┴───────────────────────────────┘
```

---

## Step-by-Step Resolution Protocol

### Phase 1: Port Discovery & Process Identification
1. Invoke `doctor_port_inspect` on the conflicting ports (e.g. `[3000, 5173, 5432, 6379, 8080]`).
2. Run low-level OS inspection to capture full process metadata:
   - **macOS / Linux**: `lsof -i TCP:<PORT> -s TCP:LISTEN -P -n`
   - **Alternative (Linux)**: `ss -tulpn | grep :<PORT>`
   - **Windows**: `netstat -ano | findstr :<PORT>`

### Phase 2: Process Classification & Safety Check
Before killing a process, categorize it to prevent system instability:
- **Category A (Safe to Kill - Dev Server)**: Node.js, Vite, Webpack, Python uvicorn, Next.js dev server.
- **Category B (Caution - Shared Database/Docker)**: `postgres`, `redis-server`, `com.docker.backend`.
- **Category C (System Protected - DO NOT KILL)**: `launchd`, `systemd`, `ControlCenter` (AirPlay port 5000/7000).

### Phase 3: Safe Termination & Verification
1. **Graceful Termination (SIGTERM)**:
   ```bash
   kill -15 <PID>
   ```
2. **Force Termination (SIGKILL - if zombie / unresponsive)**:
   ```bash
   kill -9 <PID>
   ```
3. **1-Line Quick Free**:
   ```bash
   lsof -ti:<PORT> | xargs kill -9
   ```
4. **Re-Verify Port Status**:
   - Re-run `doctor_port_inspect` to verify port returns `FREE`.

---

## Quality Gate & Safety Checklist

- [ ] **No AirPlay Port Termination**: Warn users if port 5000/7000 is occupied by macOS ControlCenter / AirPlay receiver (disable via System Settings $\to$ AirDrop & AirPlay).
- [ ] **PID Existence Validated**: Verify PID exists before sending kill signals.
- [ ] **Database Integrity Checked**: If killing PostgreSQL/MySQL, recommend graceful `brew services stop postgresql` or `docker compose down` first.
