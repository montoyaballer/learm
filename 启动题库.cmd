@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 随身题库本地服务
node server.mjs
if errorlevel 1 (
  echo.
  echo 启动失败，请确认已安装 Node.js。
  pause
)
