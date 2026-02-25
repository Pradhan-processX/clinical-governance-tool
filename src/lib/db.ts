import sql from "mssql";
console.log("DB_SERVER from env:", process.env.DB_SERVER);


const config: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    encrypt: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;
let migrationRan = false;

async function runMigrations(p: sql.ConnectionPool): Promise<void> {
  if (migrationRan) return;
  migrationRan = true;
  try {
    await p.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BatchJobs') AND name = 'OriginalFile')
        ALTER TABLE BatchJobs ADD OriginalFile VARBINARY(MAX) NULL;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'LatencyMs')
        ALTER TABLE Evaluations ADD LatencyMs INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'CreatedByName')
        ALTER TABLE Evaluations ADD CreatedByName NVARCHAR(100);
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'NoteDate' AND max_length < 100)
        ALTER TABLE Evaluations ALTER COLUMN NoteDate NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'PromptSent')
        ALTER TABLE Evaluations ADD PromptSent NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'SystemPromptSent')
        ALTER TABLE Evaluations ADD SystemPromptSent NVARCHAR(MAX);
    `);
  } catch {
    // Table may not exist yet (first-time setup) — ignore
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  pool = await new sql.ConnectionPool(config).connect();
  await runMigrations(pool);
  return pool;
}

export async function query<T>(
  queryString: string,
  params?: Record<string, sql.ISqlTypeFactoryWithNoParams | { type: sql.ISqlTypeFactoryWithNoParams; value: unknown }>
): Promise<sql.IResult<T>> {
  const p = await getPool();
  const request = p.request();
  if (params) {
    for (const [key, param] of Object.entries(params)) {
      if (typeof param === "object" && "type" in param && "value" in param) {
        request.input(key, param.type, param.value);
      } else {
        request.input(key, param);
      }
    }
  }
  return request.query<T>(queryString);
}

export { sql };
