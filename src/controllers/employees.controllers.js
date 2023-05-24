import { pool } from "../db.js";

/* Read employees functionality */
export const getEmployees = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM employees");
  res.send(rows);
};

/* Read 1 employee functionality */
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
  //       Obtaining employee id: ${rows[0].id}
  //   </h1>`
  // );
};

/* Create employee functionality */
export const createEmployee = async (req, res) => {
  const { name, salary } = req.body;
  const [rows] = await pool.query(
    "INSERT INTO employees(name, salary) VALUES (?, ?)",
    [name, salary]
  );

  /* This approach only returns the entered data not the actual row created in database */
  res.send({
    id: rows.insertId,
    name,
    salary,
  });
};

/* Patch employee functionality (to partially update the data) */
export const updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { name, salary } = req.body;
  const [result] = await pool.query(
    "UPDATE employees SET name = IFNULL(?, name), salary = IFNULL(?, salary)  WHERE id = ?",
    [name, salary, id]
  );

  if (result.affectedRows <= 0)
    return res.status(404).send({ message: "Employee not found" });

  /* This approach returns the actual row edited in the database */
  const [rows] = await pool.query("SELECT * FROM employees WHERE id = ?", [id]);
  res.json(rows[0]);
};

/* Delete employee functionality */
export const deleteEmployee = async (req, res) => {
  console.log(req.params.id);

  const [result] = await pool.query("DELETE FROM employees WHERE id = ?", [
    req.params.id,
  ]);

  if (result.affectedRows <= 0)
    return res.status(404).json({
      message: "Employee not found",
    });

  // res.send("Employee deleted successfully");

  /* Successful request, but without any content in the response body */
  res.sendStatus(204);
};
