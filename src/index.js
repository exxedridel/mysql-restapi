import { createApp } from "./app.js";
import { PORT } from "./config.js";
import { pool } from "./db.js";
import { initDatabase } from "./init-db.js";
import { MysqlUsersRepository } from "./repositories/users.repository.js";
import { createTasksRouter } from "./routes/tasks.routes.js";

async function start() {
  const jwtSecret = process.env.JWT_SECRET;
  if (typeof jwtSecret !== "string" || !jwtSecret.trim()) throw new Error("JWT_SECRET es obligatorio.");
  await initDatabase(pool);
  const app = createApp({
    usersRepository: new MysqlUsersRepository(pool),
    jwtSecret,
    mountTaskRoutes: createTasksRouter,
  });
  app.listen(PORT, () => console.log(`Servidor de autenticación escuchando en puerto ${PORT}.`));
}

start().catch(async (error) => {
  // Do not print SQL, connection credentials, password hashes or JWTs.
  console.error(`No se pudo iniciar autenticación: ${error.code ?? "INITIALIZATION_FAILED"}. Revisa conexión, JWT_SECRET y migraciones.`);
  await pool.end();
  process.exitCode = 1;
});
