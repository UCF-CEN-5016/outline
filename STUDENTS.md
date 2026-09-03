# Outline — Student Setup Guide

This is a **course fork of [outline/outline](https://github.com/outline/outline)** — a team wiki and
knowledge base with **real-time collaborative editing** (TypeScript, React + MobX, Koa, PostgreSQL,
Redis, ProseMirror). Two people can edit the same document and see each other's cursors live; that
sync engine is the most interesting part of this codebase.

📚 **Official documentation:** <https://docs.getoutline.com/s/hosting/>

Verified end to end on macOS (Apple Silicon) and on Windows 11 (Docker Desktop, WSL2 backend).
**On Windows, run every command in this guide in Git Bash — not PowerShell or cmd.exe.** The build
scripts shell out to POSIX tools (`cp`, `mkdir -p`, …) that PowerShell doesn't have, and every command
below assumes a POSIX shell.

---

## ⚠️ Read this first

1. **There is no real email, and you must use one of the three seeded addresses** (step 5) — not
   your own. Sign-in is a magic link delivered to a fake local mailbox (**Mailpit**,
   <http://localhost:8027>). If you type your own address, the server silently accepts the request (yes, that's a bug)
   and sends nothing — see [Gotcha #2](#8-gotchas). **The link is in Mailpit, for a address to test upon.**. To play around with the tool, make sure you open both URLs (3003 port and 8027 port)
2. **You cannot create the first account yourself.** Outline normally bootstraps its first team
   through Google/Slack/OIDC single sign-on, which this course setup does not configure. The seed
   script creates the team and users for you. Until you run it, the login page has **no sign-in
   options at all**.
3. **Your clone path must have no spaces or apostrophes** (e.g. `~/dev/outline`, not
   `~/Fall'26/outline`). A `'` in the path silently corrupts the production build — see
   [Gotcha #7](#8-gotchas) for the exact error. If you can't move the clone, use **Path A (Docker)**
   below; it builds inside the container at a fixed internal path and is immune to this.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| **Docker Desktop** | any recent | Always required — runs PostgreSQL, Redis, and Mailpit. On Windows use the **WSL2** backend. |
| **Git** | any recent | |
| **Node.js** | **22** | Only needed for **Path B** (running the app natively) and for running the test suite. `engines` allows 20.12+, 22, or 24 below 24.17.0, or 26 below 26.3.1 — but **22 is the simplest reliable choice**. ⚠️ The Node 24 that `winget install OpenJS.NodeJS` installs on Windows is **24.18+, which is *not* in the allowed range** — install 22 instead (e.g. `winget install OpenJS.NodeJS.22`, or via [nvm-windows](https://github.com/coreybutler/nvm-windows)). |
| **Yarn** | **4.11.0** | Path B only. Pinned via `packageManager`; run `corepack enable` once. |

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
| Hot reload / fast iteration | No (rebuild the image after every change) | No on this production path either — see [Gotcha #8](#8-gotchas) |
| Works with a clone path containing spaces/apostrophes | **Yes** | **No** — the build breaks, see [Gotcha #7](#8-gotchas) |
| Recommended for | Windows, or anyone who just wants it running to try the app | macOS/Linux, or anyone actively modifying server/client code |

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
cp .env.sample .env
openssl rand -hex 32    # run twice — one value for each secret (SECRET_KEY and UTILS_SECRET)
```

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
mkdir -p <the FILE_STORAGE_LOCAL_ROOT_DIR path you chose>

corepack enable
yarn install --immutable
yarn build                                # ~15 s
yarn db:migrate                           # a few hundred migrations, a few seconds
node build/server/scripts/seed-demo.js    # creates the team, users and demo content
yarn start
```

The app is at **<http://localhost:3003>**.

---

## 5. Sign in

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

## 6. Try the real-time collaboration

Worth doing before you pick a task — it's the feature that makes this project interesting.

1. Sign in as `admin@example.com` in a normal window.
2. Sign in as `member@example.com` in a **private/incognito window** (a second normal window shares
   cookies and won't work).
3. Open **Playground → Collaboration test** in both.
4. Type in one. It appears in the other as you type, with the other user's cursor and avatar.

---

## 7. Run the tests

The test suite runs natively — it needs Node/Yarn installed locally (see Prerequisites) even if
you're running the app itself via Path A. On Windows, run these in Git Bash.

```bash
NODE_ENV=test yarn sequelize db:drop      # first time only
NODE_ENV=test yarn sequelize db:create
NODE_ENV=test yarn sequelize db:migrate

yarn test                                 # full suite, ~70 s
```

Narrower runs: `yarn test:server`, `yarn test:app`, `yarn test:shared`, `yarn test:watch`. The suite
is **Vitest** (not Jest), and `TZ=UTC` is already built into the `test` script.

Two harmless warnings you can ignore: a `client.query()` deprecation from the `pg` driver, and
missing sourcemaps for `prosemirror-codemark`.

---

## 8. Gotchas

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
6. **Don't run `make up` unless you want the dev server.** It needs **mkcert** for local HTTPS and
   serves the client from a separate Vite server on port **3001**. The paths above are one process
   on one port and need neither.
7. **`yarn build` fails with a cryptic "Missing semicolon" error inside `workbox-build`/`sw.js`,
   pointing at a file path containing your clone directory** — your clone path has a space or `'` in
   it (e.g. `Fall'26 TA`). The service-worker build embeds the absolute file path as a JS string
   literal, and the stray `'` terminates it early. Fix: either move the clone somewhere with no
   spaces or apostrophes and re-run `yarn build`, or switch to **Path A (Docker)** — the build runs
   inside the container at a fixed path (`/opt/outline`) and never sees your host path.
8. **No hot reload on either path.** Path B: after changing server code run `yarn build:server`;
   after changing client code run `yarn build`. Then restart `yarn start`. Path A: rebuild the image
   (`docker compose build outline && docker compose up -d outline`).
9. **(Windows) `cp`/`mkdir`/etc. "is not recognized" when running a `yarn` script in PowerShell** —
   PowerShell doesn't have these POSIX tools. Run all commands in this guide from Git Bash instead.

---

## 9. Daily workflow

**Path A (Docker):**

```bash
docker compose up -d
```

**Path B (Native):**

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

## 10. Where things live

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
