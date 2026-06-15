import sql, { config as SqlConfig, ConnectionPool } from 'mssql';

const requiredEnvVars = ['MSSQL_USER', 'MSSQL_PASSWORD', 'MSSQL_SERVER', 'MSSQL_DATABASE'] as const;

function ensureConfig() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing SQL Server environment variables: ${missing.join(', ')}`);
  }
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true';
}

function buildConfig(): SqlConfig {
  const hasAllEnvVars = requiredEnvVars.every((key) => Boolean(process.env[key]));

  if (hasAllEnvVars) {
    ensureConfig();
  }

  return {
    user: process.env.MSSQL_USER || 'alamerOnline',
    password: process.env.MSSQL_PASSWORD || 's@123456',
    server: process.env.MSSQL_SERVER || '160.153.250.125',
    database: process.env.MSSQL_DATABASE || 'BackOffice',
    port: Number(process.env.MSSQL_PORT ?? 1433),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: toBoolean(process.env.MSSQL_ENCRYPT, false),
      trustServerCertificate: toBoolean(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, true),
      enableArithAbort: true,
    },
  };
}

function buildConfig2(): SqlConfig {
  const hasAllEnvVars = requiredEnvVars.every((key) => Boolean(process.env[key]));

  if (hasAllEnvVars) {
    ensureConfig();
  }

  return {
    user: process.env.MSSQL_USER || 'dynamicssa',
    password: process.env.MSSQL_PASSWORD || 'Dy9876543210',
    server: process.env.MSSQL_SERVER || '213.136.77.244',
    database: process.env.MSSQL_DATABASE || 'AlAmerDB',
    port: Number(process.env.MSSQL_PORT ?? 4137),
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: toBoolean(process.env.MSSQL_ENCRYPT, false),
      trustServerCertificate: toBoolean(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, true),
      enableArithAbort: true,
    },
  };
}

const globalForSql = globalThis as unknown as {
  sqlPool: ConnectionPool | undefined;
  sqlPool2: ConnectionPool | undefined;
};

export async function getSqlPool() {
  if (globalForSql.sqlPool) {
    return globalForSql.sqlPool;
  }

  const pool = new sql.ConnectionPool(buildConfig());
  globalForSql.sqlPool = await pool.connect();
  return globalForSql.sqlPool;
}

export async function getSqlPool2() {
  if (globalForSql.sqlPool2) {
    return globalForSql.sqlPool2;
  }

  const pool = new sql.ConnectionPool(buildConfig2());
  globalForSql.sqlPool2 = await pool.connect();
  return globalForSql.sqlPool2;
}

export { sql };
