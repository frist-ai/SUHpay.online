# Task: Fix Categories (#8-11), Banners (#13-14), Stock (#12)

## Changes Made

### Categories (#8-11)

**#8 - Page should scroll fully** (`categories-manager.tsx`)
- Changed `pb-20` to `pb-24` on the content area for full scroll padding

**#9 - Fix category card layout** (`sortable-category-tree.tsx`)
- Rewrote the SortableRow card layout:
  - Name on one line with truncate (no wrapping)
  - Mini stats on second line (product count, subcategory count, product preview link)
  - Breadcrumb path on third line if applicable
  - Action buttons properly aligned on the right
  - Removed product count Badge from inline with name (was causing overlap)
  - Used `flex items-center gap-2` instead of `flex items-start` for better vertical alignment
  - All badges use `shrink-0` to prevent wrapping
  - Product preview link moved into mini stats row instead of separate line

**#10 - Remove copy and add buttons** (`sortable-category-tree.tsx`)
- Removed `Copy` (duplicate) button from each category card's action buttons
- Removed `FolderPlus` (add subcategory) button from each category card's action buttons
- Removed `Copy` and `FolderPlus` from lucide-react imports
- Kept only: toggle active (Eye/EyeOff), edit (Edit), delete (Trash2)
- Removed `onDuplicate` and `onCreateCategory` from SortableRow props (still passed through tree for API compatibility)

**#11 - Move "Select all" / "Deselect" up** (`categories-manager.tsx`)
- Added "Выбрать все" and "Снять" buttons to the header area (near search bar and sort dropdown)
- Removed those same buttons from the bottom bulk actions bar
- "Снять" button is disabled when no items are selected

### Banners (#13-14)

**#13 - Page should scroll fully** (`banners-manager.tsx`)
- Content area already had `overflow-y-auto pb-24` - confirmed working

**#14 - Remove Statistics, Search, Bulk operations** (`banners-manager.tsx`)
- Removed 5 stat cards header section (Всего, Активных, Отключенных, По расписанию, Истёкших)
- Removed search bar
- Removed select all checkbox from list view
- Removed sticky bulk actions bar (with Включить/Отключить/Удалить buttons)
- Removed bulk delete confirmation dialog
- Removed Checkbox from each banner card
- Removed Checkbox import (no longer used)
- Removed unused imports: CheckSquare, XSquare, Layers
- Restored Play/Pause imports (still used in carousel autoplay)
- Kept: tabs (all/active/inactive), group filter, banner cards with actions, carousel view

### Stock & Finance (#12) (`stock-manager.tsx`)

**#12 - Remove edit quantity, show names, visualization**
- Removed all inline stock editing functionality (clicking on stock number, edit input, save/cancel)
- Removed quick action buttons (+1, +5, +10, zero)
- Removed bulk selection (checkbox, select all, bulk update bar)
- Removed bulk update state/handlers
- Added product image thumbnails to each row (8x8px with fallback)
- Made product names clearly visible with proper truncation
- Added product category name display below product name
- Added "Скрыт" badge for inactive products
- Added discount price indicator
- Added profit per item column with margin percentage
- Added "profit" sort option
- Color-coded profit values (green for positive, red for negative)
- Financial summary cards preserved (5 cards in 2 rows)
- Filter tabs and search bar preserved
- Export/Import section preserved

## Technical Notes
- All framer-motion spring types use `as const`
- TypeScript compiles without errors (0 errors)
- ESLint passes with 0 errors (2 pre-existing warnings in unrelated files)
- Dev server running successfully
