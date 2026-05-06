import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/polls - Get all polls
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeStats = searchParams.get('includeStats') === 'true';

    const where = status ? { status } : {};

    const polls = await db.poll.findMany({
      where,
      include: {
        pollOptions: {
          orderBy: { sortOrder: 'asc' },
          ...(includeStats ? {
            include: {
              _count: {
                select: { pollResponses: true },
              },
            },
          } : {}),
        },
        ...(includeStats ? {
          _count: {
            select: { pollResponses: true },
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(polls);
  } catch (error) {
    console.error('Error fetching polls:', error);
    return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 });
  }
}

// POST /api/polls - Create new poll
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { question, options, targetType, duration } = body;

    if (!question || !options || options.length < 2) {
      return NextResponse.json({
        error: 'Question and at least 2 options required'
      }, { status: 400 });
    }

    const pollId = crypto.randomUUID();
    const closesAt = new Date(Date.now() + (duration || 24) * 60 * 60 * 1000);

    const poll = await db.poll.create({
      data: {
        id: pollId,
        question,
        targetType: targetType || 'all',
        duration: duration || 24,
        status: 'draft',
        closesAt,
        pollOptions: {
          create: options.map((text: string, index: number) => ({
            id: crypto.randomUUID(),
            text,
            sortOrder: index,
          })),
        },
      },
      include: {
        pollOptions: true,
      },
    });

    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
  }
}
