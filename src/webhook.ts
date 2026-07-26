import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { IncomingHttpHeaders } from "http";
import { parseDiff } from "./diff";
import { getPRDiff, postReviewComments } from "./github";
import { reviewFile } from "./review";
import { PRContext } from "./types";

type PullRequestAction = "opened" | "synchronize";

interface PullRequestPayload {
  action: string;
  installation?: {
    id?: number;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  pull_request: {
    number: number;
    head: {
      sha: string;
    };
  };
}

export async function handleWebhook(
  app: App,
  body: string,
  headers: IncomingHttpHeaders
): Promise<void> {
  try {
    const signature = getHeader(headers, "x-hub-signature-256");
    const eventName = getHeader(headers, "x-github-event");

    if (signature === undefined || eventName === undefined) {
      console.error("Missing required GitHub webhook headers");
      return;
    }

    const isValid = await app.webhooks.verify(body, signature);

    if (!isValid) {
      console.error("Invalid GitHub webhook signature");
      return;
    }

    if (eventName !== "pull_request") {
      return;
    }

    const payload = parsePullRequestPayload(body);
    if (payload === null || !isSupportedAction(payload.action)) {
      return;
    }

    const installationId = payload.installation?.id;
    if (installationId === undefined) {
      console.error(
        "Pull request webhook payload is missing installation id"
      );
      return;
    }

    const context: PRContext = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pullNumber: payload.pull_request.number,
      commitSha: payload.pull_request.head.sha,
    };

    const octokit = (await app.getInstallationOctokit(
      installationId
    )) as unknown as Octokit;
    const diff = await getPRDiff(octokit, context);

    if (diff.length === 0) {
      return;
    }

    const files = parseDiff(diff);

    for (const file of files) {
      try {
        const comments = await reviewFile(file);
        if (comments.length > 0) {
          await postReviewComments(octokit, context, file, comments);
        }
      } catch (error: unknown) {
        console.error("Failed to process changed file", {
          filename: file.filename,
          error,
        });
      }
    }
  } catch (error: unknown) {
    console.error("Unhandled webhook processing error", error);
  }
}

function getHeader(
  headers: IncomingHttpHeaders,
  name: string
): string | undefined {
  const header = headers[name];

  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

function isSupportedAction(action: string): action is PullRequestAction {
  return action === "opened" || action === "synchronize";
}

function parsePullRequestPayload(
  body: string
): PullRequestPayload | null {
  try {
    const payload: unknown = JSON.parse(body);

    if (!isPullRequestPayload(payload)) {
      console.error("Received malformed pull request webhook payload");
      return null;
    }

    return payload;
  } catch (error: unknown) {
    console.error(
      "Failed to parse pull request webhook payload",
      error
    );
    return null;
  }
}

function isPullRequestPayload(
  value: unknown
): value is PullRequestPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as {
    action?: unknown;
    repository?: unknown;
    pull_request?: unknown;
  };

  if (typeof payload.action !== "string") {
    return false;
  }

  if (
    typeof payload.repository !== "object" ||
    payload.repository === null
  ) {
    return false;
  }

  if (
    typeof payload.pull_request !== "object" ||
    payload.pull_request === null
  ) {
    return false;
  }

  const repository = payload.repository as {
    name?: unknown;
    owner?: unknown;
  };
  const pullRequest = payload.pull_request as {
    number?: unknown;
    head?: unknown;
  };

  if (typeof repository.name !== "string") {
    return false;
  }

  if (
    typeof repository.owner !== "object" ||
    repository.owner === null
  ) {
    return false;
  }

  const owner = repository.owner as {
    login?: unknown;
  };

  if (typeof owner.login !== "string") {
    return false;
  }

  if (typeof pullRequest.number !== "number") {
    return false;
  }

  if (
    typeof pullRequest.head !== "object" ||
    pullRequest.head === null
  ) {
    return false;
  }

  const head = pullRequest.head as {
    sha?: unknown;
  };

  return typeof head.sha === "string";
}
