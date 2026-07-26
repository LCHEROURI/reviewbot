import { ParsedFile } from "./types";

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(diff: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const lines = diff.split(/\r?\n/);

  let currentFile: ParsedFile | null = null;
  let newLineNumber = 0;
  let skipCurrentFile = false;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (currentFile !== null) {
        files.push(currentFile);
      }

      currentFile = null;
      newLineNumber = 0;
      skipCurrentFile = false;
      continue;
    }

    if (line.startsWith("Binary files ")) {
      currentFile = null;
      skipCurrentFile = true;
      continue;
    }

    if (line.startsWith("+++ ")) {
      const filename = line.slice(4).trim();

      if (filename === "/dev/null") {
        currentFile = null;
        skipCurrentFile = true;
        continue;
      }

      if (skipCurrentFile) {
        continue;
      }

      currentFile = {
        filename: filename.startsWith("b/") ? filename.slice(2) : filename,
        addedLines: [],
      };
      continue;
    }

    if (currentFile === null || skipCurrentFile) {
      continue;
    }

    const hunkMatch = line.match(HUNK_HEADER_PATTERN);
    if (hunkMatch !== null) {
      newLineNumber = Number.parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentFile.addedLines.push({
        lineNumber: newLineNumber,
        content: line.slice(1),
      });
      newLineNumber += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      continue;
    }

    if (line.startsWith(" ")) {
      newLineNumber += 1;
    }
  }

  if (currentFile !== null) {
    files.push(currentFile);
  }

  return files;
}
