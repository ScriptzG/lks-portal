import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  get clientOrigin(): string {
    return this.clientOrigins[0];
  },
  mockServices: (process.env.MOCK_SERVICES ?? "true").toLowerCase() !== "false",
  netlifyApiToken: process.env.NETLIFY_API_TOKEN ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "LKS Systems <no-reply@lks.systems>",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "lks-storage",
};
