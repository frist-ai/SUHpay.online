#!/bin/bash
# Auto-sync: main → master (fast-forward only)
# Runs every 2 minutes via cron

cd /home/z/my-project || exit 1

# Fetch latest
git fetch origin main master --quiet 2>/dev/null

# Check if master is behind main
LOCAL_MAIN=$(git rev-parse origin/main)
LOCAL_MASTER=$(git rev-parse origin/master)

if [ "$LOCAL_MAIN" != "$LOCAL_MASTER" ]; then
  git checkout master --quiet 2>/dev/null
  git merge origin/main --ff-only --quiet 2>/dev/null
  git push origin master --quiet 2>/dev/null
  git checkout main --quiet 2>/dev/null
  echo "$(date '+%Y-%m-%d %H:%M:%S') Synced main→master ($LOCAL_MAIN)"
fi
