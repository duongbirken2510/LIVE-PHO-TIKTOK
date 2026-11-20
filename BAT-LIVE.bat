@echo off
chcp 65001 >nul
title Pho Co Ba 3D - Live-Pho Admin & Stage (Port 4011)
cd /d "%~dp0games\curry-shop-3d"
if not exist node_modules (
  echo [1/1] Lan dau chay: dang cai thu vien ket noi TikTok LIVE va Edge TTS...
  call npm install
)
echo ==============================================================
echo   PHO CO BA 3D (LIVE-PHO) - PORT 4011
echo ==============================================================
echo Trang Admin Dieu Khien : http://localhost:4011
echo Link TikTok LIVE Studio: http://lvh.me:4011/?view=stage  (1080 x 1920)
echo Bam nut "Tat Live & Giai phong Port 4011" tren web hoac dong cua so nay de tat.
echo.
set PORT=4011
set BRIDGE_PORT=4012
start "" cmd /c "timeout /t 2 >nul & start http://localhost:4011"
node server.mjs
