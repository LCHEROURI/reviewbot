import fs from "fs";
import path from "path";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import express, { Request, Response } from "express";
import { handleWebhook } from "./webhook";

const REQUIRED_ENV_VARS = [
  "GITHUB_APP_ID",
  "GITHUB_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
] as const;

interface Config {
  githubAppId: string;
  githubPrivateKey: string;
  githubWebhookSecret: string;
}

let _githubApp: App | null = null;
let _configError: string | null = null;

function getConfig(): Config | null {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name] || process.env[name]!.trim() === ""
  );

  if (missing.length > 0) {
    _configError = `Missing required environment variables: ${missing.join(", ")}`;
    return null;
  }

  const rawKey = process.env["GITHUB_PRIVATE_KEY"]!.trim();
  // Support both \n literals (from CLI copy-paste) and actual newlines
  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;

  return {
    githubAppId: process.env["GITHUB_APP_ID"]!.trim(),
    githubPrivateKey: privateKey,
    githubWebhookSecret: process.env["GITHUB_WEBHOOK_SECRET"]!.trim(),
  };
}

function getGithubApp(): App | null {
  if (_githubApp) return _githubApp;

  const config = getConfig();
  if (!config) return null;

  try {
    _githubApp = new App({
      appId: config.githubAppId,
      privateKey: config.githubPrivateKey,
      webhooks: {
        secret: config.githubWebhookSecret,
      },
      Octokit,
    });
    _configError = null;
    return _githubApp;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    _configError = `Failed to initialise GitHub App: ${msg}`;
    console.error(_configError);
    _githubApp = null;
    return null;
  }
}

export function createApp() {
  const server = express();

  const MAX_BODY_SIZE = 1_048_576; // 1 MB

  server.get("/", (_request: Request, response: Response) => {
    response.redirect("/dashboard");
  });

  server.get("/dashboard", (_request: Request, response: Response) => {
    const paths = [
      path.join(__dirname, "..", "dashboard.html"),
      path.join(__dirname, "..", "..", "dashboard.html"),
      path.join(process.cwd(), "dashboard.html"),
      path.join(process.cwd(), "dist", "dashboard.html"),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        response.sendFile(p);
        return;
      }
    }
    // Fallback: inline redirect to health for debugging
    response.redirect("/health");
  });

  server.get("/health", (_request: Request, response: Response) => {
    const app = getGithubApp();
    response.status(200).json({
      status: app ? "ok" : "degraded",
      configured: !!app,
      message: app ? "Ready to review" : _configError ?? "Not configured",
      timestamp: new Date().toISOString(),
    });
  });

  server.post(
    "/webhook",
    express.raw({ type: "*/*", limit: MAX_BODY_SIZE }),
    async (request: Request, response: Response) => {
      const app = getGithubApp();
      if (!app) {
        console.error("Cannot process webhook — app not configured");
        response.sendStatus(503);
        return;
      }

      const body = Buffer.isBuffer(request.body)
        ? request.body.toString("utf8")
        : String(request.body);

      // Wait for review to complete so Vercel doesn't terminate mid-flight
      try {
        await handleWebhook(app, body, request.headers);
      } catch (error: unknown) {
        console.error("Webhook handler failed", error);
      }

      response.sendStatus(200);
    }
  );

  return server;
}
