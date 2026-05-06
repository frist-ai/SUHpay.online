import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDatabaseConfigured } from '@/lib/db-utils';

export const dynamic = 'force-dynamic';

// GET /api/search/suggestions - Get popular searches and categories
export async function GET() {
  try {
    const suggestions = {
      popular: [] as string[],
      categories: [] as { id: string; name: string; count: number }[],
    };

    if (!isDatabaseConfigured()) {
      // Default suggestions for demo mode (grocery store)
      suggestions.popular = ['Лапша', 'Чипсы', 'Напитки', 'Снеки', 'Шоколад'];
      return NextResponse.json(suggestions);
    }

    // Get popular categories with product count
    const categories = await db.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 8,
    });

    suggestions.categories = categories
      .filter(c => c._count.products > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        count: c._count.products,
      }));

    // Get popular products (by name) for search suggestions
    // Using reviewCount and rating as proxies for popularity
    const popularProducts = await db.product.findMany({
      where: { isActive: true },
      orderBy: [
        { reviewCount: 'desc' },
        { rating: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 20,
      select: { name: true },
    });

    // Extract keywords from product names
    const keywords = new Set<string>();
    popularProducts.forEach(p => {
      const words = p.name.split(/\s+/);
      words.forEach(word => {
        // Only keep meaningful words (3+ chars, not numbers)
        if (word.length >= 3 && !/^\d+$/.test(word)) {
          keywords.add(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
        }
      });
    });

    suggestions.popular = Array.from(keywords).slice(0, 8);

    // If not enough keywords, add short category names only (1-2 words so they can match search)
    if (suggestions.popular.length < 5) {
      categories.slice(0, 5).forEach(c => {
        const words = c.name.split(/\s+/);
        // Only include short category names that are likely to match product search terms
        if (words.length <= 2 && !suggestions.popular.includes(c.name)) {
          suggestions.popular.push(c.name);
        }
      });
    }

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    return NextResponse.json({
      popular: ['Лапша', 'Чипсы', 'Напитки', 'Снеки', 'Шоколад'],
      categories: [],
    });
  }
}
