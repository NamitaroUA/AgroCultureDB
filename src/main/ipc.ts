import { ipcMain } from "electron";
import { getAllCrops, getTables, readTable, updateRow, insertRow, deleteRow } from "./db";

export function registerIpc() {
    ipcMain.handle('crops:list', async () => getAllCrops())
    ipcMain.handle('db:tables:list', async () => getTables())
    ipcMain.handle('db:table:read', async (_event, tableName: string) => readTable(tableName))

    ipcMain.handle('db:table:update', async (_event, tableName: string, pkColumn: string, pkValue: any, values: Record<string, any>) => updateRow(tableName, pkColumn, pkValue, values))

    ipcMain.handle('db:table:insert', async (_event, tableName: string, values: Record<string, any>) => insertRow(tableName, values))

    ipcMain.handle('db:table:delete', async (_event, tableName: string, pkColumn: string, pkValue: any) => deleteRow(tableName, pkColumn, pkValue))
}