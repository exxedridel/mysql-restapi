import { Router } from "express";
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/tasks.controllers.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.get("/tasks", verifyToken, getTasks);
router.get("/tasks/:id", verifyToken, getTask);
router.post("/tasks", verifyToken, createTask);
router.put("/tasks/:id", verifyToken, updateTask);
router.delete("/tasks/:id", verifyToken, deleteTask);

export default router;
