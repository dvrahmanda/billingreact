@echo off
echo Menginstall dependency backend...
cd server
call npm install
if not exist .env copy .env.example .env
cd ..
echo Menginstall dependency frontend...
cd client
call npm install
if not exist .env copy .env.example .env
cd ..
echo.
echo Selesai. Jalankan run-dev-windows.bat
pause
