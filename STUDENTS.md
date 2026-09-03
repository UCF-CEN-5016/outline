# Outline — Student Setup Guide

This is a course fork of [outline/outline](https://github.com/outline/outline) — a team wiki with
real-time collaborative editing (TypeScript, React, Koa, PostgreSQL, Redis). Two people can edit the
same document and see each other's cursors live.

📚 Official docs: <https://docs.getoutline.com/s/hosting/> · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Overview

**Use one terminal for everything in this guide.**

- **Windows:** PowerShell. 
- **macOS / Linux:** default Terminal.

| Step | What you do  |
| --- | --- | --- |
| 1 | Install Docker, Node and Yarn |
| 2 | Clone the repo | 1 min |
| 3 | Create two config files (`.env`, `.env.local`) |
| 4 | Start the services, build once, create the demo data|
| 5 | Sign in and check it works |

After that, run `yarn dev:watch` during development.

**Two things that need to be considered.**

1. **There is no real email.** Sign-in is a magic link that lands in **Mailpit**
   (<http://localhost:8027>), a dummy inbox on your machine.
2. **You cannot create your own account.** There is no sign-up. A seed script (step 4) creates the
   team and three users for you, and you sign in as one of those. Until you run it, the login page
   has no sign-in options at all.
---

## 1. Install what you need

| Tool | Version | Notes |
| --- | --- | --- |
| **Docker Desktop** |  recent version | Runs the database, cache and mailbox. On Windows use the WSL2 backend. |
| **Git** |  recent | |
| **Node.js** | **22** | `winget install OpenJS.NodeJS.22`, or [nvm-windows](https://github.com/coreybutler/nvm-windows). If you already have 24.18+, that works too — it's slightly outside the declared range but Yarn only warns, and the whole setup was verified on it. |
| **Yarn** | **4.11.0** | Run `corepack enable` once. Check with `yarn -v`. |

> **Windows:** `corepack enable` writes into `C:\Program Files\nodejs`, so it needs an
> **Administrator** terminal. Open PowerShell as Administrator, run it once, close it, then go back
> to your normal terminal.

> **macOS:** if Docker Desktop won't start and reports `VZErrorDomain Code=1`, disable Rosetta in its
> settings.

---

## 2. Get the code

```bash
git clone https://github.com/CSCI-435-SE/outline.git
cd outline
```

---

## 3. Create your config files

You need two files. You need to create these.

### `.env`

Copy the sample, then edit it:

```bash
cp .env.sample .env (to copy the file)
```

Generate two secrets — run this **twice** and use a different value for each:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Now set these in `.env`:

```ini
NODE_ENV=production
URL=http://localhost:3003
PORT=3003
FORCE_HTTPS=false

SECRET_KEY=<first generated value>
UTILS_SECRET=<second generated value>

DATABASE_URL=postgres://user:pass@127.0.0.1:5432/outline
PGSSLMODE=disable
REDIS_URL=redis://127.0.0.1:6379

# A folder for uploaded files. Create it yourself (step 4).
FILE_STORAGE=local
FILE_STORAGE_LOCAL_ROOT_DIR=C:/Users/you/outline-data

# These four are NOT in .env.sample — add them. This is what points email at Mailpit.
SMTP_HOST=127.0.0.1
SMTP_PORT=1027
SMTP_FROM_EMAIL=hello@example.com
SMTP_SECURE=false
SMTP_DISABLE_STARTTLS=true

RATE_LIMITER_ENABLED=false
ENABLE_UPDATES=false

# .env.sample fills these with placeholder text. Blank them out, or the login page
# shows a broken "Continue with Slack" button.
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_APP_ID=
```

### `.env.local`

This one is short. It only applies when you run in development mode, and it fixes two things that
would otherwise bite you:

```ini
# Without this, development mode tries to use https://local.outline.dev:3000
URL=http://localhost:3003

# Without this, development mode ignores your mail settings and sends sign-in
# links to a random public test inbox instead of Mailpit.
SMTP_USERNAME=mailpit
SMTP_PASSWORD=mailpit
```

Leave `NODE_ENV=production` in `.env` — the dev commands override it themselves. Don't edit
`.env.development`; it belongs to the upstream project.

---

## 4. First run

Run these in order, from the repo folder:

```bash
# Start the three background services
docker compose up -d postgres redis mailpit

# Create the uploads folder you named in FILE_STORAGE_LOCAL_ROOT_DIR
mkdir C:/Users/you/outline-data

# Install dependencies and build once (~1 min)
yarn install --immutable
yarn build

# Set up the database and create the demo team, users and documents
yarn db:migrate
node build/server/scripts/seed-demo.js

# Start the app
yarn dev:watch
```

Open **<http://localhost:3003>**.

A few notes:

- **`yarn build` must finish and print `Done!`.** The two commands after it read from the `build/`
  folder it creates. If you skip it you'll get `Cannot find module '...\build\server\index.js'`,
  which looks alarming but just means "you haven't built yet".
- If `yarn db:migrate` fails once with a duplicate-key error, run it again — Postgres occasionally
  reports itself ready a moment early.
- `yarn dev:watch` keeps running and prints logs. Leave it. Ctrl-C stops it.
- It also starts a second server on port 3001 that feeds the browser its files. Ignore it — always
  use port 3003.

---

## 5. Sign in

There are no passwords. Three users exist, one per permission level:

| Email | Role |
| --- | --- |
| `admin@example.com` | Admin |
| `member@example.com` | Member |
| `viewer@example.com` | Viewer — useful for testing permissions |

1. Open <http://localhost:3003> and type one of those three addresses. **It must match exactly** —
   your own address will appear to work and then silently send nothing.
2. Open <http://localhost:8027> — this is Mailpit, the fake inbox.
3. Open the newest "Magic Sign-in Link" email and click the link inside.

> The link **expires in 10 minutes**. A stale one bounces you back to the login page with
> `notice=auth-error` in the address bar, which looks like the login just failing. Request a fresh
> one and click it right away. Once you're in, the session lasts about three months.

You should land in the **CS435 Demo Wiki** workspace with three collections and seven documents.

**Try the live collaboration** — it's the most interesting part of this codebase. Sign in as
`admin@example.com` in a normal window and as `member@example.com` in a **private/incognito** window
(two normal windows share cookies and won't work). Open **Playground → Collaboration test** in both
and type. You'll see the other cursor live.

---

## 6. Working on the code

`yarn dev:watch` watches your files. What happens when you save:

| You change | What happens | How long |
| --- | --- | --- |
| Anything in `app/` (the React UI) | The browser updates itself | instant |
| Anything in `server/` or `plugins/` | The server rebuilds and restarts itself | ~50 s |
| A file in `server/migrations/` | Nothing — run `yarn db:migrate` yourself | — |

You never run a build command by hand while working. Just save and look.

**If you're changing server logic, don't use the browser as your test loop.** Run the test file for
what you're touching instead — it takes about 6–9 seconds per attempt instead of 50:

```bash
yarn test:watch --project server server/routes/api/comments/comments.test.ts
```

Use the browser for what tests can't show you: an email in Mailpit, live collaboration, how a
permission actually feels for a Viewer.

> **New to MobX or ProseMirror?** The UI state is [MobX](https://mobx.js.org/the-gist-of-mobx.html)
> (not Redux) and the editor is [ProseMirror](https://prosemirror.net/docs/guide/). Both have short
> intros worth reading before touching `app/stores/` or `shared/editor/`.

### Starting up again

```bash
docker compose up -d postgres redis mailpit
yarn dev:watch
```

Restart the db

```bash
yarn db:reset
node build/server/scripts/seed-demo.js
```

`docker compose stop` is safe. **`docker compose down -v` deletes your database and uploaded
files** — only use `-v` when you actually want that.

---

## 7. Running the tests

Tests use their own separate database, so they can't touch your demo data.

```bash
yarn db:create:test      # first time 
yarn db:migrate:test     # first time 

yarn test              
yarn test:server       
yarn test:app          
yarn test:watch      
```

Two warnings you can ignore: a `client.query()` deprecation from the Postgres driver, and missing
sourcemaps for `prosemirror-codemark`.

---

## 8. Before you open a pull request

These are the same checks the project's CI runs, and finding a failure here is much faster than
finding it on GitHub:

```bash
yarn lint
yarn tsc
yarn test
yarn build     # the production build — it can catch things dev mode doesn't
```

---

## 9. Troubleshooting

1. **The login page shows no sign-in options.** You skipped the seed script, or it ran against a
   different database. Re-run `node build/server/scripts/seed-demo.js`.

2. **The magic link never arrives, but the page said it worked.** You almost certainly typed an
   address that isn't one of the three seeded ones. The server returns success for *any* address on
   purpose (so nobody can use it to discover which accounts exist), so a typo looks identical to
   success. Use `admin@example.com`, `member@example.com` or `viewer@example.com` exactly, and check
   Mailpit at <http://localhost:8027>, not your real inbox.

3. **The link sends you back to the login page.** It expired — they last 10 minutes. Request a new
   one and click it immediately.

4. **`Error: Cannot find module '...\build\server\index.js'`** (or `...seed-demo.js`). The `build/`
   folder isn't there. Run `yarn build` and check it ends with `Done!`. Note that `yarn clean`
   deletes `build/`, so running it without a rebuild afterwards causes exactly this.

5. **`corepack enable` fails with `EPERM: operation not permitted`.** It needs an Administrator
   terminal on Windows — see [step 1](#1-install-what-you-need). Not needed at all if `yarn -v`
   already works.

6. **`yarn build` fails with a "Missing semicolon" error mentioning your folder path.** Your clone
   path contains a space or an apostrophe. Move the clone somewhere like `C:\dev\outline` and
   rebuild.

7. **A "Continue with Slack" button appears and crashes when clicked.** The `SLACK_*` keys in your
   `.env` still have the sample's placeholder text in them. Blank all three (step 3) and restart.

8. **Your changes don't show up.** You're probably running `yarn start` (a fixed production build)
   rather than `yarn dev:watch`. Switch to `yarn dev:watch`.

9. **Something is already using a port.** This project uses 3003 (app), 3001 (dev file server),
   5432 (Postgres), 6379 (Redis), 8027 and 1027 (Mailpit). Find the culprit with
   `netstat -ano | findstr "3003"` on Windows, or `lsof -nP -iTCP:3003 -sTCP:LISTEN` on macOS.

10. **`shared/i18n/locales/en_US/translation.json` shows as changed and you didn't touch it.** The
    build regenerates it. Run `git checkout -- shared/i18n/locales/en_US/translation.json` and keep
    it out of your commits.

11. **Don't run `make up`.** It's the upstream project's dev command; it skips Mailpit and expects
    tools you don't have. `yarn dev:watch` is the equivalent here.

---

## 10. Optional: run the whole thing in Docker

It's useful if your Node install is not working, or to check your
change works the way the app actually ships.

```bash
docker compose up -d                                    # builds the image the first time
docker compose run --rm outline yarn db:migrate
docker compose run --rm outline node build/server/scripts/seed-demo.js
```

Same URL, <http://localhost:3003>. After changing code you must rebuild — there's no auto-reload:

```bash
docker compose build outline && docker compose up -d outline
```

That takes about a minute, which is fine as an occasional check but far too slow as a way of
working. Use `yarn dev:watch` for actual development.

---

## 11. Where things live

| Path | What's in it |
| --- | --- |
| `app/` | React client (MobX for state) |
| `server/` | Koa API server, database models, background workers |
| `server/collaboration/` | the real-time sync engine — **leave this alone at first** |
| `shared/` | code used by both the client and the server |
| `plugins/` | sign-in providers, storage backends, integrations |

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before your first issue. Good starter work is in
documents, collections, sharing and permissions — **not** the sync engine, where bugs are subtle and
hard to review.

---

## Contributing workflow

Everyone on the team has write access to this repository, so we use **branches, not forks**.

**Why not forks?** Forking is for contributing to projects where you *don't* have write access — you
copy the repo to your own account and open a PR back. You'll meet that model in open source. But
within a team that already has access, it just means two clones and two remotes to keep in sync.
Branch-based work is what most professional teams do internally: one clone, one remote, a short-lived
branch per issue.

### For each issue

```bash
# Start from an up-to-date main
git checkout main
git pull origin main

# Branch, named for the issue
git checkout -b feat/issue-17-dark-mode      # new feature
git checkout -b fix/issue-42-toast-dismiss   # bug fix

# ... make your changes, run the checks from section 8 ...

git add <the files you changed>
git commit -m "feat: add dark mode toggle (#17)"
git push origin feat/issue-17-dark-mode
```

GitHub then shows a **"Compare & pull request"** button. Open the PR into `main`, say what changed
and why, reference the issue (`Closes #17`), and ask a teammate to review.

| Branch prefix | Use for |
| --- | --- |
| `feat/issue-<N>-short-description` | new features |
| `fix/issue-<N>-short-description` | bug fixes |
| `chore/short-description` | docs, config, dependencies |

> **`main` is protected — you cannot push to it directly.** If you accidentally commit to `main`
> locally, move the work onto a branch before pushing:
>
> ```bash
> git checkout -b fix/issue-42-my-fix   # branch from your current state
> git checkout main
> git reset --hard origin/main          # put local main back
> ```

After your PR is merged, delete the branch:

```bash
git checkout main
git pull origin main
git branch -d feat/issue-17-dark-mode
```
