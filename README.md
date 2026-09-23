# NONONICK AI

AI agent orchestrator with a floating Orb UI. Zero npm dependencies (Node 20+). The browser is only a control surface; planning, agents, file work and deployment run on the server.

## Quick start
```bash
cp .env.example .env      # then edit: at least one provider key + model list
npm test && npm start     # http://127.0.0.1:3000
npm run hooks             # optional: pre-commit secret scan
```
Model IDs are not preset: put the ones you want in `*_MODELS` (comma-separated, tried in order).

## Configuration (all via environment / `.env`)
| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `OPENROUTER_MODELS` | Primary provider |
| `GROQ_API_KEY`, `GROQ_MODELS` | Fallback provider |
| `CUSTOM_BASE_URL`, `CUSTOM_MODELS`, `CUSTOM_API_KEY` | Any OpenAI-compatible endpoint |
| `PROVIDER_ORDER`, `PROVIDER_TIMEOUT_MS` | Failover order (default `openrouter,groq,custom`) and per-call timeout |
| `APP_TOKEN` | Bearer token required for every `/api` call (except `/api/health`). **Set it if the server is reachable from your phone.** Enter it in Settings. |
| `HOST`, `PORT` | Bind address (default `127.0.0.1:3000`) |
| `MAX_AGENTS`, `MAX_PARALLEL`, `MAX_AGENT_DEPTH`, `AGENT_RETRIES` | Orchestrator limits |
| `DEPLOY_DIR` | Directory approved deployments are copied to. Unset = deploy returns 501 |
| `DATA_DIR` | Tasks, uploads, workspaces, memory (default `./data`, git-ignored) |

## How it works
1. **Router** (`server/router.js`): tries each configured provider × model; fails over on timeout, HTTP error, empty reply. Keys never reach the browser.
2. **Orchestrator** (`server/orchestrator.js`): planner → agents (independent ones in parallel, `dependsOn` for sequential) → agents may `SPAWN:` helpers → retry on error → validation (JS syntax, JSON, HTML sanity, secret scan) → one automatic fixer pass → synthesis. Status persists in `data/tasks.json`; tasks running during a restart are marked `interrupted`.
3. **Files**: agents emit `<<<FILE path>>>…<<<END>>>` blocks written into a per-task workspace. Path traversal and secret-like content are refused. Preview is served sandboxed at `/preview/<taskId>/`.
4. **Deployment gate**: the UI shows the exact file list + hashes and asks "Deploy this version?". The API deploys only with `confirm:true` and the hash of the reviewed manifest; changed files or validation errors block it. Nothing else publishes or sends anything.
5. **Memory**: approved deployments are stored in `data/memory.json`; the planner sees the last five.

## API
`GET /api/health` · `GET /api/providers` · `POST /api/chat` · `POST|GET /api/tasks` · `GET /api/tasks/:id` · `GET|POST /api/tasks/:id/deploy` · `GET|POST /api/files`

## GitHub
`ci.yml` runs secret scan, syntax build and tests on every push. `deploy.yml` is manual (`workflow_dispatch`) and pauses for approval through a protected `production` environment (add required reviewers); it needs secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` and fails clearly without them. `.env` is git-ignored and blocked by the scanner.

## Not implemented yet
External-service tools (email sending, marketing platforms), streaming responses, ZIP extraction (ZIPs are only listed), an in-app file editor.
