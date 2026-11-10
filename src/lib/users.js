import { HttpError } from "./http-error.js";

export function publicUser(user) {
  return { id: Number(user.id), email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role };
}

export function assertCurrentIdentity(identity, user) {
  if (!user || Number(user.id) !== identity.id || user.email.trim().toLowerCase() !== identity.email || Number(user.token_version) !== identity.tokenVersion) {
    throw new HttpError(401, "La sesión ya no es válida. Vuelve a iniciar sesión.", "SESSION_INVALID");
  }
  return user;
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== "admin") return next(new HttpError(403, "Esta acción requiere una cuenta administradora.", "ADMIN_REQUIRED"));
  next();
}
