import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUser } from '@/lib/auth-helpers';

// GET /api/products/[id]/reviews — fetch reviews for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reviews = await db.review.findMany({
      where: {
        productId: id,
        isActive: true,
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate average rating from all active reviews (including those just created)
    const allReviews = await db.review.findMany({
      where: { productId: id, isActive: true },
      select: { rating: true },
    });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    return NextResponse.json({
      reviews: reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: {
          firstName: r.User?.firstName,
          lastName: r.User?.lastName,
        },
      })),
      average: Math.round(avgRating * 10) / 10,
      total: allReviews.length,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить отзывы' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/reviews — create a new review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Пользователь не авторизован' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { rating, comment } = body;
    const userId = authedUser.id;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Рейтинг должен быть от 1 до 5' },
        { status: 400 }
      );
    }

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json(
        { error: 'Комментарий не может быть пустым' },
        { status: 400 }
      );
    }

    // Create the review
    const review = await db.review.create({
      data: {
        userId,
        productId: id,
        rating,
        comment: comment.trim().slice(0, 500),
      },
      include: {
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Recalculate average rating and update product
    const allReviews = await db.review.findMany({
      where: { productId: id, isActive: true },
      select: { rating: true },
    });
    const newAverage =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await db.product.update({
      where: { id },
      data: {
        rating: Math.round(newAverage * 10) / 10,
        reviewCount: allReviews.length,
      },
    });

    return NextResponse.json(
      {
        review: {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          user: {
            firstName: (review as any).User?.firstName,
            lastName: (review as any).User?.lastName,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Не удалось создать отзыв' },
      { status: 500 }
    );
  }
}
