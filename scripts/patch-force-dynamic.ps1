# Patch every src/app/**/page.tsx that imports prisma to add
# `export const dynamic = 'force-dynamic';` at the top.
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Admin\Documents\WWF_CROTONE_WEBSITE\src\app'
$files = Get-ChildItem -Path $root -Recurse -Filter 'page.tsx'
$patched = 0
foreach ($f in $files) {
    $content = Get-Content -Raw -LiteralPath $f.FullName
    if ($content -notmatch 'from\s+"@/lib/prisma"') { continue }
    if ($content -match "export const dynamic\s*=") { continue }

    $idx = $content.IndexOf('export ')
    if ($idx -lt 0) {
        Write-Host "skip (no export): $($f.FullName)"
        continue
    }
    $new = $content.Substring(0, $idx) +
           "export const dynamic = 'force-dynamic';`n`n" +
           $content.Substring($idx)
    Set-Content -LiteralPath $f.FullName -Value $new -Encoding utf8
    Write-Host "patched: $($f.FullName)"
    $patched++
}
Write-Host "patched $patched files"
