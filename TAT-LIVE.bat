@echo off
chcp 65001 >nul
title Tat Live & Giai Phong Port 4011
echo Dang tat Server Live-Pho va giai phong cong 4011 / 4012...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4011/api/server/shutdown' -TimeoutSec 2 | Out-Null } catch {}; Start-Sleep -Milliseconds 300; $conns = Get-NetTCPConnection -LocalPort 4011,4012 -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }; Write-Host '[OK] Da tat Server va giai phong hoan toan Port 4011!'"
timeout /t 3 >nul
