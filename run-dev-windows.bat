@echo off
start "Billing Backend" cmd /k "cd /d %~dp0server && npm run dev"
start "Billing Frontend" cmd /k "cd /d %~dp0client && npm run dev"
