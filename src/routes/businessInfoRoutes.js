import express from "express";

import {
    getBusinessInfo,
    updateBusinessInfo
} from "../controllers/businessInfoController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get Business Information
router.get("/get", protect, getBusinessInfo);

// Create or Update Business Information
router.put("/create", protect, updateBusinessInfo);

export default router;