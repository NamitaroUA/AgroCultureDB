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
    };
  }
}