<#
  reset-pg-password.ps1
  ---------------------------------------------------------------------------
  Resets the local PostgreSQL 16 "postgres" superuser password to a known
  value when you've forgotten what you set during install.

  HOW TO RUN (must be elevated):
    1. Press Start, type "PowerShell", right-click > "Run as administrator".
    2. cd into this repo, then:
         powershell -ExecutionPolicy Bypass -File scripts\reset-pg-password.ps1
    3. When it finishes, the postgres password will be:  postgres

  It is SAFE: it backs up pg_hba.conf, flips local auth to "trust" only long
  enough to run one ALTER USER, then restores your original pg_hba.conf and
  restarts the service. Your original config is also kept at pg_hba.conf.bak.
#>
$ErrorActionPreference = "Stop"

# --- locate the install (default EDB layout) ----------------------------------
$svc  = "postgresql-x64-16"
$root = "C:\Program Files\PostgreSQL\16"
$data = Join-Path $root "data"
$hba  = Join-Path $data "pg_hba.conf"
$bin  = Join-Path $root "bin"
$psql = Join-Path $bin  "psql.exe"
$newPw = "postgres"

# --- admin check --------------------------------------------------------------
$me = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "This must be run from an ELEVATED PowerShell (Run as administrator)."
  exit 1
}
foreach ($p in @($hba, $psql)) {
  if (-not (Test-Path $p)) { Write-Error "Not found: $p  (is PostgreSQL 16 installed at the default path?)"; exit 1 }
}

Write-Host "Backing up pg_hba.conf -> pg_hba.conf.bak"
Copy-Item $hba "$hba.bak" -Force

try {
  Write-Host "Writing temporary trust config..."
  @"
# Temporary config written by reset-pg-password.ps1 — restored automatically.
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
"@ | Set-Content -Path $hba -Encoding ascii

  Write-Host "Restarting $svc ..."
  Restart-Service $svc
  Start-Sleep -Seconds 3

  Write-Host "Setting postgres password ..."
  & $psql -U postgres -h 127.0.0.1 -d postgres -w -c "ALTER USER postgres PASSWORD '$newPw';"
  if ($LASTEXITCODE -ne 0) { throw "psql ALTER USER failed (exit $LASTEXITCODE)" }
}
finally {
  Write-Host "Restoring original pg_hba.conf ..."
  Copy-Item "$hba.bak" $hba -Force
  Restart-Service $svc
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "============================================================"
Write-Host " Done. The postgres password is now:  $newPw"
Write-Host " Connection string:"
Write-Host "   postgresql://postgres:$newPw@localhost:5432/investment_tracker"
Write-Host "============================================================"
