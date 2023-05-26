// common js node modules
// const express = require("express");

// with ES modules, "type": "module", required over the package.json
import express from "express";
import cors from "cors";
import indexRoutes from "./routes/index.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(indexRoutes);
app.use("/api", employeesRoutes);
app.use("/api", tasksRoutes);

/* Middleware function to handle not found, but default is better*/
// app.use((req, res, next) => {
//   res.status(404).json({
//     message: "Endpoint not found",
//   });
// });

export default app;
