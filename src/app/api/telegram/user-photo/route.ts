import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telegram/user-photo?user_id=xxx
 * 
 * Get user's profile photo from Telegram API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  if (!env.telegramBotToken) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
  }

  try {
    // Get user profile photos from Telegram API
    const response = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/getUserProfilePhotos?user_id=${userId}&limit=1`
    );

    const data = await response.json();

    if (!data.ok || !data.result?.photos?.length) {
      return NextResponse.json({ 
        hasPhoto: false,
        photoUrl: null 
      });
    }

    // Get the largest photo from the first set
    const photos = data.result.photos[0];
    const largestPhoto = photos.reduce((a: { file_size?: number }, b: { file_size?: number }) => 
      (a.file_size || 0) > (b.file_size || 0) ? a : b
    );

    // Get file path
    const filePathResponse = await fetch(
      `https://api.telegram.org/bot${env.telegramBotToken}/getFile?file_id=${largestPhoto.file_id}`
    );
    const filePathData = await filePathResponse.json();

    if (!filePathData.ok) {
      return NextResponse.json({ 
        hasPhoto: false,
        photoUrl: null 
      });
    }

    // Construct photo URL
    const photoUrl = `https://api.telegram.org/file/bot${env.telegramBotToken}/${filePathData.result.file_path}`;

    return NextResponse.json({ 
      hasPhoto: true,
      photoUrl 
    });

  } catch (error) {
    console.error('Error getting user photo:', error);
    return NextResponse.json({ 
      hasPhoto: false,
      photoUrl: null 
    });
  }
}
