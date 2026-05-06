import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("glibDesktop", {
  pickProjectDirectory: () => ipcRenderer.invoke("glib:pick-project-directory") as Promise<string | null>
});
