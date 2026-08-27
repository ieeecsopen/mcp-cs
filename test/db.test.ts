import { describe, it, expect } from "vitest";
import { parseSqliteOrMockSchema, generateMermaidErd } from "../src/tools/db.js";

describe("Database & ERD Suite", () => {
  it("parses DDL SQL schema and generates Mermaid ERD", () => {
    const sql = `
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT
);

CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    problem_id TEXT,
    verdict TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
`;
    const tables = parseSqliteOrMockSchema(sql);
    expect(tables.length).toBe(2);
    expect(tables[0].tableName).toBe("users");
    expect(tables[1].tableName).toBe("submissions");

    const erd = generateMermaidErd(tables);
    expect(erd).toContain("erDiagram");
    expect(erd).toContain("users {");
    expect(erd).toContain("submissions {");
  });
});
