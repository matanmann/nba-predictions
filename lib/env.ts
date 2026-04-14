function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  CLERK_SECRET_KEY: required("CLERK_SECRET_KEY"),
  NBA_API_KEY: required("NBA_API_KEY"),
  NBA_API_BASE: process.env.NBA_API_BASE ?? "https://api.balldontlie.io/v1",
  CRON_SECRET: required("CRON_SECRET"),
  ADMIN_USER_IDS: (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean),
} as const;