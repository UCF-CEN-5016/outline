# Outline — Student Setup Guide

This is a **course fork of [outline/outline](https://github.com/outline/outline)** — a team wiki and
knowledge base with **real-time collaborative editing** (TypeScript, React + MobX, Koa, PostgreSQL,
Redis, ProseMirror). Two people can edit the same document and see each other's cursors live; that
sync engine is the most interesting part of this codebase.

📚 **Official documentation:** <https://docs.getoutline.com/s/hosting/>

Verified end to end on macOS (Apple Silicon) and on Windows 11 (Docker Desktop, WSL2 backend).
**On Windows, PowerShell and Git Bash both work.** Every `yarn` and `docker` command below is
identical in either — `yarn` runs package scripts in its own built-in shell, and the scripts in this
fork use Node's `fs` rather than shelling out to POSIX tools. Only a few plain shell commands differ
between the two (`openssl`, `mkdir -p`, and the `VAR=value cmd` prefix in step 8); where that
happens, the PowerShell equivalent is given right below it.

---

## ⚠️ Read this first

1. **There is no real email, and you must use one of the three seeded addresses** (step 6) — not
   your own. Sign-in is a magic link delivered to a fake local mailbox (**Mailpit**,
   <http://localhost:8027>). If you type your own address, the server silently accepts the request (yes, that's a bug)
   and sends nothing — see [Gotcha #2](#9-gotchas). **The link is in Mailpit, for a address to test upon.**. To play around with the tool, make sure you open both URLs (3003 port and 8027 port)
2. **You cannot create the first account yourself.** Outline normally bootstraps its first team
   through Google/Slack/OIDC single sign-on, which this course setup does not configure. The seed
   script creates the team and users for you. Until you run it, the login page has **no sign-in
   options at all**.
3. **Your clone path must have no spaces or apostrophes** (e.g. `~/dev/outline`, not
   `~/Fall'26/outline`). A `'` in the path silently corrupts the production build — see
   [Gotcha #7](#9-gotchas) for the exact error. If you can't move the clone, use **Path A (Docker)**
   below; it builds inside the container at a fixed internal path and is immune to this.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Docker Desktop** | any recent | Always required — runs PostgreSQL, Redis, and Mailpit. On Windows use the **WSL2** backend. |
| **Git** | any recent | |
| **Node.js** | **22** | Only needed for **Path B** (running the app natively) and for running the test suite. `engines` allows 20.12+, 22, or 24 below 24.17.0, or 26 below 26.3.1, and **22 is the version upstream targets** — pick it if you're installing fresh (`winget install OpenJS.NodeJS.22`, or [nvm-windows](https://github.com/coreybutler/nvm-windows)). If you already have the 24.18+ that `winget install OpenJS.NodeJS` gives you: it sits just outside that range, but Yarn only warns rather than refusing, and install → build → migrate → seed → run was verified end to end on 24.18.0. You don't have to downgrade. |
| **Yarn** | **4.11.0** | Path B only. Pinned via `packageManager`; run `corepack enable` once. On Windows that writes shims into `C:\Program Files\nodejs` and **needs an Administrator terminal** — see [Gotcha #11](#9-gotchas). Confirm with `yarn -v`. |

> 💡 **New to MobX?** Outline's React client manages state with [MobX](https://mobx.js.org/the-gist-of-mobx.html) (observables + reactions), not Redux. [*The Gist of MobX*](https://mobx.js.org/the-gist-of-mobx.html) is a 10-minute read — do it before touching anything in `app/stores/`.

> 💡 **New to ProseMirror?** The document editor is built on [ProseMirror](https://prosemirror.net/docs/guide/). Its *Guide* explains the document model, transactions, and plugins — essential reading before working on anything in `shared/editor/`.

> 📖 **Architecture:** Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) in this repo first — it maps the server, client, real-time collaboration engine, and plugin system and tells you where to start for common task types.

**macOS:** if Docker Desktop won't start and reports `VZErrorDomain Code=1`, **disable Rosetta** in
its settings. Every image used here is ARM-native.

---

## 2. Pick a path

| | **Path A — Docker** | **Path B — Native** |
| --- | --- | --- |
| The app itself runs | in a container | directly on your machine via `yarn` |
| Needs Node/Yarn installed | No | Yes |
| Hot reload / fast iteration | No — every change needs an image rebuild (~1 min) | **Yes**, once you switch to dev mode — see [section 5](#5-the-edit-run-loop) |
| Works with a clone path containing spaces/apostrophes | **Yes** | **No** — the build breaks, see [Gotcha #7](#9-gotchas) |
| Recommended for | A first look at the app, or a machine where the Node toolchain won't cooperate | **Anyone writing code — so, everyone on this course** |

**If you are going to change code, use Path B.** Not because Docker is slow — a rebuild is only
about a minute (measured below) — but because Path B gives you instant client reloads, a debugger
port, and debug-level logs, and because **you need Node and Yarn installed for the test suite
anyway** (section 8). Once they're installed, Path A saves you nothing. [Section 5](#5-the-edit-run-loop)
is the loop you'll actually live in.

Both paths share the same `.env` file and the same PostgreSQL/Redis/Mailpit containers — you can
follow **section 3 (Configure)** once regardless of which path you pick, then branch at section 4.
You can also switch paths later without reconfiguring anything.

```bash
git clone <your-team-fork-url>
cd outline
```

---

## 3. Configure

```bash
cp .env.sample .env     # PowerShell: cp is an alias for Copy-Item, so this works as-is

# Two secrets — run this twice, one value for SECRET_KEY and one for UTILS_SECRET.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`openssl rand -hex 32` does the same job if you have it (Git Bash ships it, PowerShell doesn't). The
Node one-liner works in both shells; on Path A, where you may not have Node installed, use Git Bash
or any other source of 64 random hex characters.

Set these in `.env`. 
the four `SMTP_*` lines at the bottom do **not** exist in `.env.sample` and need to be added.

```ini
NODE_ENV=production
URL=http://localhost:3003
PORT=3003
FORCE_HTTPS=false

SECRET_KEY=<first openssl value>
UTILS_SECRET=<second openssl value>

DATABASE_URL=postgres://user:pass@127.0.0.1:5432/outline
PGSSLMODE=disable
REDIS_URL=redis://127.0.0.1:6379

FILE_STORAGE=local
# Path B (native): an absolute Windows/macOS/Linux path you'll create in step 4, e.g.
#   C:/Users/you/outline-data  or  /Users/you/outline-data
# Path A (Docker): ignored — docker-compose.yml points the container at its own
# internal path and stores it in a named volume, so this value doesn't matter for Path A.
FILE_STORAGE_LOCAL_ROOT_DIR=<absolute path to a writable folder you create>

# Mailpit — where your sign-in links appear. These four keys aren't in .env.sample; add them.
SMTP_HOST=127.0.0.1
SMTP_PORT=1027
SMTP_FROM_EMAIL=hello@example.com
SMTP_SECURE=false
SMTP_DISABLE_STARTTLS=true

RATE_LIMITER_ENABLED=false
ENABLE_UPDATES=false

# .env.sample ships these with placeholder text, not blank — leave them non-empty and
# the login page shows a "Continue with Slack" button that 500s (see Gotcha #3). Blank
# them out so email is the only sign-in option, matching what the seed script intends.
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_APP_ID=
```

---

## 4. Build, migrate, test, run

### Path A — Docker

One command builds the app image and starts the backend services — PostgreSQL (database), Redis (database caching), Mailpit (email services), and Outline:

```bash
docker compose up -d
```

The first run builds the app image (`yarn install` + `yarn build` inside the container, a few
minutes). Then migrate and seed by running one-off commands against the running stack:

```bash
docker compose run --rm outline yarn db:migrate         # a few hundred migrations, a few seconds
docker compose run --rm outline node build/server/scripts/seed-demo.js
```

The app is at **<http://localhost:3003>**. If migrate reports a `Validation error` about a
duplicate key on the first try, just re-run the same command — it's idempotent and this resolves
on retry (occasionally Postgres reports itself ready a moment before it truly is).

To rebuild after pulling new code:

```bash
docker compose build outline
docker compose up -d outline
docker compose run --rm outline yarn db:migrate
```

### Path B — Native

```bash
docker compose up -d postgres redis mailpit

# Create the folder you named in FILE_STORAGE_LOCAL_ROOT_DIR.
mkdir -p <the FILE_STORAGE_LOCAL_ROOT_DIR path you chose>
# PowerShell: New-Item -ItemType Directory -Force <that same path>

corepack enable                           # once per machine — Windows: Administrator terminal (command prompt, run as administrator)
yarn install --immutable
yarn build                                # ~1 min
yarn db:migrate                           # a few hundred migrations, a few seconds
node build/server/scripts/seed-demo.js    # creates the team, users and demo content
yarn start
```

> ⚠️ **`yarn build` is what creates the `build/` directory**, and the last three commands all run out
> of it. If you skip it, or it dies partway, they fail with
> `Error: Cannot find module '…\build\server\index.js'` (or `…\build\server\scripts\seed-demo.js`)
> rather than with anything mentioning the build — see [Gotcha #10](#9-gotchas). A successful
> `yarn build` ends by printing `Done!`.

The app is at **<http://localhost:3003>**. `yarn start` runs in the foreground and logs there — leave
it running, open the URL in a browser, and Ctrl-C when you're done.

---

## 5. The edit-run loop

Section 4 leaves you with a **production build**: nothing rebuilds when you edit a file. That's the
right thing for a first run and for a final check, but it's not how you work day to day. Development
mode watches your files instead.

### One-time setup: `.env.local`

With `NODE_ENV=development`, Outline layers three files: `.env`, then the tracked `.env.development`,
then `.env.local` — later wins, and anything already set in your shell beats all three. You need
`.env.local` because `.env.development` is upstream's own dev setup and points at
`https://local.outline.dev:3000`, which expects mkcert and a hosts entry. Create it in the repo root
(it's gitignored, so it stays yours):

```ini
# Keep dev mode on the same plain-HTTP URL as the production path.
URL=http://localhost:3003

# In development Outline throws away your SMTP settings and generates a
# single-use ethereal.email account instead — unless SMTP_USERNAME is set
# (see server/emails/mailer.tsx). Any non-empty value turns that off, so
# sign-in emails keep landing in Mailpit.
SMTP_USERNAME=mailpit
SMTP_PASSWORD=mailpit
```

Leave `.env` alone — `NODE_ENV=production` stays in it. The dev scripts export
`NODE_ENV=development` themselves, and that wins.

### Day to day

```bash
docker compose up -d postgres redis mailpit   # once per reboot; these are never rebuilt
yarn dev:watch
```

That's the whole loop — leave it running:

| You edit | What happens | How long |
| --- | --- | --- |
| `app/**`, `shared/editor/**`, `shared/components/**` | Vite pushes the change to the browser | instant |
| `server/**`, `plugins/**`, the rest of `shared/**` | server recompiles and restarts on its own | ~50 s |
| `.env`, `.env.local`, `.env.development` | server restarts | ~50 s |
| `server/migrations/**` | nothing — deliberately ignored; run `yarn db:migrate` yourself | — |

The app stays at **<http://localhost:3003>**. `yarn dev:watch` also starts a Vite server on port
**3001** that the page pulls its assets from — that one has no API, so don't open it directly. The
server also listens for a debugger on **9229** (`--inspect`), and dev mode logs at `debug` level,
including printing the magic sign-in link straight into the terminal if you'd rather not open
Mailpit.

### Working on the server

The loop above costs ~50 s per server edit, and 40 s of that is swc recompiling all of `server/`,
`shared/` and `plugins/` from scratch — `yarn build:server` has no incremental mode, it deletes
`build/server` and starts over. That's fine for clicking through a change in the browser, but it is
the wrong inner loop for working out backend logic.

Use the test suite for that instead. Vitest runs the TypeScript directly — **no build step at all** —
and in watch mode it keeps the process warm and re-runs only what your change touched:

```bash
# One-time, if you haven't done section 8 yet:
NODE_ENV=test yarn sequelize db:create
NODE_ENV=test yarn sequelize db:migrate

# Then, pointed at the test file for whatever you're changing:
yarn test:watch --project server server/routes/api/comments/comments.test.ts
```

Measured on this machine, re-run after saving a source file:

| Loop | Cost |
| --- | --- |
| `yarn test:watch`, small presenter test | **~6 s** |
| `yarn test:watch`, full comments API route test (1,165 lines, hits Postgres) | **~9 s** |
| `yarn dev:watch`, same change seen in the browser | ~50 s |

So the answer to "I changed backend logic, how do I check it?" is usually **not** the browser:

1. **`yarn test:watch` on the relevant test file** — this is where the iterating happens. Add a
   failing test for the behaviour you want, make it pass. Seconds per attempt.
2. **`yarn dev:watch` in a second terminal** when you want to click through the real UI, or check
   something the tests don't cover (an email that shows up in Mailpit, a websocket event, a
   permission that only bites through the API). ~50 s per change, but you need far fewer of them.
3. **`yarn build && yarn start`** once before the PR.

Steps 1 and 2 can run at the same time. Tests use their own database — `.env.test` points them at
`outline-test`, not `outline` — so a test run cannot wipe your seeded workspace.

### Before you open a PR: run the production build once

```bash
# Ctrl-C dev:watch first
yarn build && yarn start
```

Worth the wait (~1 minute on this machine), because production is genuinely a different
build: minified bundles, the service worker / PWA step, secure cookies under `NODE_ENV=production`,
and the i18n extraction pass. Things that work in dev mode can still break here, and this is what
Path A and your reviewers run.

### Rebuilding the Docker image (Path A)

```bash
docker compose build outline && docker compose up -d outline
```

Editing any tracked file invalidates the image's `COPY . .` layer, so `yarn build` re-runs inside the
container — but only that layer. The dependency layers stay cached as long as `package.json` and
`yarn.lock` don't change, which makes this much cheaper than the "rebuild the whole image" it sounds
like.

### What each loop actually costs

Measured on Windows 11 (Docker Desktop / WSL2), warm caches, on this repo:

| Loop | Cost | Manual? |
| --- | --- | --- |
| Dev mode, client file (`app/**`) | **instant** | no — Vite pushes it |
| Dev mode, server file (`server/**`) | ~50 s | no — nodemon does it |
| `yarn build && yarn start` (Path B production) | ~55 s + restart | yes, every time |
| `docker compose build outline && docker compose up -d outline` (Path A) | ~60 s | yes, every time |

So Docker isn't the slow one — a rebuild is about the same minute as a native production build. The
reason to prefer dev mode is that client edits cost **nothing** instead of a minute, and that
nobody has to remember to type anything. If your work is mostly React (`app/**`), dev mode is the
difference between a one-second loop and a one-minute one; if it's mostly server code, all three
options land within a few seconds of each other and you should pick dev mode simply because it's
automatic.

---

## 6. Sign in

The seed script creates three users, one per permission level. There are no passwords.

| Email | Role |
| --- | --- |
| `admin@example.com` | Admin |
| `member@example.com` | Member |
| `viewer@example.com` | Viewer — handy for testing permissions |

1. Open <http://localhost:3003> and enter one of the addresses.
2. Open <http://localhost:8027> (Mailpit).
3. Open the newest "Magic Sign-in Link" email and click the link inside.

> ⚠️ **The link expires after 10 minutes** and is tied to the machine that requested it. A stale
> link bounces you straight back to the login page with
> `?notice=auth-error&description=Expired%20token` in the URL bar — which looks exactly like the
> login silently failing. Don't save links or paste them into chat; request a fresh one and click it
> immediately. Once you're in, the session lasts about three months.

You should land in the **CS435 Demo Wiki** workspace: three collections (Engineering, Product,
Playground) and seven documents.

---

## 7. Try the real-time collaboration

Worth doing before you pick a task — it's the feature that makes this project interesting.

1. Sign in as `admin@example.com` in a normal window.
2. Sign in as `member@example.com` in a **private/incognito window** (a second normal window shares
   cookies and won't work).
3. Open **Playground → Collaboration test** in both.
4. Type in one. It appears in the other as you type, with the other user's cursor and avatar.

---

## 8. Run the tests

The test suite runs natively — it needs Node/Yarn installed locally (see Prerequisites) even if
you're running the app itself via Path A.

```bash (gitbash not vscode terminal i.e., powershell)
NODE_ENV=test yarn sequelize db:drop      # first time only
NODE_ENV=test yarn sequelize db:create
NODE_ENV=test yarn sequelize db:migrate

yarn test                                 # full suite, ~70 s
```

PowerShell has no `VAR=value cmd` prefix, so set the variable once for the session instead:

```powershell
$env:NODE_ENV = "test"
yarn sequelize db:drop                    # first time only
yarn sequelize db:create
yarn sequelize db:migrate
yarn test
Remove-Item Env:NODE_ENV                  # back to the dev database for later commands
```

Narrower runs: `yarn test:server`, `yarn test:app`, `yarn test:shared`, `yarn test:watch`. The suite
is **Vitest** (not Jest), and `TZ=UTC` is already built into the `test` script.

Two harmless warnings you can ignore: a `client.query()` deprecation from the `pg` driver, and
missing sourcemaps for `prosemirror-codemark`.

---

## 9. Gotchas

1. **Login page shows no sign-in options** — you skipped the seed script, or it ran against a
   different database. Re-run the seed command from step 4 for your path.
2. **The magic link never arrives, even though the request "succeeded"** — almost always because
   the email you typed doesn't exactly match one of the three seeded addresses
   (`admin@example.com`, `member@example.com`, `viewer@example.com`). The server deliberately
   returns `{"success":true}` for *any* email, seeded or not, so it can't be used to probe which
   accounts exist — so a non-matching address silently sends nothing and looks identical to success.
   Use one of the three exact addresses. If it still doesn't show up, confirm you're checking
   Mailpit (<http://localhost:8027>), not your real inbox.
3. **"Continue with Slack" appears on the login page and 500s when clicked**
   (`Error: Cannot send secure cookie over unencrypted connection`) — `.env.sample` ships
   `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/`SLACK_APP_ID` with non-empty placeholder text rather
   than blank, so the app thinks Slack sign-in is configured and shows the button. It always 500s
   locally regardless of the (fake) credentials, because Outline hardcodes secure cookies whenever
   `NODE_ENV=production`, and `http://localhost` isn't HTTPS. Fix: blank all three `SLACK_*` keys in
   `.env` (step 3 above) so email is the only sign-in option, then recreate the app so it picks up
   the change — `docker compose up -d --force-recreate outline` (Path A) or restart `yarn start`
   (Path B).
4. **You click the link and land back on the login page** — it expired (10-minute limit). Check the
   URL bar for `notice=auth-error`. Request a new one and click it right away.
5. **Port conflicts** — this project uses 3003 (app), 5432 (Postgres), 6379 (Redis), 8027/1027
   (Mailpit). Find the culprit with `lsof -nP -iTCP:3003 -sTCP:LISTEN`, or
   `netstat -ano | findstr "3003"` on Windows.
6. **Use `yarn dev:watch`, not `make up`, for dev mode.** `make up` does the same thing plus
   `yarn install-local-ssl`, which shells out to **mkcert** — and it starts only Postgres and Redis,
   not Mailpit. mkcert isn't actually required either way: without certs Vite just warns
   `No local SSL certs found, HTTPS will not be available` and serves over plain HTTP, which is what
   [section 5](#5-the-edit-run-loop) relies on. (`make` also isn't installed on Windows by
   default.)
7. **`yarn build` fails with a cryptic "Missing semicolon" error inside `workbox-build`/`sw.js`,
   pointing at a file path containing your clone directory** — your clone path has a space or `'` in
   it (e.g. `Fall'26 TA`). The service-worker build embeds the absolute file path as a JS string
   literal, and the stray `'` terminates it early. Fix: either move the clone somewhere with no
   spaces or apostrophes and re-run `yarn build`, or switch to **Path A (Docker)** — the build runs
   inside the container at a fixed path (`/opt/outline`) and never sees your host path.
8. **Your changes don't show up.** The section 4 commands are a production build — nothing
   watches your files there. Either switch to `yarn dev:watch`
   ([section 5](#5-the-edit-run-loop)), or rebuild by hand: `yarn build:server` after a server
   change, `yarn build` after a client change, then restart `yarn start`. On Path A, rebuild the
   image: `docker compose build outline && docker compose up -d outline`.
9. **(Windows) A `yarn` script dies with `command not found: mkdir` / `command not found: cp`** —
   you're on an older checkout. The build scripts used to shell out to POSIX tools that PowerShell
   and cmd.exe don't have; they now use Node's `fs` and run the same in either shell. Pull `main`
   and re-run.
10. **`Error: Cannot find module '…\build\server\index.js'`** (or `…\build\server\scripts\seed-demo.js`,
    with `code: 'MODULE_NOT_FOUND'`) — `build/` isn't there, because `yarn build` never ran or failed
    partway. The error names the missing file rather than the missing build step, which makes this
    look worse than it is. Fix: re-run `yarn build` from the repo root, check that it ends with
    `Done!`, and confirm `build/server/index.js` now exists. `yarn clean` deletes `build/`, so
    running it without a following `yarn build` produces exactly this. Path A never hits it — the
    image builds `build/` inside the container.
11. **(Windows) `corepack enable` fails with `Internal Error: EPERM: operation not permitted, open
    'C:\Program Files\nodejs\yarn'`** — Corepack installs its shims into Node's own install
    directory, which a normal user can't write to. Open Windows Terminal or PowerShell **as
    Administrator**, run `corepack enable` there once, close it, and go back to your normal terminal.
    `yarn -v` should then print `4.11.0`. It's once per machine, and not needed at all if `yarn -v`
    already works.
12. **`shared/i18n/locales/en_US/translation.json` shows as modified after every `yarn build`** — the
    build re-extracts UI strings from the source files, and on a CRLF working tree the multi-line
    keys come back containing `\r\n`. The repo ships a `.gitattributes` that keeps the working tree
    LF on every platform, so fresh clones don't see this. In a clone made before that was added:
    `git checkout -- shared/i18n/locales/en_US/translation.json`, and keep that file out of your
    commits.

---

## 10. Daily workflow

**Path A (Docker):**

**Path A (Docker):**

```bash
docker compose up -d
```

**Path B (Native) — writing code:**

```bash
docker compose up -d postgres redis mailpit
yarn dev:watch
```

**Path B (Native) — just running the last production build:**

```bash
docker compose up -d postgres redis mailpit
yarn start
```

Reset to a clean seeded state:

```bash
# Path A
docker compose run --rm outline yarn db:reset
docker compose run --rm outline node build/server/scripts/seed-demo.js

# Path B
yarn db:reset
node build/server/scripts/seed-demo.js
```

PostgreSQL and the local file storage each persist in a named Docker volume, so stopping containers
(`docker compose stop`, or restarting your machine) doesn't lose data. `docker compose down -v`
**does** delete both volumes — only use `-v` when you actually want a clean slate.

---

## 11. Where things live

| Path | What's in it |
| --- | --- |
| `app/` | React client (MobX state management) |
| `server/` | Koa API server, Sequelize models, background workers |
| `server/collaboration/` | the real-time sync engine — **change carefully** |
| `shared/` | types and editor code used by both sides |
| `plugins/` | auth providers, storage backends, integrations |

Read `docs/ARCHITECTURE.md` first. Good starter work lives in documents, collections, sharing, and
permissions — **not** the sync engine, where conflict-resolution bugs are subtle and hard to spot.

---

## Contributing workflow

All team members have write access to this repository, so the team uses a **branch-based** workflow — not forks. Here is the background and the commands.

**Why not forks?** Forking is the standard model for contributing to open-source projects where you _don't_ have write access: you fork to your own GitHub account, clone your fork, and open a PR from your fork back to the original. You will encounter this when contributing to the upstream project. But for your course team — where everyone has write access to the shared repo — it just adds confusion: two clones on your machine, two remotes to keep in sync, merge conflicts that are harder to reason about.

**Branch-based workflow** is what most professional teams use internally. You clone the shared repo once, create a short-lived branch for each issue, push the branch back to the same repo, and open a PR from that branch into `main`. One clone, one remote, full PR workflow.

### For each issue you work on

```bash
# One-time setup: clone the team repo (skip if already done)
git clone https://github.com/CSCI-435-SE/outline.git
cd outline

# Before starting each issue: make sure you are on a fresh main
git checkout main
git pull origin main

# Create a branch named for the issue
git checkout -b feat/issue-17-dark-mode      # new feature
git checkout -b fix/issue-42-toast-dismiss   # bug fix

# ... make your changes, run tests ...

# Stage and commit
git add <the files you changed>
git commit -m "feat: add dark mode toggle (#17)"

# Push the branch to the team repo
git push origin feat/issue-17-dark-mode
```

After pushing, GitHub shows a **"Compare & pull request"** banner on the repository page. Click it to open a PR from your branch into `main`. Fill in the description (what changed and why), reference the issue (`Closes #17`), and request a review from a teammate.

**Branch naming:**

| Prefix | Use for |
|---|---|
| `feat/issue-<N>-short-description` | new features |
| `fix/issue-<N>-short-description` | bug fixes |
| `chore/short-description` | docs, config, dependency updates |

> ⚠️ **`main` is protected — direct pushes are blocked.** All changes go through a reviewed PR. If you accidentally commit to `main` locally, move your changes to a branch before pushing:
>
> ```bash
> git checkout -b fix/issue-42-my-fix   # create branch from your current state
> git checkout main
> git reset --hard origin/main          # revert local main to match remote
> ```

**After your PR is merged**, delete the branch to keep the repo tidy:

```bash
git checkout main
git pull origin main
git branch -d feat/issue-17-dark-mode
```
