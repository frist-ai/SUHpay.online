#!/bin/bash

# Auto-push script for Suhpay project
# Usage: ./auto-push.sh "commit message"
# Vercel deploys from master, so we always sync main → master

COMMIT_MSG="${1:-"Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"}"

echo "🚀 Auto-push started..."
echo "📝 Commit message: $COMMIT_MSG"

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit"
else
    # Commit
    git commit -m "$COMMIT_MSG" --author="frist-ai <frist-ai@users.noreply.github.com>"

    # Push to main
    echo "📤 Pushing to main..."
    git push origin main 2>&1
fi

# Always sync master with main (Vercel deploys from master)
echo "🔄 Syncing main → master..."
git fetch origin master
git checkout master 2>/dev/null
git merge main --no-edit 2>/dev/null
git push origin master 2>&1
git checkout main 2>/dev/null

echo "✅ Push & sync completed!"
