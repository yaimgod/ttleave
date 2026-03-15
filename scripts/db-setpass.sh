#!/bin/bash
# Run inside supabase/postgres container to set passwords for reserved roles.
# Only the postgres server process (superuser) can ALTER these roles.
set -e

# Start postgres in background with same config as default command
postgres -c config_file=/etc/postgresql/postgresql.conf -c log_min_messages=fatal &
until pg_isready -U postgres -d postgres 2>/dev/null; do sleep 1; done

# Set passwords for Supabase roles (reserved roles; requires superuser = local)
pwd_esc=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")
: > /tmp/setpass.sql
for role in supabase_auth_admin authenticator supabase_admin supabase_storage_admin; do
  echo "ALTER ROLE \"$role\" WITH PASSWORD '$pwd_esc';" >> /tmp/setpass.sql
done
psql -U postgres -d postgres -f /tmp/setpass.sql
echo "Supabase role passwords set."

# Keep container running
wait
