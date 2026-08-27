export interface TableColumn {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableSchema {
  tableName: string;
  columns: TableColumn[];
  foreignKeys: Array<{ column: string; foreignTable: string; foreignColumn: string }>;
}

export function parseSqliteOrMockSchema(schemaSql: string): TableSchema[] {
  const tables: TableSchema[] = [];
  const tableBlocks = schemaSql.split(/create\s+table\s+/i).slice(1);

  for (const block of tableBlocks) {
    const nameMatch = block.match(/^([`"']?)([a-zA-Z0-9_]+)\1\s*\(/);
    if (!nameMatch) continue;
    const tableName = nameMatch[2];
    const body = block.slice(nameMatch[0].length, block.indexOf(");"));

    const lines = body.split(",").map((l) => l.trim()).filter(Boolean);
    const columns: TableColumn[] = [];
    const foreignKeys: Array<{ column: string; foreignTable: string; foreignColumn: string }> = [];

    for (const line of lines) {
      if (line.toUpperCase().startsWith("FOREIGN KEY")) {
        const fkMatch = line.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          foreignKeys.push({ column: fkMatch[1].trim(), foreignTable: fkMatch[2].trim(), foreignColumn: fkMatch[3].trim() });
        }
      } else if (!line.toUpperCase().startsWith("PRIMARY KEY") && !line.toUpperCase().startsWith("CONSTRAINT")) {
        const parts = line.split(/\s+/);
        const colName = parts[0]?.replace(/[`"']/g, "");
        const colType = parts[1] || "TEXT";
        if (colName) {
          columns.push({
            name: colName,
            type: colType.toUpperCase(),
            isNullable: !line.toUpperCase().includes("NOT NULL"),
            isPrimaryKey: line.toUpperCase().includes("PRIMARY KEY"),
          });
        }
      }
    }

    tables.push({ tableName, columns, foreignKeys });
  }

  return tables;
}

export function generateMermaidErd(tables: TableSchema[]): string {
  let mermaid = "erDiagram\n";

  for (const table of tables) {
    mermaid += `    ${table.tableName} {\n`;
    for (const col of table.columns) {
      const pkMarker = col.isPrimaryKey ? "PK" : "";
      mermaid += `        ${col.type} ${col.name} ${pkMarker}\n`;
    }
    mermaid += `    }\n`;
  }

  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      mermaid += `    ${table.tableName} }o--|| ${fk.foreignTable} : "${fk.column} -> ${fk.foreignColumn}"\n`;
    }
  }

  return mermaid;
}
