import fs from "fs-extra";
import { app } from "electron";
import chalk from "chalk";

import { CONFIG } from "../../../config";

const PATH_LOGS = app.getAppPath() + CONFIG.PATH_LOGS;

export const log = async ({
  message,
  category,
  status = "DEFAULT",
  webContents,
}: {
  message: string;
  category?: string;
  status?: "DEFAULT" | "SUCCESS" | "ERROR";
  webContents: Electron.WebContents;
}) => {
  const currentTimeStamp = new Date().toLocaleTimeString();

  const categoryString = category ? `[${category}]` : "";
  const statusString =
    status !== "DEFAULT"
      ? `[${
          status === "ERROR"
            ? "ERROR ❌"
            : status === "SUCCESS"
            ? "SUCCESS ✔️"
            : ""
        }]`
      : "";

  const _message = `[DEBUG][${currentTimeStamp}]${categoryString}${statusString} ${message}`;

  try {
    await fs.ensureFile(PATH_LOGS);
    await fs.appendFile(PATH_LOGS, `${_message} \n`);
  } catch (_) {
    // ignore
  }

  if (category === "ERROR" || status === "ERROR") {
    console.error(chalk.red(_message));
    webContents.send("handle-log", chalk.red(_message));
  } else if (status === "SUCCESS") {
    console.log(chalk.green(_message));
    webContents.send("handle-log", chalk.green(_message));
  } else {
    console.log(_message);
    webContents.send("handle-log", _message);
  }

  return _message;
};

export const clear = async () => {
  await fs.remove(PATH_LOGS);
};
