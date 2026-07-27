import * as Crypto from "expo-crypto";

export const localPasswordVersion = 1;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createPasswordSalt() {
  return bytesToHex(Crypto.getRandomBytes(16));
}

export async function hashLocalPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${localPasswordVersion}:${salt}:${password}`,
  );
}

export async function verifyLocalPassword(
  password: string,
  salt: string,
  expectedHash: string,
) {
  const actualHash = await hashLocalPassword(password, salt);
  return actualHash === expectedHash;
}
