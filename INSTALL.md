# @zeroscraps/sensory — Installation Guide

Step-by-step integration into a host Express + Prisma app.

## Prerequisites

- PostgreSQL 14+ with `vector` extension available
- Host app using `@prisma/client` and Express 5
- Host has a `Recipe` model with `ingredients` + `instructions` relations

## Step 1 — Install package

### From local filesystem (during development)

```bash
cd <host>/server
npm install "file:../../zeroscraps-sensory"
```

### From npm (once published)

```bash
cd <host>/server
npm install @zeroscraps/sensory
```

## Step 2 — Run plugin migrations

The plugin creates the `sensory` PostgreSQL schema and all its tables.

```bash
cd <plugin>
DATABASE_URL="<same as host>" \
  psql "$DATABASE_URL" -f migrations/001_create_sensory_schema.sql

# If you are MIGRATING from the monorepo version (tables in catalog/meal):
psql "$DATABASE_URL" -f migrations/002_migrate_catalog_to_sensory.sql

# If you are MIGRATING from Phase 1 (sensory columns on Recipe):
psql "$DATABASE_URL" -f migrations/003_decouple_recipe.sql

# Generate Prisma client + apply remaining schema
npx prisma db push --schema prisma/schema.prisma
```

> **FORWARD-ONLY**: migration 003 drops sensory columns from the host's
> `recipe.recipes` table. Back up your database before applying.

## Step 3 — Seed reference data

```bash
cd <plugin>
DATABASE_URL="..." npm run seed
```

Seeds: 113 dimensions, 120 calibration rules, 72 interaction rules, 246 vocabulary descriptors, 10 emergences, 11 clashes, 15 dose thresholds.

## Step 4 — Wire plugin in host

```typescript
// <host>/server/src/index.ts
import express from 'express';
import { createSensoryPlugin } from '@zeroscraps/sensory';
import prisma from './lib/prisma';
import { authMiddleware } from './middleware/auth.middleware';

const app = express();

// ... existing middleware + routes

const sensory = createSensoryPlugin({
  databaseUrl: process.env.DATABASE_URL!,
  host: {
    async getRecipe(id) {
      const r = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: { select: { name: true, quantity: true, unit: true, role: true } },
          instructions: { select: { stepNumber: true, text: true } },
        },
      });
      if (!r) return null;
      return {
        id: r.id,
        title: r.title,
        ingredients: r.ingredients,
        instructions: r.instructions,
      };
    },
    async listRecipeIds({ limit = 100, offset = 0 } = {}) {
      const rows = await prisma.recipe.findMany({
        select: { id: true },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => r.id);
    },
    getUserId: (req) => req.user?.userId,
  },
  authMiddleware,
  azureOpenAI: process.env.AZURE_OPENAI_ENDPOINT
    ? {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
      }
    : undefined,
});

sensory.register(app);

// On shutdown
process.on('SIGTERM', async () => {
  await sensory.shutdown();
});
```

## Step 5 — Compute profiles for existing recipes

After install, existing recipes have empty profiles. Run the host's recompute:

```bash
cd <host>/server
npx ts-node src/scripts/recompute-sensory.ts   # (you provide this)
```

Or programmatically:

```typescript
import { composeRecipeSensoryV2, persistV2Result } from '@zeroscraps/sensory';

for (const recipeId of allRecipeIds) {
  const recipe = await getRecipe(recipeId);
  const result = await composeRecipeSensoryV2(
    recipe.ingredients,
    recipe.instructions,
    recipe.title
  );
  await persistV2Result(recipeId, recipe.title, result);
}
```

## Step 6 — (Optional) Bootstrap regression fixtures

Locks top-quality recipes as "gold standard" for future regression testing.

```bash
cd <plugin>
npm run cli:regression -- --bootstrap --count=10 --admin=system
```

## Step 7 — (Optional) Run AI gap-filler

For ingredients lacking profiles, run the AI enhancer:

```bash
cd <plugin>
npm run cli:enhance -- --dry-run --limit=10    # preview
npm run cli:enhance -- --limit=30              # apply
```

## Disable

Remove or comment out the `sensory.register(app)` call. Plugin routes return 404. Data stays intact.

## Uninstall

```bash
cd <plugin>
npm run uninstall -- --force
```

This drops `sensory` schema and all plugin data. Host data (`recipe`, `auth`, etc.) is untouched.

## Troubleshooting

**Issue**: Prisma error "schema `sensory` does not exist"
→ Run `migrations/001_create_sensory_schema.sql` first.

**Issue**: `recipe_snapshots` empty after install
→ Existing recipes don't have profiles yet. Run the recompute script from Step 5.

**Issue**: `vector` extension missing
→ `CREATE EXTENSION vector;` in your Postgres database (requires superuser).

**Issue**: AI enhancer falls back to "disabled"
→ Check `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` are set in the plugin's environment.

## Upgrade (future)

Plugin versions bump independently of the host. Follow each version's CHANGELOG for migration steps.

```bash
npm update @zeroscraps/sensory
cd node_modules/@zeroscraps/sensory
npm run db:migrate       # apply new plugin migrations
```
