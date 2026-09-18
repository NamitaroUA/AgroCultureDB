import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
})

contextBridge.exposeInMainWorld('api', {
    crops: {
        list: () => ipcRenderer.invoke('crops:list')
    },

    db: {
        tables: {
            list: () => ipcRenderer.invoke('db:tables:list')
        },
        table: {
            read: (name: string) => ipcRenderer.invoke('db:table:read', name),
            
            update: (name: string, pkCol: string, pkVal: any, values: Record<string, any>) => 
                ipcRenderer.invoke('db:table:update', name, pkCol, pkVal, values),

            insert: (name: string, values: Record<string, any>) =>
                ipcRenderer.invoke('db:table:insert', name, values),

            delete: (name: string, pkCol: string, pkVal: any) =>
                ipcRenderer.invoke('db:table:delete', name, pkCol, pkVal)
        }
    }
})