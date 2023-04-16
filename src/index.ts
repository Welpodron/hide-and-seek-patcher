import { app, BrowserWindow, ipcMain, Notification, dialog } from "electron";
import { getBlob, getTree } from "./utils/github/github";
import { clear, log } from "./utils/logger/logger";
import {
  getLocalFiles,
  getRemoteFiles,
  LocalFileType,
  RemoteFileType,
  saveFile,
} from "./utils/builder/builder";
import { CacheItemType, checkCache, saveCache } from "./utils/cacher/cacher";
import deepcopy from "deepcopy";

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const DEFAULT_APP_NAME = "Hide and Seek Patcher";

const _getRemoteFiles = async ({
  webContents,
  branch,
  token,
}: {
  webContents: Electron.WebContents;
  branch: string;
  token: string;
}) => {
  let remoteFiles: RemoteFileType[] = [];

  const win = BrowserWindow.fromWebContents(webContents);

  await log({
    message: `Получение текущих файлов для ветки ${branch}...`,
    category: "FILES_REMOTE",
    webContents,
  });

  win.setTitle(`Подключение к репозиторию...`);

  try {
    remoteFiles = await getRemoteFiles({ branch, token });

    await log({
      message: `Получение текущих файлов для ветки ${branch} успешно завершено`,
      category: "FILES_REMOTE",
      status: "SUCCESS",
      webContents,
    });
  } catch (error) {
    await log({
      message: `Ошибка при получении текущих файлов ветки ${branch}: ${error}`,
      category: "FILES_REMOTE",
      status: "ERROR",
      webContents,
    });

    win.setProgressBar(1, { mode: "error" });
    dialog.showErrorBox(
      "Ошибка при получении файлов репозитория",
      error.message
    );

    throw error;
  }

  return remoteFiles;
};

const _getLocalFiles = async ({
  webContents,
}: {
  webContents: Electron.WebContents;
}) => {
  let localFiles: LocalFileType[] = [];

  const win = BrowserWindow.fromWebContents(webContents);

  await log({
    message: `Получение текущих локальных файлов...`,
    category: "FILES_LOCAL",
    webContents,
  });

  win.setTitle(`Чтение диска...`);

  try {
    localFiles = await getLocalFiles();

    await log({
      message: `Получение текущих локальных файлов успешно завершено`,
      category: "FILES_LOCAL",
      status: "SUCCESS",
      webContents,
    });
  } catch (error) {
    await log({
      message: `Ошибка при получении текущих локальных файлов: ${error}`,
      category: "FILES_LOCAL",
      status: "ERROR",
      webContents,
    });

    throw error;
  }

  return localFiles;
};

const _getFilesToDownloadWithCache = async ({
  remoteFiles,
  localFiles,
  webContents,
  token,
}: {
  token: string;
  remoteFiles: RemoteFileType[];
  localFiles: LocalFileType[];
  webContents: Electron.WebContents;
}) => {
  const win = BrowserWindow.fromWebContents(webContents);

  await log({
    message: `Проверка кэша...`,
    category: "CACHE_VALIDATION",
    webContents,
  });

  win.setTitle(`Проверка кэша...`);

  try {
    const { filesToDownload, currentCache } = await checkCache({
      remoteFiles,
      localFiles,
    });

    await log({
      message: `Кэш обнаружен и проверен. Будет загружено ${filesToDownload.length} файлов`,
      category: "CACHE_VALIDATION",
      status: "SUCCESS",
      webContents,
    });

    return {
      filesToDownload,
      currentCache,
    };
  } catch (_) {
    await log({
      message: `Кэш отсутствует или поврежден, в конце работы будет созданы новый кэш. Будет загружено ${remoteFiles.length} файлов`,
      category: "CACHE_VALIDATION",
      status: "ERROR",
      webContents,
    });

    return {
      filesToDownload: remoteFiles,
      currentCache: {
        localGithubCache: [] as CacheItemType[],
        localDiskCache: [] as CacheItemType[],
      },
    };
  }
};

