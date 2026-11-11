import { createHash } from "node:crypto";

export function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
