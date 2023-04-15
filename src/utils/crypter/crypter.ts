import crypto from "crypto";

import { CONFIG } from "../../../config";

const CRYPTO_KEY = crypto.scryptSync(
  CONFIG.CRYPTO_PASSWORD,
  CONFIG.CRYPTO_SALT,
  32
);

export const encryptFile = ({
  data,
  algorithm = CONFIG.CRYPTO_ALGORITHM,
  iv = CONFIG.CRYPTO_IV,
  key = CRYPTO_KEY,
}: {
  data: string;
  algorithm?: string;
  iv?: Uint8Array;
  key?: Buffer;
}) => {
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  return Buffer.concat([cipher.update(data), cipher.final()]);
};

export const decryptFile = ({
  data,
  algorithm = CONFIG.CRYPTO_ALGORITHM,
  iv = CONFIG.CRYPTO_IV,
  key = CRYPTO_KEY,
}: {
  data: Buffer;
  algorithm?: string;
  iv?: Uint8Array;
  key?: Buffer;
}) => {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  const result = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString();

  return result;
};

export const getHashObject = ({
  algorithm = "sha1",
}: {
  algorithm?: string;
}) => {
  return crypto.createHash(algorithm);
};
