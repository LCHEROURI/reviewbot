import { Octokit } from "@octokit/rest";
import { ParsedFile, PRContext, ReviewComment } from "./types";

const MAX_DIFF_BYTES = 500_000;

export async function getPRDiff(
  octokit: Octokit,
  context: PRContext
): Promise<string> {
  const response = await octokit.rest.pulls.get({
    owner: context.owner,
    repo: context.repo,
    pull_number: context.pullNumber,
    mediaType: {
      format: "diff",
    },
  });

  const diff = String(response.data);

  if (Buffer.byteLength(diff, "utf8") > MAX_DIFF_BYTES) {
    console.warn("PR diff exceeds size limit — skipping review", {
      pullNumber: context.pullNumber,
      diffBytes: Buffer.byteLength(diff, "utf8"),
    });
    return "";
  }

  return diff;
}

export async function postReviewComments(
  octokit: Octokit,
  context: PRContext,
  file: ParsedFile,
  comments: ReviewComment[]
): Promise<void> {
  // Post at most 3 comments per file to avoid noise
  const limited = comments.slice(0, 3);

  for (const comment of limited) {
    try {
      await octokit.rest.pulls.createReviewComment({
        owner: context.owner,
        repo: context.repo,
        pull_number: context.pullNumber,
        body: `**[${comment.category}]** ${comment.comment}`,
        commit_id: context.commitSha,
        path: file.filename,
        line: comment.line,
        side: "RIGHT",
      });
    } catch (error: unknown) {
      console.error("Failed to post review comment", {
        owner: context.owner,
        repo: context.repo,
        pullNumber: context.pullNumber,
        filename: file.filename,
        line: comment.line,
        error,
      });
    }
  }
}
