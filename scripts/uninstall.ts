/**
 * Plugin uninstall script.
 *
 * DESTRUCTIVE: drops the entire `sensory` PostgreSQL schema.
 * All plugin-owned data is lost permanently. Recipe data is NOT touched.
 *
 * Run:
 *   cd <host> && npm run uninstall:sensory
 *   OR
 *   cd <plugin> && npm run uninstall
 *
 * Requires DATABASE_URL env var.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Client } from '../prisma/generated/client/runtime/library';
import { PrismaClient } from '../prisma/generated/client';

async function main() {
  const force = process.argv.includes('--force');
  if (!force) {
    console.error('\n⚠  This will PERMANENTLY DELETE all sensory plugin data.\n');
    console.error('   To proceed, rerun with --force\n');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    console.log('\nDropping sensory schema (CASCADE)...');
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS sensory CASCADE`);
    console.log('  ✓ Schema dropped');
    console.log('\nDone. Recipe data was NOT touched.\n');
  } finally {
    await prisma.$disconnect();
  }
}

// Swallow unused import warning
void Client;

main().catch((err) => {
  console.error('Uninstall failed:', err);
  process.exit(1);
});
