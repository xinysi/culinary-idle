@echo off
rem Project npm wrapper: cd to project root, put bundled toolchain on PATH, then call bundled npm
rem 2026-09-05: 工具链已移至 wuguan\.toolchain\node（不随 GitHub 上传），本地开发仍可用
setlocal
cd /d "%~dp0"
set "PATH=%~dp0wuguan\.toolchain\node;%PATH%"
call "%~dp0wuguan\.toolchain\node\npm.cmd" %*
exit /b %ERRORLEVEL%
