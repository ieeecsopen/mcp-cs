---
name: db-architect
description: Database modeling and visual architecture skill to parse SQL schemas and generate clean Mermaid ER diagrams with MCS db_generate_erd.
---

# Database Schema & ERD Architecture Workflow

Use this skill when designing relational schemas, reviewing migrations, or documenting database relationships.

## Step-by-Step Procedure

1. **Extract DDL Statements**:
   - Collect `CREATE TABLE` definitions and `FOREIGN KEY` constraints.
2. **Generate Mermaid ERD**:
   - Invoke `db_generate_erd` passing the SQL text.
3. **Analyze Normalization**:
   - Verify primary keys (PK), foreign keys (FK), and index coverage.
