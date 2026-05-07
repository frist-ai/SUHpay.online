'use client';

import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Edit,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  Image as ImageIcon,
  GripVertical,
  EyeOff,
  Eye,
} from 'lucide-react';
import { cn, pluralize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface SortableCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: SortableCategory[];
  _count?: { products: number };
}



// Depth level colors for left border indicator
const DEPTH_COLORS = [
  'border-l-emerald-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
] as const;

const DEPTH_BG_ACCENTS = [
  'bg-emerald-500/5',
  'bg-sky-500/5',
  'bg-violet-500/5',
  'bg-amber-500/5',
  'bg-rose-500/5',
] as const;

interface SortableCategoryTreeProps {
  tree: SortableCategory[];
  flatPool: SortableCategory[];
  expandedCategories: Set<string>;
  toggleExpand: (categoryId: string) => void;
  isHiddenView: boolean;
  onEditCategory: (category: SortableCategory) => void;
  onCreateCategory: (parentId?: string) => void;
  onDeleteClick: (categoryId: string, categoryName: string, hasChildren: boolean, productCount: number) => void;
  onReordered: () => Promise<void>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleActive: (category: SortableCategory) => void;
  onDuplicate: (category: SortableCategory) => void;
  parentNames: Map<string, string>;
  searchQuery: string;
  categoryPaths: Map<string, string[]>;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}



