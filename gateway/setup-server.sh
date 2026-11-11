#!/usr/bin/env bash
# One-time setup on gold-server. Run from your Mac after pushing to main:
#   ssh gold-server 'bash -s' < gateway/setup-server.sh
# Safe to run again: it never touches an existing gateway.env, and only reinstalls the unit files.
#
# What it changes on the server:
#   1. Pulls the latest site repo into /home/gold/server-platform/ai-site-src
#   2. Postgres: new role and database "gateway" (non-superuser, owns only itself), plus one line in
#      pg_hba.conf letting that role in from the Docker subnet, the same pattern as crm and umami.
#      pg_hba.conf is backed up to pg_hba.conf.bak-gateway first.
#   3. /home/gold/server-platform/gateway/gateway.env (mode 600) with a generated database password.
#      ANTHROPIC_API_KEY is left blank for you to fill in.
#   4. systemd user units: xgold-ai-gateway (127.0.0.1:3030) and a daily xgold-ai-invoice timer.
set -euo pipefail
cd /home/gold/server-platform
git -C ai-site-src pull --ff-only -q
git -C ai-site-src log --oneline -1

if [ ! -e gateway/gateway.env ]; then
  install -d -m 700 gateway
  H=/var/lib/postgresql/data/pg_hba.conf
  PSQL="docker exec -i gold-platform-postgres psql -U gold_admin -d gold_platform -v ON_ERROR_STOP=1 -q"
  pw=$(openssl rand -hex 24)

  $PSQL -c "create role gateway login password '$pw'" -c "create database gateway owner gateway"
  docker exec gold-platform-postgres sh -c "cp $H $H.bak-gateway && sed -i '/crm_umami_reader/a host    gateway         gateway         172.20.0.0/16           scram-sha-256' $H && grep -n -E 'gateway|reject' $H"
  $PSQL -c "select pg_reload_conf()" >/dev/null

  umask 077
  cat > gateway/gateway.env <<EOF
GATEWAY_DATABASE_URL=postgres://gateway:$pw@127.0.0.1:5432/gateway
ANTHROPIC_API_KEY=
TWENTY_API_KEY_FILE=/home/gold/server-platform/crm/twenty-api-key
TWENTY_BASE_URL=http://127.0.0.1:3020
EOF
  docker exec -i gold-platform-postgres psql -U gateway -d gateway -v ON_ERROR_STOP=1 -q < ai-site-src/gateway/schema.sql
  echo "database ready:"
  docker exec gold-platform-postgres psql -U gateway -d gateway -At -c "select tablename from pg_tables where schemaname='public' order by 1"
else
  echo "gateway.env exists; database left as it is"
fi

install -d ~/.config/systemd/user
cp ai-site-src/gateway/xgold-ai-gateway.service ai-site-src/gateway/xgold-ai-invoice.service ai-site-src/gateway/xgold-ai-invoice.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now xgold-ai-gateway.service xgold-ai-invoice.timer
sleep 2
systemctl --user is-active xgold-ai-gateway.service
curl -fsS -m 5 http://127.0.0.1:3030/healthz; echo
echo "Next: put your Anthropic key in gateway/gateway.env (ANTHROPIC_API_KEY=...), then: systemctl --user restart xgold-ai-gateway"
