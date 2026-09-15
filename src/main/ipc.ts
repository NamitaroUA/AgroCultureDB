import { ipcMain } from "electron";
import { getAllCrops } from "./db";

export function registerIpc() {
    ipcMain.handle('crops:list', () => getAllCrops())
}