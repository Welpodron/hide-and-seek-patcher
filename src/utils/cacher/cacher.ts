import fs from "fs-extra";

import { decryptFile, encryptFile } from "../crypter/crypter";
import { RemoteFileType, LocalFileType } from "../builder/builder";
import { app } from "electron";
import { CONFIG } from "../../../config";

const PATH_CACHE = app.getAppPath() + CONFIG.PATH_CACHE;

export type CacheItemType = {
  sha: string;
  path: string;
  size?: number;
};

export type CacheItemsType = {
  localGithubCache: CacheItemType[];
  localDiskCache: CacheItemType[];
};

export const checkCache = async ({
  remoteFiles,
  localFiles,
}: {
  remoteFiles: RemoteFileType[];
  localFiles: LocalFileType[];
}) => {
  let cache: CacheItemsType = {
    localGithubCache: [],
    localDiskCache: [],
  };

  const data = await fs.readFile(PATH_CACHE);

  if (!data) {
    throw new Error("Не удалось прочитать файл кэша");
  }

  const result = decryptFile({ data });

  if (!result.trim().length) {
    throw new Error("Не удалось прочитать файл кэша");
  }

  cache = JSON.parse(result) as CacheItemsType;

  if (!cache || !cache.localGithubCache || !cache.localDiskCache) {
    throw new Error("Не удалось прочитать файл кэша");
  }

  const { localGithubCache, localDiskCache } = cache;

  const _pathFilter = ({
    localFile,
    remoteFile,
  }: {
    localFile: LocalFileType;
    remoteFile: RemoteFileType;
  }) =>
    localFile.path &&
    localFile.path.trim().length &&
    remoteFile.path &&
    remoteFile.path.trim().length &&
    localFile.path === remoteFile.path;

  const _shaFilter = ({
    localFile,
    remoteFile,
  }: {
    localFile: LocalFileType;
    remoteFile: RemoteFileType;
  }) =>
    localFile.sha &&
    localFile.sha.trim().length &&
    remoteFile.sha &&
    remoteFile.sha.trim().length &&
    localFile.sha === remoteFile.sha;

  const filesToDownload = remoteFiles.filter((remoteFile) => {
    const localGithubCacheFile = localGithubCache.find((localFile) =>
      _pathFilter({ localFile, remoteFile })
    );

    if (
      localGithubCacheFile &&
      _shaFilter({ localFile: localGithubCacheFile, remoteFile })
    ) {
      // на хабе файл не изменился однако его локальная копия могла быть повреждена
      const localDiskCacheFile = localDiskCache.find((localFile) =>
        _pathFilter({ localFile, remoteFile })
      );

      if (localDiskCacheFile) {
        const _localFile = localFiles.find((localFile) =>
          _pathFilter({ localFile, remoteFile })
        );

        if (
          _localFile &&
          _shaFilter({ localFile: _localFile, remoteFile: localDiskCacheFile })
        ) {
          // файл целый
          return false;
        }
      }
      // по какой-то причине файл не был записан в локальный кэш диска
      return true;
    }

    return true;
  });

  return {
    filesToDownload,
    currentCache: cache,
  };
};

export const saveCache = async ({ cache }: { cache: CacheItemsType }) => {
  try {
    await fs.outputFile(
      PATH_CACHE,
      encryptFile({ data: JSON.stringify(cache) })
    );
  } catch (_) {
    return false;
  }

  return {
    path: PATH_CACHE,
  };
};
