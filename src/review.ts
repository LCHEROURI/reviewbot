import Anthropic from "@anthropic-ai/sdk";
import { ParsedFile, ReviewComment } from "./types";

const VALID_CATEGORIES: ReadonlySet<ReviewComment["category"]> = new Set([
  "Bug",
  "Security",
  "Antipattern",
  "Style",
]);

const CLAUDE_MODEL = "claude-3-5-haiku-20241022";

const MAX_INPUT_CHARS = 40_000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const REVIEW_PROMPT = `You are a senior software engineer performing code review.

Review only the added lines provided by the user. Return ONLY a valid JSON array and nothing else. Do not include markdown, backticks, or a preamble.

Each array element must have this exact shape:
{
  "line": number,
  "category": "Bug" | "Security" | "Antipattern" | "Style",
  "comment": string
}

If there are no issues, respond with an empty JSON array: []

Rules:
- Comments must be direct and specific to the actual code shown.
- Never give generic advice.
- Return at most 3 comments per file.
- Do not comment on missing features, missing tests, or missing documentation.
- Only identify actual code issues in the provided added lines.`;

export async function reviewFile(file: ParsedFile): Promise<ReviewComment[]> {
  if (file.addedLines.length === 0) {
    return [];
  }

  try {
    const addedLines = file.addedLines
      .map((line) => `Line ${line.lineNumber}: ${line.content}`)
      .join("\n");

    if (addedLines.length > MAX_INPUT_CHARS) {
      console.warn("File diff too large for Claude — skipping review", {
        filename: file.filename,
        chars: addedLines.length,
      });
      return [];
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: REVIEW_PROMPT,
      messages: [
        {
          role: "user",
          content: `Filename: ${file.filename}\n\nAdded lines:\n${addedLines}`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed: unknown = JSON.parse(text);
    return validateReviewComments(parsed, file);
  } catch (error: unknown) {
    console.error("Failed to review file with Claude", {
      filename: file.filename,
      error,
    });
    return [];
  }
}

function validateReviewComments(
  value: unknown,
  file: ParsedFile
): ReviewComment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedLines = new Set(file.addedLines.map((line) => line.lineNumber));
  const comments: ReviewComment[] = [];

  for (const item of value) {
    if (!isReviewComment(item)) {
      continue;
    }

    if (!allowedLines.has(item.line)) {
      continue;
    }

    comments.push(item);

    if (comments.length === 3) {
      break;
    }
  }

  return comments;
}

function isReviewComment(value: unknown): value is ReviewComment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("line" in value) || !("category" in value) || !("comment" in value)) {
    return false;
  }

  const candidate = value as {
    line: unknown;
    category: unknown;
    comment: unknown;
  };

  return (
    typeof candidate.line === "number" &&
    Number.isInteger(candidate.line) &&
    typeof candidate.category === "string" &&
    VALID_CATEGORIES.has(candidate.category as ReviewComment["category"]) &&
    typeof candidate.comment === "string" &&
    candidate.comment.trim().length > 0
  );
}
