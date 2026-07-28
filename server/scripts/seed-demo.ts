/**
 * Seeds a demo workspace for the CS435 Sprint-0 baseline.
 *
 * Outline self-hosted normally bootstraps its first team through an SSO
 * provider. This course setup has no SSO, so this script creates the team and
 * users directly and turns on guest (email magic-link) sign-in, which then
 * becomes the only sign-in option on the login page.
 *
 * Re-runnable: it exits early if the demo team already exists.
 *
 *   yarn build:server
 *   node build/server/scripts/seed-demo.js
 */
import "./bootstrap";
import type { InferCreationAttributes } from "sequelize";
import { CollectionPermission, UserRole } from "@shared/types";
import { parser } from "@server/editor";
import { Collection, Document, Team, User } from "@server/models";
import { sequelize } from "@server/storage/database";

const TEAM_NAME = "CS435 Demo Wiki";
const SUBDOMAIN = "cs435";

const users = [
  { name: "Ada Admin", email: "admin@example.com", role: UserRole.Admin },
  { name: "Mel Member", email: "member@example.com", role: UserRole.Member },
  { name: "Vic Viewer", email: "viewer@example.com", role: UserRole.Viewer },
];

const collections = [
  {
    name: "Engineering",
    description: "How we build and ship.",
    icon: "beaker",
    color: "#0366d6",
    documents: [
      {
        title: "Onboarding",
        text: [
          "# Onboarding",
          "",
          "Welcome to the team. Work through this list in your first week.",
          "",
          "- [ ] Get access to the repo",
          "- [ ] Run the app locally",
          "- [ ] Ship a one-line change",
          "",
          "Ask questions in the #engineering channel — nothing here is obvious the first time.",
        ].join("\n"),
        children: [
          {
            title: "Local development",
            text: [
              "# Local development",
              "",
              "The app runs natively; Postgres and Redis run in Docker.",
              "",
              "```bash",
              "docker compose up -d postgres redis",
              "yarn install",
              "yarn build",
              "yarn db:migrate",
              "yarn start",
              "```",
              "",
              "The server listens on http://localhost:3003.",
            ].join("\n"),
          },
          {
            title: "Code review",
            text: [
              "# Code review",
              "",
              "Every change gets a second pair of eyes.",
              "",
              "1. Keep pull requests small enough to read in one sitting.",
              "2. Describe *why*, not just *what*.",
              "3. Approve or request changes within one working day.",
            ].join("\n"),
          },
        ],
      },
      {
        title: "Architecture overview",
        text: [
          "# Architecture overview",
          "",
          "| Layer | Technology |",
          "| --- | --- |",
          "| Client | React + MobX |",
          "| Server | Koa + Sequelize |",
          "| Editor | ProseMirror |",
          "| Realtime | Y.js over WebSockets |",
          "| Storage | PostgreSQL, Redis |",
          "",
          "The collaboration service holds the authoritative Y.js document and",
          "persists it back to Postgres on a debounce.",
        ].join("\n"),
      },
    ],
  },
  {
    name: "Product",
    description: "Specs, decisions, and the roadmap.",
    icon: "lightbulb",
    color: "#d73a49",
    documents: [
      {
        title: "Roadmap",
        text: [
          "# Roadmap",
          "",
          "## This quarter",
          "",
          "- Search improvements",
          "- Better mobile editing",
          "- Export to PDF",
          "",
          "## Next quarter",
          "",
          "- Public sharing controls",
          "- Slack notifications",
        ].join("\n"),
      },
      {
        title: "Decision log",
        text: [
          "# Decision log",
          "",
          "> Decisions are cheap to write down and expensive to reconstruct.",
          "",
          "**2026-07-01 — Postgres for full-text search.** Rejected Elasticsearch;",
          "the extra service is not worth it at our size.",
          "",
          "**2026-07-14 — Keep the editor on ProseMirror.** The collaborative",
          "editing layer is the hardest part of the codebase to replace.",
        ].join("\n"),
      },
    ],
  },
  {
    name: "Playground",
    description: "Scratch space — try the real-time editing here.",
    icon: "pencil",
    color: "#28a745",
    documents: [
      {
        title: "Collaboration test",
        text: [
          "# Collaboration test",
          "",
          "Open this document in two browser windows signed in as two different",
          "users and type in both. You should see the other cursor, live.",
          "",
          "---",
          "",
          "Type below this line:",
          "",
        ].join("\n"),
      },
    ],
  },
];

async function createDocument(
  {
    title,
    text,
    parentDocumentId,
  }: { title: string; text: string; parentDocumentId?: string },
  { teamId, userId, collection }: { teamId: string; userId: string; collection: Collection }
) {
  const document = await Document.create({
    title,
    text,
    content: parser.parse(text)?.toJSON(),
    parentDocumentId,
    collectionId: collection.id,
    teamId,
    lastModifiedById: userId,
    createdById: userId,
    publishedAt: new Date(),
    editorVersion: "12.0.0",
  });

  await collection.addDocumentToStructure(document, 0);
  return document;
}

async function main() {
  const existing = await Team.findOne({ where: { subdomain: SUBDOMAIN } });
  if (existing) {
    console.log(`Team "${existing.name}" already exists — nothing to do.`);
    return;
  }

  const team = await Team.create(
    {
      name: TEAM_NAME,
      subdomain: SUBDOMAIN,
      // The login page shows email sign-in only when guest sign-in is on.
      guestSignin: true,
      passkeysEnabled: false,
      authenticationProviders: [],
    } as Partial<InferCreationAttributes<Team>>,
    { include: "authenticationProviders" }
  );

  const created: User[] = [];
  for (const attrs of users) {
    created.push(
      await User.create({
        teamId: team.id,
        name: attrs.name,
        email: attrs.email,
        role: attrs.role,
      } as Partial<InferCreationAttributes<User>>)
    );
  }
  const admin = created[0];

  let documentCount = 0;
  for (const spec of collections) {
    const collection = await Collection.scope("withDocumentStructure").create({
      teamId: team.id,
      createdById: admin.id,
      name: spec.name,
      description: spec.description,
      icon: spec.icon,
      color: spec.color,
      permission: CollectionPermission.ReadWrite,
    } as Partial<InferCreationAttributes<Collection>>);

    for (const doc of spec.documents) {
      const parent = await createDocument(doc, {
        teamId: team.id,
        userId: admin.id,
        collection,
      });
      documentCount++;

      for (const child of doc.children ?? []) {
        await createDocument(
          { ...child, parentDocumentId: parent.id },
          { teamId: team.id, userId: admin.id, collection }
        );
        documentCount++;
      }
    }
  }

  console.log(`Seeded "${team.name}"`);
  console.log(`  users:       ${created.map((user) => user.email).join(", ")}`);
  console.log(`  collections: ${collections.length}`);
  console.log(`  documents:   ${documentCount}`);
  console.log(`\nSign in at ${process.env.URL} — the magic link arrives in Mailpit.`);
}

void main()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
