import { app, BrowserWindow} from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'

function createWindow(): void {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        maxWidth: 800,
        maxHeight: 600,
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })
    if (process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }
}
app.whenReady().then(() => {
    registerIpc()
    createWindow()
})
app.on('window-all-closed', () => { 

    if (process.platform !== 'darwin') app.quit() 

})

/*const { app, BrowserWindow} = require('electron/main');

const path = require('node:path')

const createWindow = () => {
const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js')
    }
})

win.loadFile('index.html')
}

app.whenReady().then(() => {
createWindow()
})

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit()
})*/