import { createPool } from "mysql2/promise";

export const pool = createPool({
  host: "localhost",
  user: "root",
  password: "aleman666",
  port: 3306,
  database: "companydb",
});

/*being called with */
 // pool.query()
