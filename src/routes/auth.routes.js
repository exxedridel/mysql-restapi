import { Router } from "express";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

  if (rows.length === 0)
    return res.status(401).json({ message: "Credenciales inválidas" });

  const user = rows[0];

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch)
    return res.status(401).json({ message: "Credenciales inválidas" });

  const token = jwt.sign({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }, process.env.JWT_SECRET, {
    expiresIn: "180m",
  });

  res.json({ token });
});

export default router;
