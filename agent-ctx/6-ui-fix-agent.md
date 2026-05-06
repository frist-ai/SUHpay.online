# Task 6 - UI Fix Agent

## Task
Fix Orders (#15-17,26), Chat (#22-23), Settings (#24-25), Delivery (#21), Payment (#20), Customers (#18), Product Requests (#19)

## Changes Summary

### orders-manager.tsx
- Replaced ScrollArea with native overflow-y-auto div
- Added max-h-[70vh] overflow-y-auto to expanded order detail
- Fixed archive tab: changed isExpanded={false}/onToggle={() => {}} to use expandedOrderId state
- Added pb-24 padding for bottom nav clearance

### chat-manager.tsx
- Changed mb-14 to pb-20 on input form for nav bar clearance
- Added Dialog imports and customerProfileOpen state
- Made customer name in chat header clickable (opens profile dialog)
- Added customer profile Dialog showing name, avatar, Telegram ID, status, phone

### settings-view.tsx
- Added max-w-full overflow-hidden flex-wrap to bulk actions container
- Moved quick actions (Refresh config, Clear cache, Export) to System tab only

### delivery-manager.tsx
- Removed bottom "Save settings" button
- Changed courier/pickup expansion condition to not require enabled state

### payment-manager.tsx
- Changed all card expansion conditions from enabled&&expanded to just expanded

### customers-manager.tsx
- Replaced Card layout with simple div row list
- Removed sort selector and DropdownMenu
- Simplified sort to always sort by date

### product-requests-manager.tsx
- Status badge → colored dot with tooltip
- Priority badge → star icon only
- Action buttons → icon-only button elements

## Verification
- TypeScript: 0 errors in modified files
- ESLint: 0 errors in modified files