const _saveFilesSync = async ({
  filesToDownload,
  currentCache,
  webContents,
  token,
}: {
  filesToDownload: RemoteFileType[];
  token: string;
  currentCache: {
    localGithubCache: CacheItemType[];
    localDiskCache: CacheItemType[];
  };
  webContents: Electron.WebContents;
}) => {
  const win = BrowserWindow.fromWebContents(webContents);

  win.setTitle(`Загрузка файлов...`);

  if (!filesToDownload.length) {
    await log({
      message: `Нет файлов для загрузки`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "SUCCESS",
      webContents,
    });

    win.setProgressBar(-1);
    webContents.send("handle-progress", {
      progress: 100,
      status: "SUCCESS",
    });

    return;
  }

  let currentProgress = 0;
  const oneFileProgress = 1.0 / filesToDownload.length;

  win.setProgressBar(0);

  const newCache = {
    localGithubCache: deepcopy(currentCache.localGithubCache),
    localDiskCache: deepcopy(currentCache.localDiskCache),
  };

  await log({
    message: `Загрузка ${filesToDownload.length} файлов...`,
    category: "FILES_REMOTE_DOWNLOAD",
    webContents,
  });

  try {
    for (const downloadedFile of filesToDownload) {
      await log({
        message: `Загрузка файла ${downloadedFile.path}...`,
        category: "FILES_REMOTE_DOWNLOAD",
        webContents,
      });

      const { data } = await getBlob({ sha: downloadedFile.sha, token });

      await log({
        message: `Загрузка файла ${downloadedFile.path} успешно завершена`,
        category: "FILES_REMOTE_DOWNLOAD",
        status: "SUCCESS",
        webContents,
      });

      await log({
        message: `Сохранение файла ${downloadedFile.path}...`,
        category: "FILES_REMOTE_SAVE",
        webContents,
      });

      const {
        size: savedFileSize,
        sha: savedFileSha,
        remotePath: savedFilePath,
        localPath: savedFileLocalPath,
      } = await saveFile({
        filePath: downloadedFile.path,
        fileBuffer: Buffer.from(data as string, "utf-8"),
      });

      await log({
        message: `Сохранение файла ${downloadedFile.path} успешно завершено. Файл сохранен в ${savedFileLocalPath}`,
        category: "FILES_REMOTE_SAVE",
        status: "SUCCESS",
        webContents,
      });

      const existingCacheIndex = newCache.localGithubCache.findIndex(
        (cachedFile) => cachedFile.path === downloadedFile.path
      );

      if (existingCacheIndex !== -1) {
        // Вносим изменения в кэш
        newCache.localGithubCache[existingCacheIndex] = {
          path: downloadedFile.path as string,
          sha: downloadedFile.sha as string,
          size: downloadedFile.size as number,
        };
        newCache.localDiskCache[existingCacheIndex] = {
          path: downloadedFile.path as string,
          sha: savedFileSha,
          size: savedFileSize,
        };
      } else {
        // Добавляем новый файл в кэш
        newCache.localGithubCache.push({
          path: downloadedFile.path as string,
          sha: downloadedFile.sha as string,
          size: downloadedFile.size as number,
        });
        newCache.localDiskCache.push({
          path: downloadedFile.path as string,
          sha: savedFileSha,
          size: savedFileSize,
        });
      }

      currentProgress += oneFileProgress;
      win.setProgressBar(currentProgress);
      webContents.send("handle-progress", {
        progress: currentProgress * 100,
        status: "IN_PROGRESS",
      });
    }

    win.setProgressBar(-1);
    webContents.send("handle-progress", {
      progress: 100,
      status: "SUCCESS",
    });

    await log({
      message: `Загрузка ${filesToDownload.length} файлов успешно завершена`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "SUCCESS",
      webContents,
    });
  } catch (error) {
    await log({
      message: `Ошибка при загрузке файлов: ${error}`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "ERROR",
      webContents,
    });
    webContents.send("handle-progress", {
      progress: 100,
      status: "ERROR",
    });
    win.setProgressBar(1, { mode: "error" });
    dialog.showErrorBox("Ошибка при загрузке файлов", error.message);
  } finally {
    await log({
      message: `Сохранение кэша...`,
      category: "CACHE_SAVE",
      webContents,
    });

    win.setTitle(`Сохранение кэша...`);

    const isCacheSaved = await saveCache({
      cache: newCache,
    });

    if (isCacheSaved && isCacheSaved.path) {
      await log({
        message: `Кэш успешно сохранен в ${isCacheSaved.path}`,
        category: "CACHE_SAVE",
        status: "SUCCESS",
        webContents,
      });
    } else {
      await log({
        message: `Ошибка при сохранении кэша`,
        category: "CACHE_SAVE",
        status: "ERROR",
        webContents,
      });
    }
  }
};

