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

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  pool = await new sql.ConnectionPool(config).connect();
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
