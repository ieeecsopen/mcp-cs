---
name: port-inspector
description: Identify and resolve network socket port collisions (EADDRINUSE) using MCS doctor_port_inspect.
---

# Port Inspector & Conflict Resolver

Use this skill when local servers fail to bind to ports like 3000, 5173, 5432, 6379, or 8080.

## Procedure
1. Call `doctor_port_inspect` on the occupied port list.
2. Identify the holding process name and process PID.
3. Terminate or reassign conflicting listeners.
