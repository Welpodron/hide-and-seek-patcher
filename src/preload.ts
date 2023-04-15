// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  sync: ({ branch, token }: { branch: string; token: string }) =>
    ipcRenderer.invoke("handle-sync", { branch, token }),
  handleLog: (callback: any) => ipcRenderer.on("handle-log", callback),
  handleProgress: (callback: any) =>
    ipcRenderer.on("handle-progress", callback),
});
