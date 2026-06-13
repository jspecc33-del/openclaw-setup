#!/bin/bash
# Claude CLI workflow script
# Demonstrates running sequential Claude commands with session resumption

# First command: Fix the auth bug in the login endpoint
echo "=========================================="
echo "Step 1: Fix auth bug in login endpoint"
echo "=========================================="
SESSION_ID=$(claude \
  --cwd /workspace/lovable-app \
  --allowedTools "Read,Write,Edit,Bash" \
  --verbose \
  -p "Fix the auth bug in the login endpoint" | grep -oP 'Session: \K[\w-]+' || echo "abc-123")

echo "Session ID: $SESSION_ID"

# Brief pause
sleep 2

# Second command: Resume and add tests
echo ""
echo "=========================================="
echo "Step 2: Add tests for the fix"
echo "=========================================="
claude \
  --resume "$SESSION_ID" \
  -p "Now add tests for that fix"

echo ""
echo "=========================================="
echo "Workflow complete!"
echo "=========================================="
