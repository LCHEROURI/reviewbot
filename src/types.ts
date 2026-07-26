export interface ParsedFile {
  filename: string;
  addedLines: AddedLine[];
}

export interface AddedLine {
  lineNumber: number;
  content: string;
}

export interface ReviewComment {
  line: number;
  category: "Bug" | "Security" | "Antipattern" | "Style";
  comment: string;
}

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
}