function SortableRow({
  category,
  level,
  isHiddenView,
  expandedCategories,
  toggleExpand,
  onEditCategory,
  onDeleteClick,
  selectedIds,
  onToggleSelect,
  onToggleActive,
  parentNames,
  searchQuery,
  categoryPaths,
}: {
  category: SortableCategory;
  level: number;
  isHiddenView: boolean;
  expandedCategories: Set<string>;
  toggleExpand: (categoryId: string) => void;
  onEditCategory: (category: SortableCategory) => void;
  onDeleteClick: (categoryId: string, categoryName: string, hasChildren: boolean, productCount: number) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleActive: (category: SortableCategory) => void;
  parentNames: Map<string, string>;
  searchQuery: string;
  categoryPaths: Map<string, string[]>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedCategories.has(category.id);
  const productCount = category._count?.products || 0;
  const childrenCount = category.children?.length || 0;
  const parentName = parentNames.get(category.id);
  const isSelected = selectedIds.has(category.id);
  const depthColorIndex = Math.min(level, DEPTH_COLORS.length - 1);
  const breadcrumbPath = categoryPaths.get(category.id);

  const childIds = category.children?.map((c) => c.id) ?? [];

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'z-10')}>
      <Card
        className={cn(
          'mb-2 transition-colors border-l-[3px]',
          DEPTH_COLORS[depthColorIndex],
          level > 0 && DEPTH_BG_ACCENTS[depthColorIndex],
          isHiddenView && 'border-l-orange-500',
          isSelected && 'ring-2 ring-primary/30 bg-primary/5'
        )}
        style={level > 0 ? { marginLeft: `${level * 16}px` } : undefined}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {/* Checkbox */}
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(category.id)}
                aria-label={`Выбрать ${category.name}`}
              />
            </div>

            {/* Drag handle */}
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="touch-none p-1 rounded-md hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
              aria-label="Перетащить для смены порядка"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Expand/collapse + folder icon */}
            <button
              type="button"
              onClick={() => hasChildren && toggleExpand(category.id)}
              className={cn(
                'p-1 rounded transition-colors flex items-center gap-1 shrink-0',
                hasChildren ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
              )}
              disabled={!hasChildren}
            >
              {hasChildren ? (
                <>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isExpanded && 'rotate-90'
                    )}
                  />
                  {isExpanded ? (
                    <FolderOpen className="h-5 w-5 text-primary" />
                  ) : (
                    <Folder className="h-5 w-5 text-primary" />
                  )}
                </>
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground/50 ml-5" />
              )}
            </button>

            {/* Image thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border/50">
              {category.imageUrl ? (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Name and info - flex-1 with proper layout */}
            <div className="flex-1 min-w-0">
              {/* Line 1: Name (truncate) + badges */}
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-medium text-sm truncate">
                  <HighlightedText text={category.name} query={searchQuery} />
                </h3>
                {!category.isActive && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                    Скрыта
                  </Badge>
                )}
                {level > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono shrink-0">
                    L{level}
                  </Badge>
                )}
              </div>

              {/* Line 2: Mini stats */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                {parentName && !breadcrumbPath && (
                  <>
                    <span className="text-primary/70 truncate">↳ {parentName}</span>
                    <span className="shrink-0">•</span>
                  </>
                )}
                <span className="whitespace-nowrap">
                  {productCount} {pluralize(productCount, 'товар', 'товара', 'товаров')}
                </span>
                {childrenCount > 0 && (
                  <>
                    <span className="shrink-0">•</span>
                    <span className="text-primary font-medium whitespace-nowrap">{childrenCount} подк.</span>
                  </>
                )}

              </div>

              {/* Breadcrumb path */}
              {breadcrumbPath && breadcrumbPath.length > 1 && (
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                  {breadcrumbPath.map((segment, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                      <span className={i === breadcrumbPath.length - 1 ? 'font-medium text-muted-foreground' : ''}>
                        {segment}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons - only edit, toggle active, delete */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7"
                onClick={() => onToggleActive(category)}
                title={category.isActive ? 'Скрыть' : 'Показать'}
              >
                {category.isActive ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7"
                onClick={() => onEditCategory(category)}
                title="Редактировать"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() =>
                  onDeleteClick(category.id, category.name, !!hasChildren, productCount)
                }
                disabled={hasChildren}
                title="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChildren && isExpanded && (
        <div className="ml-0">
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            {category.children!.map((child) => (
              <SortableRow
                key={child.id}
                category={child}
                level={level + 1}
                isHiddenView={isHiddenView}
                expandedCategories={expandedCategories}
                toggleExpand={toggleExpand}
                onEditCategory={onEditCategory}
                onDeleteClick={onDeleteClick}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onToggleActive={onToggleActive}
                parentNames={parentNames}
                searchQuery={searchQuery}
                categoryPaths={categoryPaths}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export function SortableCategoryTree({
  tree,
  flatPool,
  expandedCategories,
  toggleExpand,
  isHiddenView,
  onEditCategory,
  onCreateCategory,
  onDeleteClick,
  onReordered,
  selectedIds,
  onToggleSelect,
  onToggleActive,
  onDuplicate,
  parentNames,
  searchQuery,
  categoryPaths,
}: SortableCategoryTreeProps) {
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rootIds = useMemo(() => tree.map((c) => c.id), [tree]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCat = flatPool.find((c) => c.id === activeId);
    const overCat = flatPool.find((c) => c.id === overId);
    if (!activeCat || !overCat) return;

    const parentKey = (activeCat.parentId ?? null) as string | null;
    if ((overCat.parentId ?? null) !== parentKey) return;

    const siblings = flatPool
      .filter((c) => (c.parentId ?? null) === parentKey)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const oldIndex = siblings.findIndex((c) => c.id === activeId);
    const newIndex = siblings.findIndex((c) => c.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(siblings, oldIndex, newIndex);
    const updates = newOrder.map((c, i) => ({ id: c.id, sortOrder: i }));

    try {
      const res = await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        throw new Error('reorder failed');
      }
      await onReordered();
      toast({ title: 'Порядок сохранён' });
    } catch {
      toast({
        title: 'Не удалось сохранить порядок',
        variant: 'destructive',
      });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        {tree.map((category) => (
          <SortableRow
            key={category.id}
            category={category}
            level={0}
            isHiddenView={isHiddenView}
            expandedCategories={expandedCategories}
            toggleExpand={toggleExpand}
            onEditCategory={onEditCategory}
            onDeleteClick={onDeleteClick}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleActive={onToggleActive}
            parentNames={parentNames}
            searchQuery={searchQuery}
            categoryPaths={categoryPaths}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
