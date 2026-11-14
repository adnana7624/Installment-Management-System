import express from "express";
import { getExpensesReport, getPaymentsReport, getProfitLossReport, getSalesReport } from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profit-loss", protect, getProfitLossReport);

router.get("/sales-report",protect,getSalesReport);

router.get("/payments-reports",protect , getPaymentsReport);

router.get("/expenses-reports", protect , getExpensesReport);


export default router;