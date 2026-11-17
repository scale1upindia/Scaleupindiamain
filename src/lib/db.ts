import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;
let migrationsRan = false;

export async function getDb(): Promise<DbClient> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    const client: DbClient = {
      async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pgPool!.query(text, params);
        return {
          rows: res.rows as T[],
          rowCount: res.rowCount ?? res.rows.length,
        };
      },
      async exec(sql: string): Promise<void> {
        await pgPool!.query(sql);
      },
    };

    if (!migrationsRan) {
      await runMigrations(client);
      migrationsRan = true;
    }

    return client;
  }

  // PGlite Embedded Fallback (Zero external dependency PostgreSQL WASM)
  if (!pgliteInstance) {
    const isTest = process.env.NODE_ENV === "test";
    const dataDir = isTest ? undefined : path.resolve(process.cwd(), "data/pglite");

    if (dataDir && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    pgliteInstance = dataDir ? new PGlite(dataDir) : new PGlite();
  }

  const client: DbClient = {
    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pgliteInstance!.query<T>(text, params);
      return {
        rows: res.rows as T[],
        rowCount: (res as any).rowCount ?? res.rows.length,
      };
    },
    async exec(sql: string): Promise<void> {
      await pgliteInstance!.exec(sql);
    },
  };

  if (!migrationsRan) {
    await runMigrations(client);
    migrationsRan = true;
  }

  return client;
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function exec(sql: string): Promise<void> {
  const db = await getDb();
  return db.exec(sql);
}

export async function runMigrations(db: DbClient): Promise<void> {
  // Ensure migrations tracking table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRes = await db.query<{ id: string }>(
    `SELECT id FROM _schema_migrations ORDER BY id ASC`
  );
  const appliedSet = new Set(appliedRes.rows.map((r) => r.id));

  const migrationsDir = path.resolve(process.cwd(), "src/lib/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (!appliedSet.has(file)) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");
      
      // Execute migration multi-statement SQL
      await db.exec(sql);
      await db.query(`INSERT INTO _schema_migrations (id) VALUES ($1)`, [file]);
    }
  }
}

/**
 * Executes a function within a transaction block
 */
export async function transaction<T>(callback: (txClient: DbClient) => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.exec("BEGIN");
  try {
    const result = await callback(db);
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Resets the in-memory or test database state for deterministic test suites
 */
export async function resetTestDb(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetTestDb may only be invoked in test environment");
  }
  migrationsRan = false;
  pgliteInstance = new PGlite();
  const db = await getDb();
  await runMigrations(db);
}
