@echo off
cd /d %~dp0
echo ============================================
echo   美食放置：食之契约 - EXE 一键更新脚本
echo ============================================

echo [1/4] 构建最新版本（vite build）...
call npm.cmd run build
if errorlevel 1 (echo 构建失败！ & pause & exit /b 1)

echo [2/4] 复制构建产物到 lmewexe/dist ...
if exist lmewexe\dist rmdir /s /q lmewexe\dist
xcopy dist lmewexe\dist /e /i /q /y >nul
if errorlevel 1 (echo 复制失败！ & pause & exit /b 1)

echo [3/4] 修正资源路径为相对路径...
python "lmewexe/fix_paths.py"
if errorlevel 1 (echo 路径修正失败！ & pause & exit /b 1)

echo [4/4] 打包 EXE（electron-packager）...
call npm.cmd --prefix lmewexe run pack
if errorlevel 1 (echo 打包失败！ & pause & exit /b 1)

echo.
echo 完成！EXE 位置：
echo   lmewexeelease\美食放置：食之契约-win32-x64\美食放置：食之契约.exe
echo.
pause
