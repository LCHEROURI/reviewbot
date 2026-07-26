# ReviewBot

AI-powered GitHub App that automatically performs code review on pull requests. It fetches changed lines from each PR, asks Anthropic Claude to identify high-signal issues, and posts precise inline comments on the affected code.

## How It Works

When a pull request is opened or updated, GitHub sends a signed webhook event to ReviewBot. ReviewBot:

1. Verifies the webhook signature (HMAC-SHA256)
2. Fetches the PR diff through the GitHub API
3. Parses the diff into changed files and added line numbers
4. Sends added lines to Claude for review
5. Validates Claude's JSON response
6. Posts each issue as an inline pull request review comment

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Server**: Express
- **GitHub**: Octokit (App + REST + Webhooks)
- **AI**: Anthropic Claude (claude-3-5-haiku)
- **Deploy**: Vercel (serverless) or Railway

## Prerequisites

- Node.js 18+
- A GitHub account
- An [Anthropic API key](https://console.anthropic.com/)

---

## Deploy to Vercel (Recommended)

### 1. One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/reviewbot)

Or use the CLI:

```sh
npm i -g vercel
vercel login
vercel --prod
```

### 2. Configure Environment Variables on Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | App private key with `\n` newlines |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret |
| `ANTHROPIC_API_KEY` | Anthropic API key |

### 3. Set Webhook URL in GitHub App

Set your GitHub App's Webhook URL to:
```
https://your-app.vercel.app/webhook
```

---

## Local Development

### 1. Clone and Install

```sh
git clone https://github.com/YOUR_USERNAME/reviewbot.git
cd reviewbot
npm install
```

### 2. Create the GitHub App

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. **GitHub App name**: ReviewBot (or any name)
3. **Homepage URL**: your deployed URL (or `http://localhost:3000`)
4. **Webhook URL**: `http://localhost:3000/webhook` (for local dev)
5. **Webhook secret**: generate a random string, save as `GITHUB_WEBHOOK_SECRET`
6. **Permissions**:
   - Pull requests: **Read & Write**
   - Contents: **Read-only**
7. **Subscribe to events**: Pull request
8. Click **Create GitHub App**
9. Note the **App ID** → save as `GITHUB_APP_ID`
10. Generate a **private key**, download the `.pem` file
11. Convert for the env var:
    ```sh
    awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-key.pem
    ```
    Save the output as `GITHUB_PRIVATE_KEY`
12. **Install** the app on your repositories

### 3. Configure Environment

```sh
cp .env.example .env
```

Fill in all values in `.env`.

### 4. Run with a Tunnel

```sh
npm run dev
```

Use ngrok or smee.io to expose `localhost:3000`:

```sh
npx smee-client --url https://smee.io/your-channel --target http://localhost:3000/webhook
```

### 5. Test It

Open a PR on a repo where ReviewBot is installed. ReviewBot posts inline comments within seconds.

## Example Review Comment

> **[Security]** `eval()` executes arbitrary code and is a critical security vulnerability. Replace with a safe alternative such as JSON.parse() for data or a proper expression parser library.

## Environment Variables

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `GITHUB_APP_ID` | GitHub App ID | GitHub App settings |
| `GITHUB_PRIVATE_KEY` | App private key (`\n` newlines) | GitHub App settings → private key |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC secret | Random string you set |
| `ANTHROPIC_API_KEY` | Claude API key | [Anthropic Console](https://console.anthropic.com/) |
| `PORT` | Express server port (local only) | Default: `3000` |

## Project Structure

```
reviewbot/
├── api/
│   └── index.ts          # Vercel serverless entry point
├── src/
│   ├── app.ts            # Express app factory
│   ├── index.ts          # Local dev entry point
│   ├── webhook.ts        # Webhook handler (verify + route)
│   ├── diff.ts           # Git diff parser
│   ├── github.ts         # Octokit API helpers
│   ├── review.ts         # Claude AI review logic
│   └── types.ts          # TypeScript interfaces
├── .env.example          # Env var template
├── .eslintrc.json        # ESLint config
├── .github/workflows/ci.yml  # CI pipeline
├── .gitignore
├── package.json
├── tsconfig.json
└── vercel.json           # Vercel deployment config
```
