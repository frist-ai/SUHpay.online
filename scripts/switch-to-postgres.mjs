#!/usr/bin/env node
/**
 * Prebuild script for Vercel/Netlify deployment
 * Switches Prisma schema from SQLite to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const postgresqlSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.postgresql.prisma');

console.log('🔄 Checking database configuration...');

// Debug: show all relevant env vars (masked for security)
const maskUrl = (url) => {
  if (!url) return 'NOT SET';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return url.substring(0, 20) + '...' + url.substring(url.length - 20);
  }
  return url;
};

console.log('   NETLIFY_DATABASE_URL:', maskUrl(process.env.NETLIFY_DATABASE_URL));
console.log('   DATABASE_URL:', maskUrl(process.env.DATABASE_URL));
console.log('   NEON_DATABASE_URL:', maskUrl(process.env.NEON_DATABASE_URL));
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   NETLIFY:', process.env.NETLIFY || 'not set');
console.log('   VERCEL:', process.env.VERCEL || 'not set');

// Check for any PostgreSQL URL
const hasNetlifyDb = process.env.NETLIFY_DATABASE_URL?.startsWith('postgresql') || 
                     process.env.NETLIFY_DATABASE_URL?.startsWith('postgres');

const hasDatabaseUrl = process.env.DATABASE_URL?.startsWith('postgresql') || 
                       process.env.DATABASE_URL?.startsWith('postgres');

const hasNeonDb = process.env.NEON_DATABASE_URL?.startsWith('postgresql') || 
                  process.env.NEON_DATABASE_URL?.startsWith('postgres');

// Determine which database to use
const hasPostgresDb = hasNetlifyDb || hasDatabaseUrl || hasNeonDb;

// Check if we're in a production build environment OR any PostgreSQL URL is set
const shouldUsePostgres = hasPostgresDb || 
                          process.env.NODE_ENV === 'production' || 
                          process.env.VERCEL === '1' ||
                          typeof process.env.NETLIFY !== 'undefined' ||
                          process.env.SITE_NAME;

if (hasPostgresDb) {
  console.log('✅ PostgreSQL database detected');
  
  if (fs.existsSync(postgresqlSchemaPath)) {
    fs.copyFileSync(postgresqlSchemaPath, schemaPath);
    console.log('✅ Schema switched to PostgreSQL');
    
    // Log which variables will be used
    if (hasNetlifyDb) {
      console.log('   Using: NETLIFY_DATABASE_URL + NETLIFY_DATABASE_URL_UNPOOLED');
    } else if (hasDatabaseUrl) {
      console.log('   Using: DATABASE_URL');
    } else if (hasNeonDb) {
      console.log('   Using: NEON_DATABASE_URL');
    }
  } else {
    console.error('❌ PostgreSQL schema not found at:', postgresqlSchemaPath);
    process.exit(1);
  }
} else if (shouldUsePostgres) {
  console.log('⚠️ Production build but no PostgreSQL URL found');
  console.log('⚠️ Checking all env vars for debugging...');
  console.log('   All keys with DB:', Object.keys(process.env).filter(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('database')));
  console.log('⚠️ Make sure DATABASE_URL or NETLIFY_DATABASE_URL is set correctly');
  // Still try to use PostgreSQL schema in production
  if (fs.existsSync(postgresqlSchemaPath)) {
    fs.copyFileSync(postgresqlSchemaPath, schemaPath);
    console.log('✅ Schema switched to PostgreSQL (forced for production)');
  }
} else {
  console.log('📦 Using SQLite schema for local development');
}
