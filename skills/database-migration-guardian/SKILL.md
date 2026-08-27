---
name: database-migration-guardian
description: Safeguard database schema migrations, detect locking DDL operations, design index strategies, and write safe rollback migrations.
---

# Database Migration & Index Guardian

Use this skill when adding columns, renaming fields, or modifying database tables in PostgreSQL, SQLite, or MySQL.

## Rules
1. **Zero-Downtime Column Addition**: Always set new columns as `NULL` or provide safe defaults.
2. **Index Optimization**: Create indexes on foreign keys and frequently filtered columns (`WHERE user_id = ?`).
3. **Safe Renaming**: Add the new column, dual-write in backend code, backfill data, and drop the old column later.
