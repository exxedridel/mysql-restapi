import jwt from "jsonwebtoken";
import { HttpError } from "../lib/http-error.js";
import { assertCurrentIdentity, publicUser } from "../lib/users.js";
import { hashToken } from "../lib/sessions.js";

export function createAuthenticate({ usersRepository, jwtSecret }) {
  return async function authenticate(req, _res, next) {
    try {
      const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
      if (!match) throw new HttpError(401, "Inicia sesión para continuar.", "TOKEN_REQUIRED");
      let claims;
      try {
        claims = jwt.verify(match[1], jwtSecret, { algorithms: ["HS256"] });
      } catch {
        throw new HttpError(401, "La sesión no es válida o ha expirado.", "INVALID_TOKEN");
      }
      if (
        !claims || typeof claims !== "object" ||
        !Number.isSafeInteger(claims.id) || claims.id < 1 ||
        typeof claims.email !== "string" ||
        !Number.isFinite(claims.exp) ||
        (claims.tokenVersion !== undefined && (!Number.isSafeInteger(claims.tokenVersion) || claims.tokenVersion < 0))
      ) {
        throw new HttpError(401, "La sesión no es válida.", "INVALID_TOKEN");
      }
      const identity = {
        id: claims.id,
        email: claims.email.trim().toLowerCase(),
        tokenVersion: claims.tokenVersion ?? 0,
        tokenHash: hashToken(match[1]),
        expiresAt: claims.exp,
      };
      if (await usersRepository.isTokenRevoked(identity.tokenHash)) {
        throw new HttpError(401, "Esta sesión se ha cerrado. Vuelve a iniciar sesión.", "SESSION_REVOKED");
      }
      const user = assertCurrentIdentity(identity, await usersRepository.findById(identity.id));
      req.auth = identity;
      req.user = publicUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}
