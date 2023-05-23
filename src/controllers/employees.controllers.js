import { pool } from "../db.js";

// Read employee functionality
export const getEmployees = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM employees");
  res.send(rows);
};

// Read 1 employe functionality
export const get1Employee = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM employees WHERE id = ?", [
    req.params.id,
  ]);

  if (rows.length <= 0)
    return res.status(404).json({
      message: "Employee not found",
    });

  res.json(rows[0]);
  /* SSR */
  // res.send(
  //   `<h1 style="
  //       color: blue; text-align: center; padding-block: 45vh;
  //     ">
  //       Obtaning employee id: ${rows[0].id}
  //   </h1>`
  // );
};

// Create employee functionality
export const createEmployee = async (req, res) => {
  const { name, salary } = req.body;
  const [rows] = await pool.query(
    "INSERT INTO employees(name, salary) VALUES (?, ?)",
    [name, salary]
  );
  // it goes inside cursly brackets so it can be returned as a json
  res.send({
    id: rows.insertId,
    name,
    salary,
  });
};

export const updateEmployee = (req, res) => res.send("updating employees");

export const deleteEmployee = (req, res) => res.send("deleting employees");
