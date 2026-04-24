/**
 * Sensory Regression CLI
 *
 * Commands:
 *   --bootstrap              Lock top recipes as regression fixtures
 *   --run                    Run all fixtures, report pass/fail
 *   --run --recompute        Same, but recompute profiles fresh
 *   --drift                  Detect drift across all recipes
 *   --list                   List all currently-locked fixtures
 *
 * Run: cd server && npx ts-node src/scripts/sensory-regression-cli.ts --run
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/lib/prisma';
import {
  bootstrapFixtures,
  runRegressionSuite,
  detectDrift,
} from '../src/services/regression';

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((a) => ['--bootstrap', '--run', '--drift', '--list'].includes(a));

  if (!mode) {
    console.log('\nUsage:');
    console.log('  --bootstrap              Lock top recipes as fixtures');
    console.log('  --run [--recompute]      Run regression suite');
    console.log('  --drift                  Detect drift across all recipes');
    console.log('  --list                   List locked fixtures');
    process.exit(1);
  }

  console.log('\n=== Sensory Regression CLI ===\n');

  if (mode === '--bootstrap') {
    // Use admin userId from argv or fallback to "system"
    const adminArg = args.find((a) => a.startsWith('--admin='));
    const adminUserId = adminArg ? adminArg.split('=')[1] : 'system';
    const count = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] ?? '10', 10);

    console.log(`Bootstrapping top ${count} recipes as regression fixtures...`);
    const locked = await bootstrapFixtures(adminUserId, { count });
    console.log(`  ✓ Locked ${locked} fixtures`);
  } else if (mode === '--list') {
    const fixtures = await prisma.sensoryRegressionFixture.findMany({
      orderBy: { lockedAt: 'desc' },
    });
    console.log(`Locked fixtures: ${fixtures.length}\n`);
    for (const f of fixtures) {
      const snapshot = await prisma.recipeSensorySnapshot.findUnique({
        where: { recipeId: f.recipeId },
        select: { recipeTitle: true },
      });
      const status = f.lastVerifiedStatus ?? 'unverified';
      const statusIcon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '?';
      console.log(`  ${statusIcon} ${(snapshot?.recipeTitle ?? f.recipeId.slice(0, 8)).padEnd(50)} [${status}] locked ${f.lockedAt.toISOString().slice(0, 10)}`);
    }
  } else if (mode === '--run') {
    const recompute = args.includes('--recompute');
    console.log(`Running regression suite${recompute ? ' (with recompute)' : ''}...\n`);

    const results = await runRegressionSuite({ recompute });

    let passed = 0, failed = 0, warned = 0;
    for (const r of results) {
      const icon = r.status === 'pass' ? '✓' : r.status === 'drift_warning' ? '!' : '✗';
      console.log(`  ${icon} ${r.title.padEnd(48)} [${r.status}]`);

      if (r.dimFailures.length > 0) {
        console.log(`     Failed dims (${r.dimFailures.length}):`);
        r.dimFailures.slice(0, 5).forEach((f) =>
          console.log(`       ${f.dimName.padEnd(20)} expected ${f.expected.toFixed(2)} got ${f.actual.toFixed(2)} (tol ${f.tolerance.toFixed(2)}, Δ ${f.delta.toFixed(2)})`)
        );
      }
      if (r.archetypeFailure) {
        console.log(`     Archetype: expected "${r.archetypeFailure.expected}" got "${r.archetypeFailure.actual ?? 'none'}"`);
      }
      if (r.harmonyFailure) {
        console.log(`     Harmony: expected ${r.harmonyFailure.expected.toFixed(2)} got ${r.harmonyFailure.actual.toFixed(2)}`);
      }

      if (r.status === 'pass') passed++;
      else if (r.status === 'drift_warning') warned++;
      else failed++;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  Results: ${passed} pass / ${warned} warn / ${failed} fail of ${results.length}`);
    console.log(`═══════════════════════════════════════\n`);

    if (failed > 0) process.exit(1);
  } else if (mode === '--drift') {
    const thresholdArg = args.find((a) => a.startsWith('--threshold='));
    const threshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.5;

    console.log(`Detecting drift (threshold: ±${threshold} per dim)...\n`);

    const reports = await detectDrift({ thresholdDelta: threshold });

    if (reports.length === 0) {
      console.log('  ✓ No drift detected\n');
    } else {
      console.log(`  Found ${reports.length} recipes with drift:\n`);
      for (const r of reports) {
        const icon = r.driftSeverity === 'major' ? '⚠' : r.driftSeverity === 'moderate' ? '!' : 'i';
        console.log(`  ${icon} ${r.title.padEnd(45)} [${r.driftSeverity}] max Δ ${r.maxDelta.toFixed(2)}`);
        r.changedDims.slice(0, 3).forEach((d) =>
          console.log(`       ${d.dimName.padEnd(20)} ${d.before.toFixed(2)} → ${d.after.toFixed(2)} (Δ ${d.delta.toFixed(2)})`)
        );
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
