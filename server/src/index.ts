// Must be imported before any router below: Express 4 does not catch rejected promises from
// async route handlers on its own, so an unhandled error inside any `async (req, res) => {...}`
// route would otherwise become an unhandled promise rejection — which, by default in modern
// Node.js, terminates the entire process. This patches Express's routing so those errors are
// forwarded to the error-handling middleware at the bottom of this file instead of crashing the
// server for every user over a single bad request.
import "express-async-errors";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./lib/env.js";
import { authRouter } from "./routes/auth.js";
import { companiesRouter } from "./routes/companies.js";
import { contactsRouter } from "./routes/contacts.js";
import { adminUsersRouter } from "./routes/adminUsers.js";
import { websitesRouter } from "./routes/websites.js";
import { editableFieldsRouter } from "./routes/editableFields.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { billingRouter } from "./routes/billing.js";
import { notificationsRouter } from "./routes/notifications.js";
import { settingsRouter } from "./routes/settings.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { messagesRouter } from "./routes/messages.js";
import { documentsRouter } from "./routes/documents.js";
import { ticketsRouter } from "./routes/tickets.js";
import { extrasRouter } from "./routes/extras.js";

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

// Serves uploaded website files/assets directly, used as the base for the client live-preview iframe.
app.use("/storage", express.static(path.resolve(process.cwd(), "storage")));

app.get("/api/health", (_req, res) => res.json({ ok: true, mockServices: env.mockServices }));

app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/admin/clients", adminUsersRouter);
app.use("/api/websites", websitesRouter);
app.use("/api/websites/:id/fields", editableFieldsRouter);
app.use("/api/deployments", deploymentsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/extras", extrasRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`LKS Client Portal API listening on http://localhost:${env.port} (mockServices=${env.mockServices})`);
});

// Last-resort safety net for errors that happen outside any request's lifecycle entirely —
// e.g. the mock deploy service's setTimeout callback in runDeploy() — which express-async-errors
// can't catch since there's no active Express request/response to forward the error to. Log and
// keep the process alive rather than let a single stray error take the whole API down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
