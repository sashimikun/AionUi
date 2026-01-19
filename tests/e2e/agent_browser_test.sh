#!/bin/bash

echo "=== Testing Frontend Dev Server on 3000 ==="
agent-browser open http://localhost:3000
agent-browser snapshot -i
agent-browser screenshot frontend_3000.png

echo "=== Testing Backend WebUI on 25808 ==="
agent-browser open http://localhost:25808
agent-browser snapshot -i
agent-browser screenshot backend_25808.png

echo "=== Done ==="
