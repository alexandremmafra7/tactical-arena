$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TACTICAL ARENA FC - MODO WEB / NAVEGADOR (ONLINE)     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Garantir JWT_SECRET forte (>= 32 chars)
$secretFile = Join-Path $PSScriptRoot "packages\server\.hosted_jwt_secret"
if (Test-Path $secretFile) {
  $jwtSecret = (Get-Content $secretFile -Raw).Trim()
} else {
  $bytes = New-Object Byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwtSecret = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
  Set-Content -Path $secretFile -Value $jwtSecret -NoNewline
}

# 2. Garantir banco de dados com todos os clubes e jogadores reais
$onlineDb = Join-Path $PSScriptRoot "packages\server\prisma\online_world.db"
$templateDb = Join-Path $PSScriptRoot "packages\desktop\resources\template.db"
if (-not (Test-Path $onlineDb) -and (Test-Path $templateDb)) {
  Copy-Item -Path $templateDb -Destination $onlineDb -Force
  Write-Host "[OK] Mundo online inicializado com todos os clubes e jogadores reais." -ForegroundColor Green
}

# 3. Iniciar tunel publico gratuito Cloudflare (https://xxxx.trycloudflare.com) via curl.exe rapido
$cfDir = Join-Path $PSScriptRoot ".cloudflared"
$cfExe = Join-Path $cfDir "cloudflared.exe"
$cfLog = Join-Path $cfDir "tunnel.log"
if (-not (Test-Path $cfDir)) { New-Item -ItemType Directory -Path $cfDir | Out-Null }
if (-not (Test-Path $cfExe) -or ((Get-Item $cfExe).Length -lt 30000000)) {
  Write-Host "Baixando cliente Cloudflare Tunnel (via curl.exe)..." -ForegroundColor Cyan
  & curl.exe -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o "$cfExe"
}

Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
if (Test-Path $cfLog) { Remove-Item $cfLog -Force -ErrorAction SilentlyContinue }

$publicUrl = ""
if ((Test-Path $cfExe) -and ((Get-Item $cfExe).Length -gt 30000000)) {
  Write-Host "Criando link publico HTTPS gratuito..." -ForegroundColor Cyan
  $cfArgs = "tunnel --url http://127.0.0.1:3001 --logfile `"$cfLog`""
  Start-Process -FilePath $cfExe -ArgumentList $cfArgs -WindowStyle Hidden | Out-Null

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $cfLog) {
      $content = Get-Content $cfLog -Raw -ErrorAction SilentlyContinue
      if ($content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
        $publicUrl = $Matches[0]
        break
      }
    }
  }
}

$corsList = @("http://localhost:3001", "http://127.0.0.1:3001", "http://127.0.0.1:47812", "http://localhost:47812")
if ($publicUrl -ne "") {
  $corsList += $publicUrl
  Set-Content -Path (Join-Path $cfDir "latest_url.txt") -Value $publicUrl -NoNewline
}

$env:APP_MODE = "hosted"
$env:DESKTOP_MODE = "false"
$env:NODE_ENV = "production"
$env:HOST = "0.0.0.0"
$env:PORT = "3001"
$env:JWT_SECRET = $jwtSecret
$env:CORS_ORIGINS = ($corsList -join ",")
$env:WEB_DIST_PATH = (Resolve-Path "packages\web\dist").Path
if (Test-Path $onlineDb) {
  $env:DATABASE_URL = "file:" + ($onlineDb -replace "\\", "/")
}
if (Test-Path $templateDb) {
  $env:TACTICAL_ARENA_TEMPLATE_DATABASE_PATH = $templateDb
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -ExpandProperty IPAddress

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   SERVIDOR WEB ATIVO! ABRA NO NAVEGADOR:                " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " -> No seu navegador (PC):   http://localhost:3001" -ForegroundColor White
if ($publicUrl -ne "") {
  Write-Host " -> LINK PUBLICO (Internet): $publicUrl" -ForegroundColor Yellow
}
foreach ($ip in $ips) {
  Write-Host " -> Rede Local / VPN:        http://${ip}:3001" -ForegroundColor Cyan
}
Write-Host "==========================================================`n" -ForegroundColor Green

Start-Process "http://localhost:3001"

$bundlePath = Join-Path $PSScriptRoot "packages\desktop\resources\server-bundle.cjs"
if (Test-Path $bundlePath) {
  Set-Location (Join-Path $PSScriptRoot "packages\desktop\resources")
  node server-bundle.cjs
} else {
  Set-Location (Join-Path $PSScriptRoot "packages\server")
  node dist/index.js
}
