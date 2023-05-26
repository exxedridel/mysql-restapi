import { Router } from "express";
import { getTasks } from "../controllers/tasks.controllers.js";

const router = Router();

router.get("/tasks", getTasks);

export default router;
