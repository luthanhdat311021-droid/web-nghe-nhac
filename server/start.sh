#!/bin/bash
set -e
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
npx prisma db push --skip-generate
exec node dist/server.js
