import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

/** Массовое обновление sortOrder (перетаскивание категорий среди соседей) */
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const updates: { id: string; sortOrder: number }[] = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Нужен массив updates: { id, sortOrder }[]' }, { status: 400 });
    }

    for (const u of updates) {
      if (!u?.id || typeof u.sortOrder !== 'number') {
        return NextResponse.json({ error: 'Каждый элемент updates должен содержать id и sortOrder' }, { status: 400 });
      }
    }

    await db.$transaction(
      updates.map((u) =>
        db.category.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category reorder error:', error);
    return NextResponse.json(
      { error: 'Не удалось сохранить порядок категорий' },
      { status: 500 }
    );
  }
}
