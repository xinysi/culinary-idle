// 美食放置：食之契约 — Electron 壳（加载 dist 构建产物）
const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

app.setName('美食放置：食之契约')

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: '美食放置：食之契约',
    backgroundColor: '#fff8e1',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  win.setMenuBarVisibility(false)
}

Menu.setApplicationMenu(null)
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
