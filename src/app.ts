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

function loadConfig(): Config {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => process.env[name] === undefined || process.env[name] === ""
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    githubAppId: process.env["GITHUB_APP_ID"]!,
    githubPrivateKey: process.env["GITHUB_PRIVATE_KEY"]!.replace(
      /\\n/g,
      "\n"
    ),
    githubWebhookSecret: process.env["GITHUB_WEBHOOK_SECRET"]!,
  };
}

const config = loadConfig();

export const githubApp: App = new App({
  appId: config.githubAppId,
  privateKey: config.githubPrivateKey,
  webhooks: {
    secret: config.githubWebhookSecret,
  },
  Octokit,
});

export function createApp() {
  const server = express();

  // Body size limit: reject payloads over 1 MB
  const MAX_BODY_SIZE = 1_048_576; // 1 MB

  server.get("/health", (_request: Request, response: Response) => {
    response.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  server.post(
    "/webhook",
    express.raw({ type: "*/*", limit: MAX_BODY_SIZE }),
    (request: Request, response: Response) => {
      const body = Buffer.isBuffer(request.body)
        ? request.body.toString("utf8")
        : String(request.body);

      // Fire-and-forget the review; respond immediately to GitHub
      handleWebhook(githubApp, body, request.headers).catch(
        (error: unknown) => {
          console.error("Webhook handler failed", error);
        }
      );

      response.sendStatus(200);
    }
  );

  return server;
}
