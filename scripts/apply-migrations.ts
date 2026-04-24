/**
 * Run the plugin's install/migration SQL files.
 *
 * Usage:
 *   npx ts-node scripts/apply-migrations.ts              # runs 001 + 002 + 003
 *   npx ts-node scripts/apply-migrations.ts --only=001   # just one
 *   npx ts-node scripts/apply-migrations.ts --dry-run    # show what would run
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '../prisma/generated/client';

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  const MIG_DIR = path.resolve(__dirname, '../migrations');
  const files = fs
    .readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !only || f.startsWith(only))
    .sort();

  console.log(`\n=== Applying ${files.length} migration(s) ===\n`);
  if (dryRun) console.log('  [DRY RUN — no writes]\n');

  const prisma = new PrismaClient();
  try {
    for (const file of files) {
      const fullPath = path.join(MIG_DIR, file);
      const sql = fs.readFileSync(fullPath, 'utf-8');
      console.log(`── ${file} (${sql.length} chars) ──`);

      if (dryRun) {
        console.log('  (would execute)\n');
        continue;
      }

      try {
        // Split by top-level semicolons that aren't inside DO $$ ... $$ blocks.
        const statements = splitSql(sql);
        console.log(`  → ${statements.length} statement(s)`);
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (!trimmed || trimmed.startsWith('--')) continue;
          await prisma.$executeRawUnsafe(trimmed);
        }
        console.log('  ✓ Applied\n');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Error: ${msg.slice(0, 300)}\n`);
        throw err;
      }
    }
    console.log('Done.\n');
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Split SQL into individual statements while respecting DO $$ ... $$ blocks.
 */
function splitSql(sql: string): string[] {
  const result: string[] = [];
  let current = '';
  let inDollarBlock = false;
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Enter $$ block
    if (!inDollarBlock && (trimmed.includes('$$') || trimmed.startsWith('DO '))) {
      inDollarBlock = trimmed.split('$$').length % 2 === 0;
      current += line + '\n';
      continue;
    }
    // Exit $$ block
    if (inDollarBlock) {
      current += line + '\n';
      if (line.includes('$$')) {
        inDollarBlock = false;
        // The closing $$ may have trailing ; on next line
        if (trimmed.endsWith(';') || trimmed === '$$;') {
          result.push(current);
          current = '';
        }
      }
      continue;
    }
    // Regular line
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      result.push(current);
      current = '';
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
