/**
 * Run autonomous sensory enhancement via gpt-4.1-mini.
 *
 * Usage:
 *   npx ts-node src/scripts/run-sensory-enhancement.ts [--dry-run] [--limit=N] [--category=X]
 *
 * Safety:
 *   - Never overwrites admin/manual_expert/wageningen_panel sources
 *   - Validates all proposals against CalibrationRule invariants
 *   - Only auto-applies proposals with confidence >= 0.85
 *   - Below threshold → queued for admin review (in IngredientChangeLog)
 *   - Every change audit-logged with AI reasoning + source anchors
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/lib/prisma';
import { runEnhancement, findGaps } from '../src/services/ai-enhancer';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryArg = args.find((a) => a.startsWith('--category='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const gapsOnly = args.includes('--gaps-only');

  const category = categoryArg?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

  console.log('\n=== Sensory AI Enhancement Run ===');
  console.log(`  Mode:        ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log(`  Category:    ${category ?? 'all'}`);
  console.log(`  Limit:       ${limit}`);
  console.log();

  if (gapsOnly) {
    const gaps = await findGaps({ category });
    console.log(`Gaps found: ${gaps.length}\n`);
    console.log('Sample (first 20):');
    gaps.slice(0, 20).forEach((g) => {
      console.log(`  ${g.reason.padEnd(20)} ${g.name}`);
    });
    await prisma.$disconnect();
    return;
  }

  const report = await runEnhancement({
    triggeredBy: 'system-cli',
    category,
    limit,
    dryRun,
  });

  console.log('═══════════════════════════════════════════════');
  console.log(`  Gaps found:           ${report.gapsFound}`);
  console.log(`  Auto-applied:         ${report.autoApplied}`);
  console.log(`  Queued for review:    ${report.queuedForReview}`);
  console.log(`  Invariant failures:   ${report.invariantFailures}`);
  console.log(`  AI call failures:     ${report.aiFailures}`);
  console.log(`  Duration:             ${(report.duration / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════\n');

  if (report.details.length > 0) {
    console.log('Details:');
    for (const d of report.details) {
      const icon = {
        applied: '✓',
        queued: '?',
        invariant_failed: '✗',
        ai_failed: '!',
      }[d.status];
      const conf = d.confidence != null ? ` conf=${d.confidence.toFixed(2)}` : '';
      console.log(`  ${icon} ${d.ingredient.padEnd(35)} [${d.status}]${conf}`);
      if (d.violations) {
        d.violations.slice(0, 2).forEach((v) => console.log(`      ! ${v}`));
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
