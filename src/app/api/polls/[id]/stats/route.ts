import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/polls/[id]/stats - Get poll statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const poll = await db.poll.findUnique({
      where: { id },
      include: {
        pollOptions: {
          include: {
            _count: {
              select: { pollResponses: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    
    // Calculate percentages
    const stats = poll.pollOptions.map(opt => ({
      id: opt.id,
      text: opt.text,
      sortOrder: opt.sortOrder,
      voteCount: opt._count.pollResponses,
      percentage: poll.totalVotes > 0 ? Math.round((opt._count.pollResponses / poll.totalVotes) * 100) : 0,
    }));
    
    return NextResponse.json({
      poll: {
        id: poll.id,
        question: poll.question,
        status: poll.status,
        totalVotes: poll.totalVotes,
        closesAt: poll.closesAt,
      },
      options: stats,
      totalVotes: poll.totalVotes,
      isActive: poll.status === 'active',
      timeRemaining: poll.closesAt && new Date(poll.closesAt) > new Date() 
        ? Math.max(0, Math.floor((new Date(poll.closesAt).getTime() - Date.now()) / 1000 / 60))
        : 0,
    });
  } catch (error) {
    console.error('Error fetching poll stats:', error);
    return NextResponse.json({ error: 'Failed to fetch poll stats' }, { status: 500 });
  }
}
