import app from "./app.js";
import { PORT } from "./config.js";
import { initDatabase } from "./init-db.js";

app.listen(PORT, async () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  await initDatabase(); // ✅ Ejecuta inicialización en el arranque
});

