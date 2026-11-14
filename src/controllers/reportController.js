
import Installment from "../models/installmentModel.js";
import Payment from "../models/paymentModel.js";
import Expense from "../models/expenseModel.js";

// ==========================================
// PROFIT AND LOSS REPORT
// ==========================================

export const getProfitLossReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range"
            });
        }

        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        const [salesStats, expenseStats, paymentStats] =
            await Promise.all([
                Installment.aggregate([
                    {
                        $match: {
                            purchaseDate: {
                                $gte: start,
                                $lte: end
                            },
                            status: { $ne: "cancelled" }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: "$finalPrice" },
                            totalActualCost: { $sum: "$actualRate" },
                            totalAccounts: { $sum: 1 }
                        }
                    }
                ]),

                Expense.aggregate([
                    {
                        $match: {
                            expenseDate: {
                                $gte: start,
                                $lte: end
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalExpenses: { $sum: "$amount" },
                            totalExpenseRecords: { $sum: 1 }
                        }
                    }
                ]),

                Payment.aggregate([
                    {
                        $match: {
                            paymentDate: {
                                $gte: start,
                                $lte: end
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalCollected: { $sum: "$amount" },
                            totalPayments: { $sum: 1 }
                        }
                    }
                ])
            ]);

        const sales = salesStats[0] || {
            totalSales: 0,
            totalActualCost: 0,
            totalAccounts: 0
        };

        const expenses = expenseStats[0] || {
            totalExpenses: 0,
            totalExpenseRecords: 0
        };

        const payments = paymentStats[0] || {
            totalCollected: 0,
            totalPayments: 0
        };

        const grossProfit = Number(
            (sales.totalSales - sales.totalActualCost).toFixed(2)
        );

        const netProfit = Number(
            (grossProfit - expenses.totalExpenses).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            message: "Profit and loss report generated successfully",
            data: {
                period: {
                    startDate: start,
                    endDate: end
                },
                sales: {
                    totalAccounts: sales.totalAccounts,
                    totalSales: sales.totalSales,
                    totalActualCost: sales.totalActualCost
                },
                profit: {
                    grossProfit,
                    netProfit
                },
                expenses: {
                    totalExpenses: expenses.totalExpenses,
                    totalExpenseRecords: expenses.totalExpenseRecords
                },
                collections: {
                    totalCollected: payments.totalCollected,
                    totalPayments: payments.totalPayments
                }
            }
        });

    } catch (error) {
        console.error("Profit loss report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate profit and loss report"
        });
    }
};


// ==========================================
// SALES REPORT
// ==========================================

export const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range"
            });
        }

        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Math.min(
            100,
            Math.max(1, Number(limit) || 10)
        );

        const skip = (pageNumber - 1) * limitNumber;

        const filter = {
            purchaseDate: {
                $gte: start,
                $lte: end
            },
            status: { $ne: "cancelled" }
        };

        const [accounts, summary, totalRecords] = await Promise.all([
            Installment.find(filter)
                .populate(
                    "customer",
                    "customerName cnic fatherName contactNumber"
                )
                .sort({ purchaseDate: -1 })
                .skip(skip)
                .limit(limitNumber),

            Installment.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$finalPrice" },
                        totalActualCost: { $sum: "$actualRate" },
                        totalAccounts: { $sum: 1 }
                    }
                }
            ]),

            Installment.countDocuments(filter)
        ]);

        const totals = summary[0] || {
            totalSales: 0,
            totalActualCost: 0,
            totalAccounts: 0
        };

        const grossProfit = Number(
            (totals.totalSales - totals.totalActualCost).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            message: "Sales report generated successfully",
            data: {
                period: {
                    startDate: start,
                    endDate: end
                },
                summary: {
                    totalAccounts: totals.totalAccounts,
                    totalSales: totals.totalSales,
                    totalActualCost: totals.totalActualCost,
                    grossProfit
                },
                accounts,
                pagination: {
                    totalRecords,
                    currentPage: pageNumber,
                    totalPages: Math.ceil(totalRecords / limitNumber),
                    limit: limitNumber
                }
            }
        });

    } catch (error) {
        console.error("Sales report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate sales report"
        });
    }
};



