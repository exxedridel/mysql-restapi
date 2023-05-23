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

app.listen(4000);
console.log("🚀 server running at http://localhost:4000");
