#!/usr/bin/env bash
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf <<'EOF'
SELECT 'turni:'      AS what,  count(*) AS n FROM "Turno" UNION ALL
SELECT 'gallery:'    ,       count(*)         FROM "GalleryItem" UNION ALL
SELECT 'operatori:'  ,       count(*)         FROM "Operatore" UNION ALL
SELECT 'iscrizioni:' ,       count(*)         FROM "Iscrizione" UNION ALL
SELECT 'users:'      ,       count(*)         FROM "User";
EOF