export const getPaymentsReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Please provide startDate and endDate"
            });
        }

        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T23:59:59.999Z`);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            start > end
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range"
            });
        }

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));
        const skip = (currentPage - 1) * pageLimit;

        const filter = {
            paymentDate: {
                $gte: start,
                $lte: end
            }
        };

        const [summaryResult, payments, totalRecords] = await Promise.all([
            Payment.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalCollected: { $sum: "$amount" },
                        totalPayments: { $sum: 1 },

                        cashCollected: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentMethod", "cash"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        bankCollected: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentMethod", "bank"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        downPaymentTotal: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentType", "down_payment"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        regularPaymentTotal: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentType", "regular"] },
                                    "$amount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),

            Payment.find(filter)
                .populate({
                    path: "installment",
                    select: "productName customer",
                    populate: {
                        path: "customer",
                        select: "customerName cnic"
                    }
                })
                .populate("receivedBy", "name")
                .sort({ paymentDate: -1 })
                .skip(skip)
                .limit(pageLimit),

            Payment.countDocuments(filter)
        ]);

        const summary = summaryResult[0] || {
            totalCollected: 0,
            totalPayments: 0,
            cashCollected: 0,
            bankCollected: 0,
            downPaymentTotal: 0,
            regularPaymentTotal: 0
        };

        return res.status(200).json({
            success: true,
            message: "Payments report generated successfully",
            data: {
                period: {
                    startDate: start,
                    endDate: end
                },
                summary,
                payments,
                pagination: {
                    totalRecords,
                    currentPage,
                    totalPages: Math.ceil(totalRecords / pageLimit),
                    limit: pageLimit
                }
            }
        });

    } catch (error) {
        console.error("Payments report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate payments report",
            error: error.message
        });
    }
};



export const getExpensesReport = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Please provide startDate and endDate"
            });
        }

        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T23:59:59.999Z`);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            start > end
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range"
            });
        }

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));
        const skip = (currentPage - 1) * pageLimit;

        const filter = {
            expenseDate: {
                $gte: start,
                $lte: end
            }
        };

        const [
            summaryResult,
            categoryBreakdown,
            expenses,
            totalRecords
        ] = await Promise.all([
            Expense.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalExpenses: { $sum: "$amount" },
                        totalRecords: { $sum: 1 },
                        cashExpenses: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentMethod", "cash"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },
                        bankExpenses: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$paymentMethod", "bank"] },
                                    "$amount",
                                    0
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalExpenses: 1,
                        totalRecords: 1,
                        cashExpenses: 1,
                        bankExpenses: 1
                    }
                }
            ]),

            Expense.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: "$category",
                        totalAmount: { $sum: "$amount" },
                        totalRecords: { $sum: 1 }
                    }
                },
                { $sort: { totalAmount: -1 } }
            ]),

            Expense.find(filter)
                .populate("createdBy", "name")
                .sort({ expenseDate: -1 })
                .skip(skip)
                .limit(pageLimit),

            Expense.countDocuments(filter)
        ]);

        const summary = summaryResult[0] || {
            totalExpenses: 0,
            totalRecords: 0,
            cashExpenses: 0,
            bankExpenses: 0
        };

        return res.status(200).json({
            success: true,
            message: "Expenses report generated successfully",
            data: {
                period: {
                    startDate: start,
                    endDate: end
                },
                summary,
                categoryBreakdown,
                expenses,
                pagination: {
                    totalRecords,
                    currentPage,
                    totalPages: Math.ceil(totalRecords / pageLimit),
                    limit: pageLimit
                }
            }
        });

    } catch (error) {
        console.error("Expenses report error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate expenses report",
            error: error.message
        });
    }
};
