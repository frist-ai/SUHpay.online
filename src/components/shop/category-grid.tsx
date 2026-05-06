'use client';

import { Category } from '@/stores/shop-store';
import { Card, CardContent } from '@/components/ui/card';
import { cn, pluralize } from '@/lib/utils';
import { Folder } from 'lucide-react';

interface CategoryGridProps {
  categories: (Category & { _count?: { products: number } })[];
  onSelectCategory: (categoryId: string) => void;
  selectedCategoryId?: string | null;
}

export function CategoryGrid({
  categories,
  onSelectCategory,
  selectedCategoryId,
}: CategoryGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {categories.map((category) => (
        <Card
          key={category.id}
          className={cn(
            'cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden',
            selectedCategoryId === category.id
              ? 'ring-2 ring-primary bg-primary/5'
              : 'bg-card'
          )}
          onClick={() => onSelectCategory(category.id)}
        >
          <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              {category.imageUrl ? (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <Folder className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              )}
            </div>
            <span className="text-xs sm:text-sm font-medium line-clamp-2">
              {category.name}
            </span>

          </CardContent>
        </Card>
      ))}
    </div>
  );
}
