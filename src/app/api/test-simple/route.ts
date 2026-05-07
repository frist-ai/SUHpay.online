import { NextResponse } from 'next/server';

// Simple test endpoint - no database required
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
}
