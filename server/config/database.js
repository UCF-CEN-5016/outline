const shared = {
  use_env_variable: process.env.DATABASE_URL ? "DATABASE_URL" : undefined,
  dialect: "postgres",
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD || undefined,
  database: process.env.DATABASE_NAME,
};

// The runtime honours PGSSLMODE=disable (see server/storage/database.ts), so the
// CLI should too — otherwise `yarn db:migrate` forces SSL against a local
// Postgres and fails with "The server does not support SSL connections".
const sslDisabled = process.env.PGSSLMODE === "disable";

module.exports = {
  development: shared,
  test: shared,
  "production-ssl-disabled": shared,
  production: sslDisabled
    ? shared
    : {
        ...shared,
        dialectOptions: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
      },
};
