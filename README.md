# @zeroscraps/sensory

Chemistry-backed sensory compound system as a plug-in. 113-dimensional flavor profiles, cooking transforms, natural-language recipe matching.

Distributes as a self-contained npm package with an isolated `sensory` PostgreSQL schema. Install, enable, disable, or uninstall without touching host code or data.

## Documentation

- **[INSTALL.md](INSTALL.md)** — integration guide for host apps (HostAdapter, config, migrations, uninstall)
- **[docs/sensory-compound-knowledge-base.md](docs/sensory-compound-knowledge-base.md)** — master reference for the 113-dim system, interaction model, dose-response, harmony score, calibration protocols
- **[docs/sensory-dimension-reference.md](docs/sensory-dimension-reference.md)** — per-dim lookup (mechanism, anchors, descriptors, thresholds)
- **[docs/sensory-calibration-rules.md](docs/sensory-calibration-rules.md)** — category invariants enforced on ingredient profile writes
- **[docs/sensory-interaction-examples.md](docs/sensory-interaction-examples.md)** — worked JSON examples of all 6 rule tiers
- **[docs/cooking-science-model.md](docs/cooking-science-model.md)** — Maillard, caramelization, collagen breakdown, compound effects, volatile timing curves

## Features

- **113 sensory dimensions** — taste (7), chemesthetic (7), aroma family × secondary (72), texture (19), temperature (1), character (7)
- **17-step computation engine** — ingredient potency + cooking transforms + dose analysis + interaction rules + emergence detection + clash detection + harmony score
- **Natural-language search** — "funky and crunchy, not too spicy" → parsed query + ranked recipes with explanations
- **User preferences** — 15-question onboarding + implicit learning from recipe likes/dislikes + personalized harmony scoring
- **Ingredient intelligence** — substitution suggestions, complement pairings, flavor-chemistry rules
- **Quality systems** — regression test fixtures, drift detection, rule versioning
- **AI gap-filler** — optional gpt-4.1-mini pipeline with 5-layer safeguards (invariants, confidence gating, protected sources, audit trail, category-aware validation)

## Quick start

```bash
# In host app
npm install @zeroscraps/sensory
```

```typescript
// server/src/index.ts
import { createSensoryPlugin } from '@zeroscraps/sensory';
import prisma from './lib/prisma';
import { authMiddleware } from './middleware/auth';

const sensory = createSensoryPlugin({
  databaseUrl: process.env.DATABASE_URL!,
  host: {
    async getRecipe(id) {
      const r = await prisma.recipe.findUnique({
        where: { id },
        include: { ingredients: true, instructions: true },
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
      const rows = await prisma.recipe.findMany({ select: { id: true }, skip: offset, take: limit });
      return rows.map((r) => r.id);
    },
    getUserId: (req) => (req as any).user?.userId,
  },
  authMiddleware,
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deployment: 'gpt-4.1-mini',
  },
});

sensory.register(app);
```

## Endpoints

Once registered, these endpoints are live under `/api/sensory` (configurable):

| Endpoint | Description |
|---|---|
| `POST /api/sensory/search` | Natural-language recipe search |
| `GET /api/sensory/similar/:recipeId` | "More like this" |
| `GET /api/sensory/substitutes/:ingredient` | Ingredient substitutes |
| `GET /api/sensory/complements/:ingredient` | Ingredient pairings |
| `GET /api/sensory/preferences` | Current user preferences |
| `GET /api/sensory/preferences/questions` | Onboarding questions |
| `POST /api/sensory/preferences/onboard` | Submit onboarding answers |
| `POST /api/sensory/preferences/like` | Record a recipe like |
| `POST /api/sensory/preferences/dislike` | Record a recipe dislike |
| `PUT /api/sensory/preferences/avoid` | Set avoidance descriptors |

## Architecture

See [INSTALL.md](INSTALL.md) for step-by-step integration. See [docs/knowledge-base.md](docs/knowledge-base.md) for system design, dimension reference, interaction rules, and calibration protocols.

### Isolation guarantees

- **Schema**: all tables live in PostgreSQL schema `sensory`. Host schemas untouched.
- **Prisma client**: plugin generates its own client in `node_modules/.prisma/sensory-client`. No cross-client imports.
- **No FKs into host tables**: plugin references `Recipe.id` as a plain string column. Host can drop tables without breaking plugin, and vice versa.
- **Host access**: only via the injected `HostAdapter` interface (4 methods). Everything else is plugin-local.
- **Rate limiter**: plugin has own default; host can inject a distributed one.

### Uninstall

```bash
cd <host>
# Disable plugin: remove the createSensoryPlugin() call from index.ts

cd <plugin>
npm run uninstall -- --force
# Runs: DROP SCHEMA sensory CASCADE;
```

Host data (recipes, users, ingredients) is NOT touched.

## Development

```bash
npm install
npm run db:generate          # regenerate Prisma client
npm run build                # tsc
npm run seed                 # run all seeders
npm run cli:regression -- --run
npm run cli:enhance -- --dry-run
```

## License

UNLICENSED. Internal use only.

## Version

0.1.0 — initial extraction from zeroscraps-web monorepo.
