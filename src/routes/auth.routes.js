import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncRoute, HttpError } from "../lib/http-error.js";
import { validateLogin } from "../lib/user-validation.js";
import { publicUser } from "../lib/users.js";

export function createAuthRouter({ usersRepository, jwtSecret, authenticate }) {
  const router = Router();
  router.post("/login", asyncRoute(async (req, res) => {
    const input = validateLogin(req.body);
    const row = await usersRepository.findByEmail(input.email);
    if (!row || !(await bcrypt.compare(input.password, row.password))) {
      throw new HttpError(401, "Credenciales inválidas.", "INVALID_CREDENTIALS");
    }
    const user = publicUser(row);
    const token = jwt.sign({ ...user, tokenVersion: Number(row.token_version) }, jwtSecret, {
      algorithm: "HS256",
      expiresIn: "12h",
    });
    res.json({ token, user });
  }));
  router.get("/auth/me", authenticate, (req, res) => res.json({ user: req.user }));
  // Local logout does not revoke other sessions.
  router.post("/logout", authenticate, (_req, res) => res.sendStatus(204));
  return router;
}
