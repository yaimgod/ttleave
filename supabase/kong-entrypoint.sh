#!/bin/bash
# supabase/kong-entrypoint.sh
# Renders kong.yml.tpl → kong.yml by substituting env vars, then starts Kong.
# Kong 2.x declarative config does NOT auto-expand ${VAR} placeholders.
set -e

perl -pe '
  s/\$\{SUPABASE_ANON_KEY\}/$ENV{SUPABASE_ANON_KEY}/g;
  s/\$\{SUPABASE_SERVICE_KEY\}/$ENV{SUPABASE_SERVICE_KEY}/g;
  s/\$\{DASHBOARD_USERNAME\}/$ENV{DASHBOARD_USERNAME}/g;
  s/\$\{DASHBOARD_PASSWORD\}/$ENV{DASHBOARD_PASSWORD}/g;
' /home/kong/kong.yml.tpl > /home/kong/kong.yml

exec /docker-entrypoint.sh kong docker-start
