export {};

declare global {
  interface Window {
    versions: {
      node: () => string;
      chrome: () => string;
      electron: () => string;
    }; 
    api: {
      crops: {
        list: () => Promise<{ CropID: number; Name: string}[]>;
      };

      db: {
        tables: {
          list: () => Promise<{ TABLE_NAME: string }[]>;
        }
        table: {
          read: (name: string) => Promise<{ columns: any[]; rows: any[]; objectType: string }>;          update: (name: string, pkCol: string, pkVal: any, values: Record<string, any>) => Promise<void>;
          insert: (name: string, values: Record<string, any>) => Promise<void>;
          delete: (name: string, pkCol: string, pkVal: any) => Promise<void>;
        }
      }
    };
  }
}