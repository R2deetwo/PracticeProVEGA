#!/bin/bash
# Start dev server, wait for it, run audit, kill server
cd /home/z/my-project

# Kill any existing vite processes
pkill -f "vite" 2>/dev/null
sleep 2

# Start dev server in background
npx vite --host 0.0.0.0 --port 5173 &
VITE_PID=$!
echo "Vite PID: $VITE_PID"

# Wait for server to be ready
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ | grep -q "200"; then
    echo "Server ready!"
    break
  fi
  echo "Waiting for server... ($i)"
  sleep 2
done

# Run the audit
echo "Starting audit..."
AUDIT_URL=http://127.0.0.1:5173 npx tsx scripts/agent-audit.ts
AUDIT_EXIT=$?

# Kill the dev server
echo "Killing dev server (PID: $VITE_PID)..."
kill $VITE_PID 2>/dev/null

exit $AUDIT_EXIT
