import express from "express";
import cors from "cors";
import indexRoutes from "./routes/index.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createUsersRouter } from "./routes/users.routes.js";
import { createAuthenticate } from "./middlewares/auth.js";
import { handleErrors } from "./lib/http-error.js";

export function createApp({ usersRepository, jwtSecret, mountTaskRoutes } = {}) {
  if (!usersRepository) throw new Error("usersRepository es obligatorio.");
  if (typeof jwtSecret !== "string" || !jwtSecret.trim()) throw new Error("JWT_SECRET es obligatorio.");
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "16kb" }));
  const authenticate = createAuthenticate({ usersRepository, jwtSecret });
  app.use("/api", indexRoutes);
  app.use("/api", createAuthRouter({ usersRepository, jwtSecret, authenticate }));
  app.use("/api/users", createUsersRouter({ usersRepository, authenticate }));
  if (mountTaskRoutes) app.use("/api", mountTaskRoutes(authenticate));
  app.use(handleErrors);
  return app;
}
