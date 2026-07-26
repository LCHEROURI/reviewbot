
## Summary

Fetch the most complete **reviewbot** repository from GitHub, perform a full-stack code and architecture review, fix identified issues, commit & push changes, and deploy to Vercel as a new project.

## Steps

### 1. Discover & Select ReviewBot Repos
- Search GitHub for `reviewbot` using agent-browser (headless Chromium automation) to visit `https://github.com/search?q=reviewbot&type=repositories&s=stars&o=desc`
- Evaluate the top 3–5 results by stars, recent commits, completeness, and language/framework fit
- **Selection criteria**: most recently maintained, TypeScript/JavaScript preferred (best Vercel compatibility), clear README, meaningful directory structure
- If multiple repos cover complementary features (e.g., one handles PR comments well, another has good CI integration), note them for potential integration

### 2. Clone the Selected Repo(s)
- Clone the winning repo(s) into the workspace using `git clone`
- If multiple repos are selected, consolidate them into a unified project structure under a single root

### 3. Code & Architecture Review (Read-Only Audit)
Perform a thorough review covering:

- **Architecture & Structure**: Directory layout, separation of concerns, module boundaries, monorepo vs single-package
- **Dependencies**: Outdated or vulnerable packages (`npm audit`), unnecessary bloat, missing peer deps
- **Code Quality**: Linting violations, TypeScript strictness, error handling gaps, async/await misuse, hardcoded secrets, magic numbers
- **Security**: Exposed tokens/keys, unsanitized inputs, unsafe eval, lack of rate limiting, unprotected webhook endpoints
- **Performance**: Blocking calls, missing caching, N+1 queries, unoptimized bundle size
- **Testing**: Missing or flaky tests, low coverage, no CI configured
- **Documentation**: Outdated or missing README, no setup instructions, missing environment variable docs
- **Vercel readiness**: Check for `vercel.json`, build scripts, serverless function compatibility, edge runtime constraints
- **Environment variables**: Catalog all required env vars from source code (e.g., `GITHUB_TOKEN`, `OPENAI_API_KEY`, `DATABASE_URL`)

### 4. Fix Identified Issues
For each category found lacking in step 3:

- **package.json**: Fix dependency versions, add missing scripts (`build`, `start`, `lint`, `vercel-build`)
- **Security**: Add input validation, sanitize webhook payloads, add rate limiting middleware, remove any hardcoded secrets (replace with `process.env`)
- **TypeScript**: Enable strict mode, fix type errors, add missing interfaces/types
- **Error handling**: Wrap async route handlers, add global error boundary, improve error messages
- **Config**: Add/update `vercel.json` with correct build settings, routes, and environment variable declarations
- **README**: Update with setup, deploy, and usage instructions
- **Tests**: Add at least a smoke test for the core webhook handler if missing
- **CI**: Add a minimal GitHub Actions workflow (lint + test + build) if absent
- **Cleanup**: Remove dead code, unused imports, console.log spam

### 5. Commit & Push
- Stage all changes with a clear, conventional commit message: `fix: code review, security hardening, and Vercel deployment prep`
- Push to the remote GitHub repo (create a new branch if pushing to a fork)

### 6. Deploy to Vercel
- Install Vercel CLI (`npm i -g vercel`)
- Run `vercel login` (may require browser auth — user involvement)
- Link the project: `vercel link` (new project)
- Configure environment variables from the catalog built in step 3
- Run `vercel --prod` for production deployment
- Verify the deployment URL loads and responds correctly using agent-browser

## Tests

- **Pre-deploy**: `npm run lint && npm run build` must pass with zero errors
- **Smoke test**: Hit the deployed Vercel URL and verify a 200 response (or the expected webhook response)
- **Browser verification**: Use agent-browser to confirm the deployed app renders/responds as expected
- **GitHub webhook test** (if applicable): Send a mock webhook payload to the deployed endpoint and verify processing

## Risks

- **GitHub auth**: Cloning and pushing requires valid git credentials or PAT configured on the machine
- **Vercel auth**: `vercel login` requires browser interaction; user may need to complete OAuth flow
- **Environment variables**: The app may require a GitHub App or OAuth App setup with specific permissions; the plan will document these but the user must configure them in GitHub
- **Rate limiting**: The deployed bot may hit GitHub API rate limits without authentication or if used heavily
- **Repo selection ambiguity**: If no clear "best" reviewbot exists, the plan will default to the most-starred actively maintained TypeScript repo
