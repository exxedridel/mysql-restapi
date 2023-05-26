import { pool } from "../db.js";

export const getTasks = async (req, res) => {
  try {
    const [result] = await pool.query(
      "SELECT * FROM tasks ORDER BY createdAt ASC"
    );
    res.json(result);
  } catch (error) {
    return res.status(500).send(
      `<h2 style="text-align: center; padding-block: 45vh;">
        ${error.message || "Database not responding"}
      </h2>`
    );
  }
};
