import express from "express";

import {
    createExpense,
    getAllExpenses,
    getSingleExpense,
    updateExpense,
    deleteExpense
} from "../controllers/expenseController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, createExpense);
router.get("/getAll", protect, getAllExpenses);
router.get("/getSingle:id", protect, getSingleExpense);
router.put("/update:id", protect, updateExpense);
router.delete("/delete:id", protect, deleteExpense);

export default router;