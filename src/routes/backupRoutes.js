
import express from "express";
import { createBackup, getBackupHistory } from "../controllers/backupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, createBackup);

router.get("/get",protect,getBackupHistory);


export default router;
