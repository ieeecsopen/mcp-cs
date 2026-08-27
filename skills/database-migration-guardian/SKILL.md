---
name: database-migration-guardian
description: Activate when writing, reviewing, or applying database migrations in PostgreSQL, MySQL, Prisma, or Drizzle to prevent table locks, zero-downtime failures, and data loss — trigger phrasings include "review this database migration", "how do I add a NOT NULL column without downtime", "write a safe PostgreSQL migration", "safe column rename strategy", "avoid table lock during migration", or "audit my Drizzle/Prisma schema changes". Enforces expand-and-contract migration patterns, concurrent index creation, and safe DDL operations.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [database-migrations, zero-downtime, postgresql, prisma, drizzle, table-locks, expand-and-contract]
---

# Database Migration Guardian & Zero-Downtime Runbook

## Mission

Prevent production database outages caused by dangerous DDL operations. Adding a `NOT NULL` column with a default value, creating an index synchronously on a table with millions of rows, or renaming a live column locks tables and causes cascading backend connection timeouts. This skill validates migrations against zero-downtime rules, enforcing the **Expand-and-Contract** pattern and non-blocking DDL syntax.

---

## The Golden Rules of Zero-Downtime Migrations

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    Dangerous vs. Safe Migration Operations                 │
├──────────────────────────────────────┬─────────────────────────────────────┤
│ ❌ Dangerous (Causes Table Lock)     │ ✅ Safe Zero-Downtime Alternative   │
├──────────────────────────────────────┼─────────────────────────────────────┤
│ `CREATE INDEX idx_user ON orders(id)`│ `CREATE INDEX CONCURRENTLY idx_user`│
├──────────────────────────────────────┼─────────────────────────────────────┤
│ `ALTER TABLE users ADD COLUMN bio    │ 1. `ADD COLUMN bio TEXT;`           │
│  TEXT NOT NULL DEFAULT '';`          │ 2. Backfill existing rows in batches│
│                                      │ 3. `ALTER COLUMN bio SET NOT NULL;` │
├──────────────────────────────────────┼─────────────────────────────────────┤
│ `ALTER TABLE users RENAME COLUMN     │ Expand-and-Contract pattern (3-step │
│  name TO full_name;`                 │ dual-write deployment)              │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

---

## The 3-Step Expand-and-Contract Migration Pattern

When modifying or renaming an existing database column:

```
  Phase 1 (Expand)        Phase 2 (Dual-Write)      Phase 3 (Contract)
┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│ Add new column   │ -> │ App writes to BOTH  │ -> │ Drop old column  │
│ `full_name`      │    │ `name` & `full_name`│    │ once traffic is  │
│ (Nullable)       │    │ Backfill historical │    │ 100% on new code │
└──────────────────┘    └─────────────────────┘    └──────────────────┘
```

---

## Quality Gate Checklist

- [ ] **Concurrent Index Creation**: All PostgreSQL indexes created with `CONCURRENTLY`.
- [ ] **Lock Timeout Enforced**: Script sets `SET lock_timeout = '2s';` to avoid blocking read traffic.
- [ ] **No Destructive Drops in Phase 1**: Columns/tables never dropped until all backend services are updated.
- [ ] **Batch Backfilling**: Large updates executed in chunks of 5,000 rows with `pg_sleep(0.1)` throttle.
