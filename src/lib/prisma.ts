/**
 * Plugin's own Prisma client.
 *
 * The plugin has its own schema (sensory.*) and its own Prisma generated client.
 * Connects to the SAME database as the host but only sees its own tables.
 */

import { PrismaClient } from '../../node_modules/.prisma/sensory-client';

let instance: PrismaClient | null = null;

function init(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL || '' },
    },
    log: ['warn', 'error'],
  });
}

/**
 * Singleton Prisma client. Lazy-initialised on first access.
 * Consumers import this and use it like a regular prisma client.
 */
const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!instance) instance = init();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (instance as any)[prop];
  },
});

export default prisma;

export async function disconnectPrisma(): Promise<void> {
  if (instance) {
    await instance.$disconnect();
    instance = null;
  }
}

// Re-export the client type for downstream modules.
export type { PrismaClient } from '../../node_modules/.prisma/sensory-client';
