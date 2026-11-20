@echo off
chcp 65001 >nul
title Dong Goi Bo Cai Dat .EXE 1-Click - Pho Co Ba 3D (LIVE-PHO-TIKTOK)
cd /d "%~dp0"
node build-installer.mjs
pause
