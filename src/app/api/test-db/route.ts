import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  // Mask the password in the URL for security
  const maskUrl = (url: string | undefined) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      parsed.password = '****';
      return parsed.toString();
    } catch {
      return 'invalid-url';
    }
  };

  const result = {
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    databaseUrl: {
      exists: !!databaseUrl,
      length: databaseUrl?.length || 0,
      masked: maskUrl(databaseUrl),
      isNeon: databaseUrl?.includes('neon.tech') || false,
      isPrismaPostgres: databaseUrl?.includes('prisma.io') || false,
    },
    directUrl: {
      exists: !!directUrl,
      length: directUrl?.length || 0,
      masked: maskUrl(directUrl),
    },
    allEnvKeys: Object.keys(process.env).filter(k =>
      k.includes('DATABASE') ||
      k.includes('POSTGRES') ||
      k.includes('PRISMA') ||
      k.includes('NEON') ||
      k.includes('DB')
    ).sort(),
  };

  return NextResponse.json(result, { status: 200 });
}
