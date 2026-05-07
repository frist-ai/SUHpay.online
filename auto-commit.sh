#!/bin/bash
cd /home/z/my-project

# Check if there are uncommitted changes
if git diff --quiet && git diff --cached --quiet; then
  UNTRACKED=$(git ls-files --others --exclude-standard)
  if [ -z "$UNTRACKED" ]; then
    exit 0
  fi
fi

# Wait a moment to avoid committing mid-write
sleep 5

# Re-check after sleep — if changes disappeared, a save is in progress
if git diff --quiet && git diff --cached --quiet; then
  UNTRACKED=$(git ls-files --others --exclude-standard)
  if [ -z "$UNTRACKED" ]; then
    exit 0
  fi
fi

# Stage all changes
git add -A

# Generate commit message from changed files and diff
CHANGED_FILES=$(git diff --cached --name-only)

ADDED=$(echo "$CHANGED_FILES" | wc -l)
DIFF_CONTENT=$(git diff --cached 2>/dev/null | head -300)

# Build message based on what changed
PARTS=()

if echo "$CHANGED_FILES" | grep -q "prisma/schema"; then
  PARTS+=("DB schema update")
fi
if echo "$CHANGED_FILES" | grep -q "api/"; then
  # Extract specific API endpoints
  API_ENDPOINTS=$(echo "$CHANGED_FILES" | grep "api/" | grep -oP 'api/[^/]+' | sort -u | sed 's/api\///' | tr '\n' ', ' | sed 's/,$//')
  if [ -n "$API_ENDPOINTS" ]; then
    PARTS+=("API: $API_ENDPOINTS")
  else
    PARTS+=("API changes")
  fi
fi
if echo "$CHANGED_FILES" | grep -q "components/ui/"; then
  PARTS+=("UI components")
fi
if echo "$CHANGED_FILES" | grep -q "components/shop/"; then
  PARTS+=("shop components")
fi
if echo "$CHANGED_FILES" | grep -q "\.css"; then
  PARTS+=("styles")
fi
if echo "$CHANGED_FILES" | grep -q "page\.tsx"; then
  PARTS+=("page updates")
fi
if echo "$CHANGED_FILES" | grep -q "layout\.tsx"; then
  PARTS+=("layout")
fi
if echo "$CHANGED_FILES" | grep -q "lib/"; then
  PARTS+=("lib utilities")
fi
if echo "$CHANGED_FILES" | grep -q "stores/"; then
  PARTS+=("Zustand store")
fi
if echo "$CHANGED_FILES" | grep -q "hooks/"; then
  PARTS+=("hooks")
fi
if echo "$CHANGED_FILES" | grep -q "mini-services/"; then
  PARTS+=("mini-services")
fi
if echo "$CHANGED_FILES" | grep -q "package\.json"; then
  PARTS+=("dependencies")
fi

# If no specific patterns matched, describe by directory
if [ ${#PARTS[@]} -eq 0 ]; then
  DIRS=$(echo "$CHANGED_FILES" | grep -oP 'src/[^/]+' | sort -u | tr '\n' ', ' | sed 's/,$//')
  if [ -n "$DIRS" ]; then
    PARTS+=("$DIRS")
  fi
fi

# Analyze diff content for type
if echo "$DIFF_CONTENT" | grep -qi "fix\|bug\|error\|issue\|crash"; then
  TYPE="fix"
elif echo "$DIFF_CONTENT" | grep -qi "feat\|add\|new\|create\|implement"; then
  TYPE="feat"
elif echo "$DIFF_CONTENT" | grep -qi "refactor\|clean\|optimize\|improve\|simplify"; then
  TYPE="refactor"
elif echo "$DIFF_CONTENT" | grep -qi "style\|color\|padding\|margin\|font\|align\|responsive\|dark\|theme"; then
  TYPE="style"
elif echo "$DIFF_CONTENT" | grep -qi "move\|rename\|reorganize"; then
  TYPE="chore"
else
  TYPE="update"
fi

# Build final message
if [ ${#PARTS[@]} -gt 0 ]; then
  DESC=$(IFS=', '; echo "${PARTS[*]}")
  MSG="$TYPE: $DESC"
else
  MSG="$TYPE: $ADDED file(s) changed"
fi

# Add file count if more than 3
if [ "$ADDED" -gt 3 ]; then
  MSG="$MSG ($ADDED files)"
fi

# Truncate if too long (max 72 chars)
if [ ${#MSG} -gt 72 ]; then
  MSG="${MSG:0:69}..."
fi

echo "[$(date '+%H:%M:%S')] Committing: $MSG"

git commit -m "$MSG"

# Push immediately after commit
git push 2>/dev/null

echo "[$(date '+%H:%M:%S')] Pushed ✓"