const _saveFilesAsync = async ({
  filesToDownload,
  currentCache,
  webContents,
  token,
}: {
  filesToDownload: RemoteFileType[];
  token: string;
  currentCache: {
    localGithubCache: CacheItemType[];
    localDiskCache: CacheItemType[];
  };
  webContents: Electron.WebContents;
}) => {
  const win = BrowserWindow.fromWebContents(webContents);

  win.setTitle(`Загрузка файлов...`);

  if (!filesToDownload.length) {
    await log({
      message: `Нет файлов для загрузки`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "SUCCESS",
      webContents,
    });

    win.setProgressBar(-1);
    webContents.send("handle-progress", {
      progress: 100,
      status: "SUCCESS",
    });

    return;
  }

  let currentProgress = 0;
  const oneFileProgress = 1.0 / filesToDownload.length;

  win.setProgressBar(0);

  const newCache = {
    localGithubCache: deepcopy(currentCache.localGithubCache),
    localDiskCache: deepcopy(currentCache.localDiskCache),
  };

  await log({
    message: `Загрузка ${filesToDownload.length} файлов...`,
    category: "FILES_REMOTE_DOWNLOAD",
    webContents,
  });

  try {
    await Promise.all(
      (filesToDownload as RemoteFileType[]).map(async (downloadedFile) => {
        await log({
          message: `Загрузка файла ${downloadedFile.path}...`,
          category: "FILES_REMOTE_DOWNLOAD",
          webContents,
        });

        const { data } = await getBlob({ sha: downloadedFile.sha, token });

        await log({
          message: `Загрузка файла ${downloadedFile.path} успешно завершена`,
          category: "FILES_REMOTE_DOWNLOAD",
          status: "SUCCESS",
          webContents,
        });

        await log({
          message: `Сохранение файла ${downloadedFile.path}...`,
          category: "FILES_REMOTE_SAVE",
          webContents,
        });

        const {
          size: savedFileSize,
          sha: savedFileSha,
          remotePath: savedFilePath,
          localPath: savedFileLocalPath,
        } = await saveFile({
          filePath: downloadedFile.path,
          fileBuffer: Buffer.from(data as string, "utf-8"),
        });

        await log({
          message: `Сохранение файла ${downloadedFile.path} успешно завершено. Файл сохранен в ${savedFileLocalPath}`,
          category: "FILES_REMOTE_SAVE",
          status: "SUCCESS",
          webContents,
        });

        const existingCacheIndex = newCache.localGithubCache.findIndex(
          (cachedFile) => cachedFile.path === downloadedFile.path
        );

        if (existingCacheIndex !== -1) {
          // Вносим изменения в кэш
          newCache.localGithubCache[existingCacheIndex] = {
            path: downloadedFile.path as string,
            sha: downloadedFile.sha as string,
            size: downloadedFile.size as number,
          };
          newCache.localDiskCache[existingCacheIndex] = {
            path: downloadedFile.path as string,
            sha: savedFileSha,
            size: savedFileSize,
          };
        } else {
          // Добавляем новый файл в кэш
          newCache.localGithubCache.push({
            path: downloadedFile.path as string,
            sha: downloadedFile.sha as string,
            size: downloadedFile.size as number,
          });
          newCache.localDiskCache.push({
            path: downloadedFile.path as string,
            sha: savedFileSha,
            size: savedFileSize,
          });
        }

        currentProgress += oneFileProgress;
        win.setProgressBar(currentProgress);
        webContents.send("handle-progress", {
          progress: currentProgress * 100,
          status: "IN_PROGRESS",
        });
      })
    );

    win.setProgressBar(-1);
    webContents.send("handle-progress", {
      progress: 100,
      status: "SUCCESS",
    });

    await log({
      message: `Загрузка ${filesToDownload.length} файлов успешно завершена`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "SUCCESS",
      webContents,
    });
  } catch (error) {
    await log({
      message: `Ошибка при загрузке файлов: ${error}`,
      category: "FILES_REMOTE_DOWNLOAD",
      status: "ERROR",
      webContents,
    });
    webContents.send("handle-progress", {
      progress: 100,
      status: "ERROR",
    });
    win.setProgressBar(1, { mode: "error" });
    dialog.showErrorBox("Ошибка при загрузке файлов", error.message);
  } finally {
    await log({
      message: `Сохранение кэша...`,
      category: "CACHE_SAVE",
      webContents,
    });

    win.setTitle(`Сохранение кэша...`);

    const isCacheSaved = await saveCache({
      cache: newCache,
    });

    if (isCacheSaved && isCacheSaved.path) {
      await log({
        message: `Кэш успешно сохранен в ${isCacheSaved.path}`,
        category: "CACHE_SAVE",
        status: "SUCCESS",
        webContents,
      });
    } else {
      await log({
        message: `Ошибка при сохранении кэша`,
        category: "CACHE_SAVE",
        status: "ERROR",
        webContents,
      });
    }
  }
};

const handleSync = async (
  event: Electron.IpcMainEvent,
  { branch, token }: { branch: string; token: string }
) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  await clear();

  await log({
    message: `Синхронизация запущена`,
    category: "SYNC_START",
    webContents,
  });

  win.setTitle("Синхронизация...");
  win.setProgressBar(2);
  webContents.send("handle-progress", {
    progress: 0,
    status: "IN_PROGRESS",
  });

  const remoteFiles = await _getRemoteFiles({ webContents, branch, token });

  const localFiles = await _getLocalFiles({ webContents });

  const { filesToDownload, currentCache } = await _getFilesToDownloadWithCache({
    remoteFiles,
    localFiles,
    webContents,
    token,
  });

  await _saveFilesAsync({
    filesToDownload: filesToDownload,
    currentCache,
    webContents,
    token,
  });

  await log({
    message: `Синхронизация завершена \n\n\n`,
    category: "SYNC_END",
    webContents,
  });

  new Notification({
    title: "Синхронизация завершена",
    body: "Синхронизация и обновление файлов завершены",
  }).show();

  win.setTitle(DEFAULT_APP_NAME);
};

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    center: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: DEFAULT_APP_NAME,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.removeMenu();
  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  ipcMain.handle("handle-sync", handleSync);

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
