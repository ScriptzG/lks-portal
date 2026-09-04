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
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  mockServices: (process.env.MOCK_SERVICES ?? "true").toLowerCase() !== "false",
  netlifyApiToken: process.env.NETLIFY_API_TOKEN ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "LKS Systems <no-reply@lks.systems>",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
};
