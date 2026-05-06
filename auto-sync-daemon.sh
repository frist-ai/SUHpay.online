#!/bin/bash

# Auto-sync daemon - monitors project and pushes + syncs branches
# Vercel deploys from master, so we always keep master = main
# Uses bare git operations to avoid checkout conflicts

PROJECT_DIR="/home/z/my-project"
INTERVAL=300  # 5 minutes

echo "🔄 Auto-sync daemon started..."
echo "📁 Project directory: $PROJECT_DIR"
echo "⏱️  Sync interval: ${INTERVAL}s"
echo "🌿 Branches: main + master (Vercel deploys from master)"

cd "$PROJECT_DIR" || exit 1

while true; do
    # Fetch latest from remote
    git fetch origin main master 2>/dev/null

    MAIN_SHA=$(git rev-parse origin/main)
    MASTER_SHA=$(git rev-parse origin/master)

    # Check for uncommitted changes
    HAS_CHANGES=false
    if ! git diff --quiet 2>/dev/null || ! git diff --staged --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
        HAS_CHANGES=true
    fi

    if [ "$HAS_CHANGES" = true ]; then
        echo "📝 Changes detected at $(date '+%Y-%m-%d %H:%M:%S')..."
        
        # Add sync-daemon.log to gitignore to avoid loop
        echo "sync-daemon.log" >> .gitignore 2>/dev/null
        git add -A
        git reset HEAD sync-daemon.log 2>/dev/null
        
        if ! git diff --staged --quiet; then
            COMMIT_MSG="Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"
            git commit -m "$COMMIT_MSG" --author="frist-ai <frist-ai@users.noreply.github.com>" 2>/dev/null
            
            echo "📤 Pushing to main..."
            git push origin main 2>&1
            
            # Update MAIN_SHA after push
            MAIN_SHA=$(git rev-parse origin/main)
        fi
    fi

    # Sync branches using push --force-with-lease from local main ref
    if [ "$MAIN_SHA" != "$MASTER_SHA" ]; then
        echo "🔄 Branches out of sync (main=$MAIN_SHA master=$MASTER_SHA) — syncing..."
        
        # Use git push to update master directly from main ref (no checkout needed)
        git push origin origin/main:refs/heads/master 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ Branches synced at $(date '+%Y-%m-%d %H:%M:%S')"
        else
            # Fallback: use checkout approach
            echo "⚠️  Direct push failed, trying checkout approach..."
            git stash 2>/dev/null
            git checkout master 2>/dev/null
            git merge main --no-edit 2>/dev/null
            git push origin master 2>&1
            git checkout main 2>/dev/null
            git stash pop 2>/dev/null
        fi
    fi
    
    sleep $INTERVAL
done
