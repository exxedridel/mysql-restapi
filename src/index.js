// common js node modules
// const express = require("express");

// with ES modules, "type": "module", required over the package.json
import express from "express";
import indexRoutes from "./routes/index.routes.js";
import employeesRoutes from "./routes/employees.routes.js";

const app = express();

app.use(express.json());

app.use(indexRoutes);
app.use("/api", employeesRoutes);

/* Middleware function to handle not found, but default is better*/
// app.use((req, res, next) => {
//   res.status(404).json({
//     message: "Endpoint not found",
//   });
// });

app.listen(4000);
console.log("🚀 server running at http://localhost:4000");
