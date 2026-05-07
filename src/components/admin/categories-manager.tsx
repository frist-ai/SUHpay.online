'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Folder,
  Image as ImageIcon,
  Save,
  X,
  Eye,
  EyeOff,
  Package,
  AlertTriangle,
  CheckSquare,
  Square,
  ArrowUpDown,
  UnfoldVertical,
  FoldVertical,
  ChevronRight,
  MoveRight,
  RefreshCw,
} from 'lucide-react';
import { cn, pluralize } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { SortableCategoryTree } from '@/components/admin/sortable-category-tree';

interface Category {
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
  children?: Category[];
  _count?: { products: number };
}

type SortOption = 'sortOrder' | 'name' | 'productCount' | 'createdAt';

// Helper: generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-а-яё]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `category-${Date.now()}`;
}

export function CategoriesManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
    productCount: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'hidden'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // New state for enhancements
  const [sortOption, setSortOption] = useState<SortOption>('sortOrder');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string>('none');
  const [movingToParent, setMovingToParent] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories?includeInactive=true');
      const data = await res.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Split categories into active and hidden
  const activeCategories = useMemo(
    () => categories.filter(c => c.isActive),
    [categories]
  );
  const hiddenCategories = useMemo(
    () => categories.filter(c => !c.isActive),
    [categories]
  );

  // Stats
  const stats = useMemo(() => ({
    total: categories.length,
    active: activeCategories.length,
    hidden: hiddenCategories.length,
    totalProducts: categories.reduce((sum, c) => sum + (c._count?.products || 0), 0),
  }), [categories.length, activeCategories.length, hiddenCategories.length, categories]);

  // Parent names map
  const parentNames = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => {
      if (c.parentId) {
        const parent = categories.find(p => p.id === c.parentId);
        if (parent) map.set(c.id, parent.name);
      }
    });
    return map;
  }, [categories]);

  // Category paths map (breadcrumb: full path from root to category)
  const categoryPaths = useMemo(() => {
    const map = new Map<string, string[]>();
    const catMap = new Map(categories.map(c => [c.id, c]));

    const buildPath = (catId: string): string[] => {
      if (map.has(catId)) return map.get(catId)!;
      const cat = catMap.get(catId);
      if (!cat) return [];
      if (!cat.parentId) {
        const path = [cat.name];
        map.set(catId, path);
        return path;
      }
      const parentPath = buildPath(cat.parentId);
      const path = [...parentPath, cat.name];
      map.set(catId, path);
      return path;
    };

    categories.forEach(c => buildPath(c.id));
    return map;
  }, [categories]);

  // Collect all category IDs that have children (for expand/collapse all)
  const allParentIds = useMemo(() => {
    const ids = new Set<string>();
    const collect = (cats: Category[]) => {
      cats.forEach(c => {
        const children = categories.filter(ch => ch.parentId === c.id);
        if (children.length > 0) ids.add(c.id);
      });
    };
    collect(categories);
    return ids;
  }, [categories]);

  const allExpanded = useMemo(() => {
    if (allParentIds.size === 0) return true;
    let count = 0;
    allParentIds.forEach(id => {
      if (expandedCategories.has(id)) count++;
    });
    return count === allParentIds.size;
  }, [expandedCategories, allParentIds]);

  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(allParentIds));
  }, [allParentIds]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  // Sort categories based on sort option
  const sortCategories = useCallback((cats: Category[], option: SortOption): Category[] => {
    const sorted = [...cats];
    switch (option) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        break;
      case 'productCount':
        sorted.sort((a, b) => (b._count?.products || 0) - (a._count?.products || 0));
        break;
      case 'createdAt':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'sortOrder':
      default:
        sorted.sort((a, b) => a.sortOrder - b.sortOrder);
        break;
    }
    return sorted;
  }, []);

  const filteredActiveCategories = useMemo(
    () => sortCategories(activeCategories, sortOption),
    [activeCategories, sortCategories, sortOption]
  );
  const filteredHiddenCategories = useMemo(
    () => sortCategories(hiddenCategories, sortOption),
    [hiddenCategories, sortCategories, sortOption]
  );

  // Build tree structure
  const buildTree = useCallback((cats: Category[]): Category[] => {
    const catMap = new Map<string, Category>();
    const roots: Category[] = [];

    cats.forEach(cat => {
      catMap.set(cat.id, { ...cat, children: [] });
    });

    cats.forEach(cat => {
      const node = catMap.get(cat.id)!;
      if (cat.parentId && catMap.has(cat.parentId)) {
        const parent = catMap.get(cat.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort using the current sort option
    const sortByOption = (a: Category, b: Category) => {
      switch (sortOption) {
        case 'name': return a.name.localeCompare(b.name, 'ru');
        case 'productCount': return (b._count?.products || 0) - (a._count?.products || 0);
        case 'createdAt': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return a.sortOrder - b.sortOrder;
      }
    };

    const sortChildren = (nodes: Category[]) => {
      nodes.sort(sortByOption);
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(roots);
    return roots;
  }, [sortOption]);

  const activeTree = useMemo(
    () => buildTree(filteredActiveCategories),
    [filteredActiveCategories, buildTree]
  );
  const hiddenTree = useMemo(
    () => buildTree(filteredHiddenCategories),
    [filteredHiddenCategories, buildTree]
  );

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentCats = activeTab === 'active' ? filteredActiveCategories : filteredHiddenCategories;
    setSelectedIds(new Set(currentCats.map(c => c.id)));
  }, [activeTab, filteredActiveCategories, filteredHiddenCategories]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Quick action: toggle active
  const handleToggleActive = useCallback(async (category: Category) => {
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...category, isActive: !category.isActive }),
      });
      if (res.ok) {
        toast({
          title: category.isActive ? 'Категория скрыта' : 'Категория показана',
          description: category.name,
        });
        await fetchCategories();
      } else {
        throw new Error('Failed to toggle');
      }
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить статус категории',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories]);

  // Quick action: duplicate
  const handleDuplicate = useCallback(async (category: Category) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${category.name} (копия)`,
          slug: `${category.slug}-copy-${Date.now()}`,
          description: category.description,
          imageUrl: category.imageUrl,
          parentId: category.parentId,
          sortOrder: category.sortOrder + 1,
          isActive: category.isActive,
        }),
      });
      if (res.ok) {
        toast({
          title: 'Категория дублирована',
          description: `${category.name} (копия)`,
        });
        await fetchCategories();
      } else {
        throw new Error('Failed to duplicate');
      }
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось дублировать категорию',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories]);

  // Bulk operations
  const handleBulkToggleActive = useCallback(async (makeActive: boolean) => {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    try {
      for (const id of ids) {
        const cat = categories.find(c => c.id === id);
        if (cat && cat.isActive !== makeActive) {
          const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cat, isActive: makeActive }),
          });
          if (res.ok) successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: makeActive
            ? `${successCount} ${pluralize(successCount, 'категория', 'категории', 'категорий')} показана`
            : `${successCount} ${pluralize(successCount, 'категория', 'категории', 'категорий')} скрыта`,
        });
        setSelectedIds(new Set());
        await fetchCategories();
      }
    } catch {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  }, [selectedIds, categories, toast, fetchCategories]);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteOpen(true);
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: `Удалено: ${successCount} ${pluralize(successCount, 'категория', 'категории', 'категорий')}`,
      });
      setSelectedIds(new Set());
      await fetchCategories();
    }
    if (failCount > 0) {
      toast({
        title: 'Не удалось удалить некоторые категории',
        description: `${failCount} ${pluralize(failCount, 'категория', 'категории', 'категорий')} не удалены (есть подкатегории или товары)`,
        variant: 'destructive',
      });
    }

    setBulkDeleteOpen(false);
  }, [selectedIds, toast, fetchCategories]);

  // Batch move to parent
  const handleBulkMoveToParent = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setMovingToParent(true);
    const ids = Array.from(selectedIds);
    const newParentId = targetParentId === 'none' ? null : targetParentId;
    let successCount = 0;

    try {
      for (const id of ids) {
        // Don't move a category to itself or to its own descendant
        if (id === newParentId) continue;
        const cat = categories.find(c => c.id === id);
        if (cat) {
          const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cat, parentId: newParentId }),
          });
          if (res.ok) successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: `Перемещено: ${successCount} ${pluralize(successCount, 'категория', 'категории', 'категорий')}`,
          description: newParentId
            ? `В категорию "${categories.find(c => c.id === newParentId)?.name || newParentId}"`
            : 'В корень каталога',
        });
        setSelectedIds(new Set());
        setBulkMoveOpen(false);
        setTargetParentId('none');
        await fetchCategories();
      }
    } catch {
      toast({ title: 'Ошибка перемещения', variant: 'destructive' });
    } finally {
      setMovingToParent(false);
    }
  }, [selectedIds, targetParentId, categories, toast, fetchCategories]);

  // Edit dialog handlers
  const handleEditCategory = (category: Category) => {
    setEditingCategory({ ...category });
    setSlugManuallyEdited(true); // editing existing - slug is set
    setEditDialogOpen(true);
  };

  const handleCreateCategory = (parentId?: string) => {
    setEditingCategory({
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      parentId: parentId || null,
      sortOrder: 0,
      isActive: true,
    });
    setSlugManuallyEdited(false); // new category - auto-generate slug
    setEditDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    if (!editingCategory) return;
    const updated = { ...editingCategory, name };
    if (!slugManuallyEdited) {
      updated.slug = generateSlug(name);
    }
    setEditingCategory(updated);
  };

  const handleSlugChange = (slug: string) => {
    if (!editingCategory) return;
    setSlugManuallyEdited(true);
    setEditingCategory({ ...editingCategory, slug });
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    setSaving(true);
    try {
      const isCreating = !editingCategory.id;
      const url = isCreating
        ? '/api/categories'
        : `/api/categories/${editingCategory.id}`;

      const body = {
        ...editingCategory,
        slug: editingCategory.slug || generateSlug(editingCategory.name || ''),
      };

      const res = await fetch(url, {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: isCreating ? 'Категория создана' : 'Категория обновлена',
          description: editingCategory.name,
        });
        await fetchCategories();
        setEditDialogOpen(false);
        setEditingCategory(null);
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить категорию',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (categoryId: string, categoryName: string, hasChildren: boolean, productCount: number = 0) => {
    if (hasChildren) {
      toast({
        title: 'Нельзя удалить',
        description: 'Сначала удалите или переместите подкатегории',
        variant: 'destructive',
      });
      return;
    }
    setCategoryToDelete({ id: categoryId, name: categoryName, productCount });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Категория удалена' });
        await fetchCategories();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить категорию. Возможно, есть связанные товары.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  // Get parent categories for select (exclude self and descendants)
  const getParentCategories = (excludeId?: string): Category[] => {
    // Collect descendants of excludeId
    const descendants = new Set<string>();
    if (excludeId) {
      const collectDescendants = (id: string) => {
        descendants.add(id);
        categories.filter(c => c.parentId === id).forEach(c => collectDescendants(c.id));
      };
      collectDescendants(excludeId);
    }
    return categories.filter(c => !descendants.has(c.id));
  };

  // Get breadcrumb path for editing category
  const editingCategoryPath = useMemo(() => {
    if (!editingCategory?.id) return null;
    return categoryPaths.get(editingCategory.id) || null;
  }, [editingCategory?.id, categoryPaths]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header skeleton */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="shrink-0 border-b px-4">
          <Skeleton className="h-10 w-full mt-3 rounded-lg" />
        </div>
        {/* Sort + action bar skeleton */}
        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
        </div>
        {/* Category card skeletons */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-14">
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <div className="flex-1" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sort option labels
  const sortLabels: Record<SortOption, string> = {
    sortOrder: 'Порядок',
    name: 'По имени',
    productCount: 'По товарам',
    createdAt: 'По дате',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Управление категориями</h1>
            <p className="text-xs text-muted-foreground">
              {stats.active} активных • {stats.hidden} скрытых
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={allExpanded ? collapseAll : expandAll}
            title={allExpanded ? 'Свернуть все' : 'Развернуть все'}
          >
            {allExpanded ? (
              <FoldVertical className="h-4 w-4" />
            ) : (
              <UnfoldVertical className="h-4 w-4" />
            )}
          </Button>
          <Button size="sm" onClick={() => handleCreateCategory()}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b px-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'hidden')}>
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Активные ({activeCategories.length})
            </TabsTrigger>
            <TabsTrigger value="hidden" className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              Скрытые ({hiddenCategories.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sort Options + Selection Buttons */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">{sortLabels[sortOption]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOption('sortOrder')}>
                <span className={cn(sortOption === 'sortOrder' && 'font-bold')}>Порядок</span>
                {sortOption === 'sortOrder' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('name')}>
                <span className={cn(sortOption === 'name' && 'font-bold')}>По имени</span>
                {sortOption === 'name' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('productCount')}>
                <span className={cn(sortOption === 'productCount' && 'font-bold')}>По кол-ву товаров</span>
                {sortOption === 'productCount' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('createdAt')}>
                <span className={cn(sortOption === 'createdAt' && 'font-bold')}>По дате создания</span>
                {sortOption === 'createdAt' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={handleSelectAll}
            >
              Выбрать все
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={handleDeselectAll}
              disabled={selectedIds.size === 0}
            >
              Снять
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3">
          {/* Active Tab */}
          {activeTab === 'active' && (
            activeTree.length === 0 ? (
              <EnhancedEmptyCategoryState
                type="active"
                onCreateCategory={() => handleCreateCategory()}
              />
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Перетащите категорию за иконку ⋮⋮, чтобы изменить порядок.
                </p>
                <SortableCategoryTree
                  tree={activeTree}
                  flatPool={filteredActiveCategories}
                  expandedCategories={expandedCategories}
                  toggleExpand={toggleExpand}
                  isHiddenView={false}
                  onEditCategory={handleEditCategory}
                  onCreateCategory={handleCreateCategory}
                  onDeleteClick={handleDeleteClick}
                  onReordered={fetchCategories}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleActive={handleToggleActive}
                  onDuplicate={handleDuplicate}
                  parentNames={parentNames}
                  searchQuery=""
                  categoryPaths={categoryPaths}
                />
              </div>
            )
          )}

          {/* Hidden Tab */}
          {activeTab === 'hidden' && (
            hiddenTree.length === 0 ? (
              <EnhancedEmptyCategoryState type="hidden" />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-4">
                  Скрытые категории не видны покупателям. Нажмите 👁 чтобы показать.
                </p>
                <SortableCategoryTree
                  tree={hiddenTree}
                  flatPool={filteredHiddenCategories}
                  expandedCategories={expandedCategories}
                  toggleExpand={toggleExpand}
                  isHiddenView
                  onEditCategory={handleEditCategory}
                  onCreateCategory={handleCreateCategory}
                  onDeleteClick={handleDeleteClick}
                  onReordered={fetchCategories}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleActive={handleToggleActive}
                  onDuplicate={handleDuplicate}
                  parentNames={parentNames}
                  searchQuery=""
                  categoryPaths={categoryPaths}
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <CheckSquare className="h-3 w-3" />
              {selectedIds.size} {pluralize(selectedIds.size, 'выбрана', 'выбрано', 'выбрано')}
            </Badge>

            <div className="flex items-center gap-1 ml-auto">
              {/* Batch move to parent */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setBulkMoveOpen(true)}
              >
                <MoveRight className="h-3 w-3" />
                Переместить
              </Button>
              {activeTab === 'hidden' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleBulkToggleActive(true)}
                >
                  <Eye className="h-3 w-3" />
                  Показать
                </Button>
              )}
              {activeTab === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleBulkToggleActive(false)}
                >
                  <EyeOff className="h-3 w-3" />
                  Скрыть
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive border-destructive/30"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3 w-3" />
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory?.id ? 'Редактировать категорию' : 'Новая категория'}
            </DialogTitle>
          </DialogHeader>

          {editingCategory && (
            <div className="space-y-4">
              {/* Breadcrumb path in edit dialog */}
              {editingCategoryPath && editingCategoryPath.length > 1 && (
                <div className="p-2 rounded-lg bg-muted/50 border">
                  <Breadcrumb>
                    <BreadcrumbList className="text-xs">
                      {editingCategoryPath.map((segment, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <BreadcrumbSeparator />}
                          <BreadcrumbItem>
                            {i === editingCategoryPath.length - 1 ? (
                              <BreadcrumbPage className="text-xs font-medium">{segment}</BreadcrumbPage>
                            ) : (
                              <span className="text-muted-foreground">{segment}</span>
                            )}
                          </BreadcrumbItem>
                        </span>
                      ))}
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
              )}

              {/* Image Preview */}
              {editingCategory.imageUrl && (
                <div className="w-full h-32 rounded-xl overflow-hidden bg-muted">
                  <img
                    src={editingCategory.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={editingCategory.name || ''}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  {!slugManuallyEdited && editingCategory.name && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Авто-генерация
                    </span>
                  )}
                </div>
                <Input
                  id="slug"
                  value={editingCategory.slug || ''}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="auto-generated-if-empty"
                  className={cn(!slugManuallyEdited && editingCategory.name && 'border-dashed')}
                />
                {!slugManuallyEdited && editingCategory.name && editingCategory.slug && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Предпросмотр: <span className="font-mono text-primary/80">/{editingCategory.slug}</span>
                  </p>
                )}
                {slugManuallyEdited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] mt-1 p-0"
                    onClick={() => {
                      setSlugManuallyEdited(false);
                      setEditingCategory({
                        ...editingCategory,
                        slug: generateSlug(editingCategory.name || ''),
                      });
                    }}
                  >
                    <RefreshCw className="h-2.5 w-2.5 mr-1" />
                    Сбросить к авто
                  </Button>
                )}
              </div>

              <div>
                <Label htmlFor="imageUrl">URL изображения</Label>
                <Input
                  id="imageUrl"
                  value={editingCategory.imageUrl || ''}
                  onChange={(e) => setEditingCategory({
                    ...editingCategory,
                    imageUrl: e.target.value
                  })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="parentId">Родительская категория</Label>
                <Select
                  value={editingCategory.parentId || 'none'}
                  onValueChange={(value) => setEditingCategory({
                    ...editingCategory,
                    parentId: value === 'none' ? null : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Без родителя (корневая)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без родителя (корневая)</SelectItem>
                    {getParentCategories(editingCategory.id).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {categoryPaths.get(cat.id)?.join(' → ') || cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sortOrder">Порядок сортировки</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={editingCategory.sortOrder || 0}
                  onChange={(e) => setEditingCategory({
                    ...editingCategory,
                    sortOrder: parseInt(e.target.value) || 0
                  })}
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({
                    ...editingCategory,
                    description: e.target.value
                  })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCategory.isActive ?? true}
                  onCheckedChange={(checked) => setEditingCategory({
                    ...editingCategory,
                    isActive: checked
                  })}
                />
                <Label className="flex items-center gap-2">
                  {editingCategory.isActive ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-orange-600" />
                  )}
                  Активна (показывать в каталоге)
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Удалить категорию?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Вы уверены, что хотите удалить категорию &laquo;{categoryToDelete?.name}&raquo;?
                  Это действие нельзя отменить.
                </p>
                {categoryToDelete && categoryToDelete.productCount > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          В этой категории {categoryToDelete.productCount}{' '}
                          {pluralize(categoryToDelete.productCount, 'товар', 'товара', 'товаров')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Сначала удалите или переместите товары в другую категорию.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Удалить выбранные категории?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Вы уверены, что хотите удалить {selectedIds.size}{' '}
                  {pluralize(selectedIds.size, 'категорию', 'категории', 'категорий')}?
                  Это действие нельзя отменить.
                </p>
                <div className="mt-3 p-3 rounded-lg bg-muted border">
                  <p className="text-xs text-muted-foreground">
                    Категории с подкатегориями или товарами не будут удалены.
                    Сначала удалите или переместите их.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить {selectedIds.size} {pluralize(selectedIds.size, 'категорию', 'категории', 'категорий')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Move to Parent Dialog */}
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              Переместить категории
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Переместить {selectedIds.size}{' '}
              {pluralize(selectedIds.size, 'категорию', 'категории', 'категорий')} в другую родительскую категорию.
            </p>
            <div>
              <Label>Новая родительская категория</Label>
              <Select
                value={targetParentId}
                onValueChange={setTargetParentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">
                    <span className="font-medium">Корень каталога (без родителя)</span>
                  </SelectItem>
                  {getParentCategories().filter(c => !selectedIds.has(c.id)).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {categoryPaths.get(cat.id)?.join(' → ') || cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetParentId !== 'none' && (
              <div className="p-2 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
                Категории будут перемещены в &laquo;{categories.find(c => c.id === targetParentId)?.name || targetParentId}&raquo;
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleBulkMoveToParent} disabled={movingToParent}>
              {movingToParent ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              ) : (
                <MoveRight className="h-4 w-4 mr-2" />
              )}
              Переместить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Enhanced empty state for no active/hidden categories with illustration
function EnhancedEmptyCategoryState({
  type,
  onCreateCategory,
}: {
  type: 'active' | 'hidden';
  onCreateCategory?: () => void;
}) {
  return (
    <div className="text-center py-12">
      {/* SVG Illustration */}
      <div className="relative mx-auto w-32 h-32 mb-6">
        <svg viewBox="0 0 128 128" fill="none" className="w-full h-full">
          {type === 'active' ? (
            <>
              {/* Folder illustration */}
              <rect x="16" y="40" width="96" height="72" rx="8" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
              <path d="M16 48V36C16 31.6 19.6 28 24 28H48L56 40H112C116.4 40 120 43.6 120 48V48" className="fill-primary/20 stroke-primary/40" strokeWidth="2" />
              {/* Plus icon */}
              <circle cx="96" cy="88" r="20" className="fill-primary/20 stroke-primary/50" strokeWidth="2" />
              <path d="M96 78V98M86 88H106" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
              {/* Sparkles */}
              <circle cx="28" cy="24" r="3" className="fill-primary/40" />
              <circle cx="44" cy="16" r="2" className="fill-primary/30" />
              <circle cx="110" cy="32" r="2.5" className="fill-primary/35" />
            </>
          ) : (
            <>
              {/* Hidden eye illustration */}
              <ellipse cx="64" cy="64" rx="40" ry="24" className="fill-orange-500/10 stroke-orange-500/30" strokeWidth="2" />
              <circle cx="64" cy="64" r="12" className="fill-orange-500/15 stroke-orange-500/40" strokeWidth="2" />
              <circle cx="64" cy="64" r="5" className="fill-orange-500/30" />
              {/* Crossed line */}
              <line x1="24" y1="104" x2="104" y2="24" className="stroke-orange-500/50" strokeWidth="3" strokeLinecap="round" />
              {/* Zzz */}
              <text x="88" y="36" className="fill-orange-500/50" fontSize="14" fontWeight="bold">z</text>
              <text x="98" y="28" className="fill-orange-500/35" fontSize="11" fontWeight="bold">z</text>
              <text x="106" y="22" className="fill-orange-500/20" fontSize="9" fontWeight="bold">z</text>
            </>
          )}
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-1">
        {type === 'active' ? 'Нет активных категорий' : 'Нет скрытых категорий'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
        {type === 'active'
          ? 'Создайте первую категорию для вашего каталога товаров'
          : 'Все ваши категории видимы покупателям в каталоге'}
      </p>
      {type === 'active' && onCreateCategory && (
        <Button onClick={onCreateCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Создать категорию
        </Button>
      )}
    </div>
  );
}


