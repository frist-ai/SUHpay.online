import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Database client with Neon serverless adapter for Vercel/Netlify.
 * Uses WebSocket-based connection pooling through Neon's proxy,
 * which works reliably in serverless environments.
 */
const createPrismaClient = () => {
  // In production, use Neon adapter for serverless-optimized connections
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    try {
      const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
      console.log('[DB] Using Neon WebSocket adapter')
      return new PrismaClient({
        adapter,
        log: ['error', 'warn'],
      })
    } catch (e) {
      console.error('[DB] Neon adapter failed, falling back to standard PrismaClient:', e)
    }
  }

  // Development: use standard PrismaClient
  return new PrismaClient({
    log: ['error'],
  })
}

let db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  db = globalForPrisma.prisma
} else {
  db = createPrismaClient()
}

export { db }
