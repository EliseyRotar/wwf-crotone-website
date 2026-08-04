# Add A records for wwfcrotone.it once VPS IP is known
# Usage:
#   $env:CF_API_TOKEN = "your-token-here"
#   .\infra\scripts\cloudflare-add-a-records.ps1 -VpsIp "85.123.45.67"
#
# Token must have "Zone DNS: Edit" scope on zone wwfcrotone.it.
# Create at: https://dash.cloudflare.com/profile/api-tokens
# Use template: "Edit zone DNS"

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsIp,
    [string]$ZoneId = "20e5a251cced0a2667fdbadaa6b034fa"
)

if (-not $env:CF_API_TOKEN) {
    Write-Host "ERROR: Set CF_API_TOKEN env var first:" -ForegroundColor Red
    Write-Host "  `$env:CF_API_TOKEN = 'your-token-here'"
    Write-Host "  Get token at: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
}
$token = $env:CF_API_TOKEN
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$base = "https://api.cloudflare.com/client/v4/zones/$ZoneId"

function Api-Cf {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $uri = "$base$Path"
    $json = if ($Body) { $Body | ConvertTo-Json -Depth 8 -Compress } else { "" }
    try {
        if ($Method -in @("GET", "DELETE")) {
            return Invoke-RestMethod -Uri $uri -Headers $headers -Method $Method -TimeoutSec 30
        } else {
            return Invoke-RestMethod -Uri $uri -Headers $headers -Method $Method -Body $json -TimeoutSec 30
        }
    } catch {
        return @{ success = $false; error = $_.Exception.Message }
    }
}

Write-Host "=== Adding A records for wwfcrotone.it → $VpsIp ===" -ForegroundColor Cyan

foreach ($name in @("@", "www")) {
    $resp = Api-Cf "POST" "/dns_records" @{
        type = "A"
        name = $name
        content = $VpsIp
        proxied = $true
        ttl = 1
    }
    if ($resp.success) {
        Write-Host "  [OK] A $name → $VpsIp (proxied through CF)" -ForegroundColor Green
    } else {
        Write-Host "  [ERR] A $name failed: $($resp.errors[0].message)"
    }
}

# Also add admin CNAME if not present
$existing = Api-Cf "GET" "/dns_records?name=admin.wwfcrotone.it"
$hasAdmin = $false
foreach ($r in $existing.result) {
    if ($r.type -eq "CNAME") {
        $hasAdmin = $true
        # Update to point at apex
        $resp = Api-Cf "PUT" "/dns_records/$($r.id)" @{
            type = "CNAME"
            name = "admin"
            content = "wwfcrotone.it"
            proxied = $true
            ttl = 1
        }
        if ($resp.success) { Write-Host "  [OK] CNAME admin → wwfcrotone.it (updated)" -ForegroundColor Green }
        break
    }
}
if (-not $hasAdmin) {
    $resp = Api-Cf "POST" "/dns_records" @{
        type = "CNAME"
        name = "admin"
        content = "wwfcrotone.it"
        proxied = $true
        ttl = 1
    }
    if ($resp.success) { Write-Host "  [OK] CNAME admin → wwfcrotone.it (created)" -ForegroundColor Green }
}

Write-Host "`n=== A records configured ===" -ForegroundColor Cyan
Write-Host "Note: It takes 30-60s for CF to start routing traffic through the new A records."