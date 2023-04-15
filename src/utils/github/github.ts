import { Octokit } from "@octokit/rest";

import { CONFIG } from "../../../config";

export const getTree = async ({
  branch,
  token,
}: {
  branch: string;
  token: string;
}) => {
  const octokit = new Octokit({
    auth: token,
  });

  if (!octokit) {
    throw new Error("Не найден объект Octokit");
  }

  if (!branch) {
    throw new Error("Не указана ветка");
  }

  return await octokit.git.getTree({
    owner: CONFIG.OCTOKIT_USER,
    repo: CONFIG.OCTOKIT_REPO,
    tree_sha: branch,
    // tree_sha: "il2cpp",
    recursive: "1",
  });
};

export const getBlob = async ({
  sha,
  token,
}: {
  sha: string;
  token: string;
}) => {
  const octokit = new Octokit({
    auth: token,
  });

  if (!octokit) {
    throw new Error("Не найден объект Octokit");
  }

  if (!sha) {
    throw new Error("Не указан SHA");
  }

  return await octokit.request(
    `GET /repos/${CONFIG.OCTOKIT_USER}/${CONFIG.OCTOKIT_REPO}/git/blobs/${sha}`,
    {
      headers: {
        Accept: "application/vnd.github.raw",
      },
    }
  );
};
