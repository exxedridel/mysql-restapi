import { Router } from "express";
import bcrypt from "bcryptjs";
import { asyncRoute, HttpError } from "../lib/http-error.js";
import { parseUserId, validateUserInput } from "../lib/user-validation.js";
import { assertCurrentIdentity, publicUser, requireAdmin } from "../lib/users.js";

const missingUser = () => new HttpError(404, "No se encontró el usuario.", "USER_NOT_FOUND");

async function ensureUniqueEmail(repository, email, exceptId) {
  const existing = await repository.findByEmail(email);
  if (existing && Number(existing.id) !== exceptId) throw new HttpError(409, "El correo ya está registrado.", "EMAIL_ALREADY_EXISTS");
}

async function adminTransaction(repository, identity, callback) {
  return repository.transaction(async (tx) => {
    const actor = assertCurrentIdentity(identity, await tx.findById(identity.id));
    if (actor.role !== "admin") throw new HttpError(403, "Esta acción requiere una cuenta administradora.", "ADMIN_REQUIRED");
    return callback(tx, actor);
  });
}

export function createUsersRouter({ usersRepository, authenticate }) {
  const router = Router();
  router.use(authenticate);
  router.get("/contacts", asyncRoute(async (req, res) => {
    res.json({ users: (await usersRepository.list()).filter((user) => Number(user.id) !== req.user.id).map(publicUser) });
  }));
  router.use(requireAdmin);
  router.get("/", asyncRoute(async (_req, res) => res.json({ users: (await usersRepository.list()).map(publicUser) })));
  router.get("/:id", asyncRoute(async (req, res) => {
    const user = await usersRepository.findById(parseUserId(req.params.id));
    if (!user) throw missingUser();
    res.json({ user: publicUser(user) });
  }));
  router.post("/", asyncRoute(async (req, res) => {
    const input = validateUserInput(req.body, { create: true });
    const password = await bcrypt.hash(input.password, 10);
    const user = await adminTransaction(usersRepository, req.auth, async (tx) => {
      await ensureUniqueEmail(tx, input.email);
      return tx.create({ ...input, password });
    });
    res.status(201).json({ user: publicUser(user) });
  }));
  router.put("/:id", asyncRoute(async (req, res) => {
    const id = parseUserId(req.params.id);
    const input = validateUserInput(req.body);
    if (Object.hasOwn(input, "password")) input.password = await bcrypt.hash(input.password, 10);
    const user = await adminTransaction(usersRepository, req.auth, async (tx, actor) => {
      const current = await tx.findById(id);
      if (!current) throw missingUser();
      if (Object.hasOwn(input, "email")) await ensureUniqueEmail(tx, input.email, id);
      if (Number(actor.id) === Number(current.id) && input.role === "player") throw new HttpError(409, "No puedes quitarte tu propio acceso de administrador.", "SELF_DEMOTION_FORBIDDEN");
      if (current.role === "admin" && input.role === "player" && (await tx.list()).filter((row) => row.role === "admin").length <= 1) throw new HttpError(409, "Debe permanecer al menos un administrador.", "LAST_ADMIN_REQUIRED");
      const identityChanged = (Object.hasOwn(input, "email") && input.email !== current.email) || (Object.hasOwn(input, "role") && input.role !== current.role) || Object.hasOwn(input, "password");
      const fields = { ...input };
      if (identityChanged) fields.token_version = Number(current.token_version) + 1;
      return tx.update(id, fields);
    });
    res.json({ user: publicUser(user) });
  }));
  router.delete("/:id", asyncRoute(async (req, res) => {
    const id = parseUserId(req.params.id);
    await adminTransaction(usersRepository, req.auth, async (tx, actor) => {
      const current = await tx.findById(id);
      if (!current) throw missingUser();
      if (Number(actor.id) === Number(current.id)) throw new HttpError(409, "No puedes eliminar tu propia cuenta.", "SELF_DELETE_FORBIDDEN");
      if (current.role === "admin" && (await tx.list()).filter((row) => row.role === "admin").length <= 1) throw new HttpError(409, "Debe permanecer al menos un administrador.", "LAST_ADMIN_REQUIRED");
      await tx.delete(id);
    });
    res.sendStatus(204);
  }));
  return router;
}
