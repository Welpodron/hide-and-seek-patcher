import fs from "fs-extra";
import path from "path";
import { getHashObject } from "../crypter/crypter";
import { getTree } from "../github/github";
import { CONFIG } from "../../../config";
import { app } from "electron";

const PATH_BUILD = path.normalize(app.getAppPath() + CONFIG.PATH_BUILD);

export type RemoteFileType = {
  path?: string | undefined;
  mode?: string | undefined;
  type?: string | undefined;
  sha?: string | undefined;
  size?: number | undefined;
  url?: string | undefined;
};

export type LocalFileType = {
  path?: string | undefined;
  sha?: string | undefined;
  size?: number | undefined;
};

export const getRemoteFiles = async ({
  branch,
  token,
}: {
  branch: string;
  token: string;
}) => {
  const { data } = await getTree({ branch, token });

  let files = data.tree as RemoteFileType[];

  files = files.filter(
    (file) =>
      file.path &&
      file.path !== ".gitignore" &&
      file.type === "blob" &&
      file.url &&
      file.sha
  );

  if (!files.length) {
    throw new Error(
      `Не удалось получить список файлов из репозитория для ветки ${branch}`
    );
  }

  return files;
};

export const getFileShaFromPath = async ({
  path,
}: {
  path: string;
}): Promise<string> => {
  const hash = getHashObject({
    algorithm: "sha1",
  });

  const stream = fs.createReadStream(path);

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", (error) => {
      // reject(error);
    });
  });
};

export const getFileShaFromBuffer = async ({
  buffer,
}: {
  buffer: Buffer;
}): Promise<string> => {
  const hash = getHashObject({
    algorithm: "sha1",
  });

  hash.update(buffer);

  return hash.digest("hex");
};

const _getLocalFiles = async ({
  directory,
  replaceable,
}: {
  directory: string;
  replaceable: string;
}) => {
  const isDirectoryExists = await fs.pathExists(directory);

  if (!isDirectoryExists) {
    return [];
  }

  const files = await fs.readdir(directory, { withFileTypes: true });
  const result: LocalFileType[] = [];

  for (const file of files) {
    const filepath = path.join(directory, file.name);

    if (file.isDirectory()) {
      result.push(
        ...(await _getLocalFiles({ directory: filepath, replaceable }))
      );
    } else if (file.isFile()) {
      const absolute = filepath.replace(/\\/g, "/");
      const relativePath = absolute.replace(
        replaceable.replace(/\\/g, "/"),
        ""
      );

      const { size } = await fs.stat(filepath);

      let sha = "";

      try {
        sha = await getFileShaFromPath({ path: filepath });
      } catch (_) {
        // ignore
      }

      result.push({
        path: relativePath,
        sha,
        size,
      });
    }
  }

  return result;
};

export const getLocalFiles = async () => {
  return _getLocalFiles({
    directory: PATH_BUILD,
    replaceable: PATH_BUILD,
  });
};

export const saveFile = async ({
  filePath,
  fileBuffer,
}: {
  filePath: string;
  fileBuffer: Buffer;
}) => {
  await fs.outputFile(path.join(PATH_BUILD, filePath), fileBuffer);

  const sha = await getFileShaFromBuffer({ buffer: fileBuffer });

  return {
    remotePath: filePath,
    localPath: PATH_BUILD,
    sha: sha,
    size: Buffer.byteLength(fileBuffer),
  };
};
