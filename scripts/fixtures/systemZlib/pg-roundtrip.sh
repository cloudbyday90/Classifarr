#!/bin/sh
# Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
set -eu
umask 077
base=$(mktemp -d /tmp/classifarr-zlib-pg.XXXXXX)
case "$base" in /tmp/classifarr-zlib-pg.*) ;; *) exit 1 ;; esac
cluster=''
bin=''
cleanup() {
    if [ -n "$cluster" ] && [ -n "$bin" ]; then "$bin/pg_ctl" -D "$cluster" -m immediate -w stop >/dev/null 2>&1 || true; fi
    rm -rf "$base"
}
trap cleanup EXIT HUP INT TERM
for major in 17 18; do
    bin="/usr/libexec/postgresql$major"
    ldd "$bin/pg_dump" >"$base/dump-links"
    ldd "$bin/pg_restore" >"$base/restore-links"
    grep -Fq 'libz.so.1' "$base/dump-links"
    grep -Fq 'libz.so.1' "$base/restore-links"
    cluster="$base/data$major"
    socket="$base/socket$major"
    mkdir "$socket"
    "$bin/initdb" -D "$cluster" --no-locale --encoding=UTF8 -A trust >"$base/init.log" 2>&1
    "$bin/pg_ctl" -D "$cluster" -l "$base/server.log" -o "-k $socket -p 15432 -c listen_addresses='' -c max_connections=8 -c shared_buffers=8MB" -w start >/dev/null
    export PGHOST="$socket" PGPORT=15432 PGUSER=classifarr
    "$bin/createdb" original
    "$bin/psql" -X -v ON_ERROR_STOP=1 -d original -q -c "CREATE TABLE payload(id integer PRIMARY KEY, value text NOT NULL); INSERT INTO payload SELECT n,repeat(md5(n::text),256) FROM generate_series(1,32) n;"
    before=$("$bin/psql" -X -At -d original -c "SELECT count(*)||':'||md5(string_agg(value,'' ORDER BY id)) FROM payload")
    "$bin/pg_dump" --format=custom --compress=gzip:6 -d original -f "$base/archive.dump"
    "$bin/createdb" restored
    "$bin/pg_restore" --exit-on-error -d restored "$base/archive.dump"
    after=$("$bin/psql" -X -At -d restored -c "SELECT count(*)||':'||md5(string_agg(value,'' ORDER BY id)) FROM payload")
    [ "$before" = "$after" ]
    "$bin/pg_ctl" -D "$cluster" -m fast -w stop >/dev/null
    cluster=''
done
printf '%s\n' '{"postgres17":true,"postgres18":true,"rowsPerMajor":32,"gzipCustomRoundtrip":true}'
