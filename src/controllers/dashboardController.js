
import Customer from "../models/customerModel.js";
import Installment from "../models/installmentModel.js";
import Payment from "../models/paymentModel.js";
import Expense from "../models/expenseModel.js";

export const getDashboard = async (req, res) => {
    try {
        // 1. Customer statistics
        const totalCustomers = await Customer.countDocuments();

        // 2. Installment account statistics
        const accountStats = await Installment.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalSales: { $sum: "$finalPrice" },
                    totalActualCost: { $sum: "$actualRate" },
                    remainingBalance: { $sum: "$remainingAmount" }
                }
            }
        ]);

        const accounts = {
            total: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
            totalSales: 0,
            totalActualCost: 0,
            remainingBalance: 0
        };

        accountStats.forEach((item) => {
            accounts.total += item.count;

            if (item._id === "active") {
                accounts.active = item.count;
                accounts.remainingBalance = item.remainingBalance;
            }

            if (item._id === "completed") {
                accounts.completed = item.count;
            }

            if (item._id === "cancelled") {
                accounts.cancelled = item.count;
            }

            // Exclude cancelled accounts from business totals
            if (item._id !== "cancelled") {
                accounts.totalSales += item.totalSales;
                accounts.totalActualCost += item.totalActualCost;
            }
        });

        // 3. Total payments received
        const paymentStats = await Payment.aggregate([
            {
                $group: {
                    _id: null,
                    totalCollected: { $sum: "$amount" }
                }
            }
        ]);

        const totalCollected = paymentStats[0]?.totalCollected || 0;

        // 4. Total business expenses
        const expenseStats = await Expense.aggregate([
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: "$amount" }
                }
            }
        ]);

        const totalExpenses = expenseStats[0]?.totalExpenses || 0;

        // 5. Profit calculations
        const grossProfit = Number(
            (accounts.totalSales - accounts.totalActualCost).toFixed(2)
        );

        const netProfit = Number(
            (grossProfit - totalExpenses).toFixed(2)
        );

        // 6. Dashboard response
        return res.status(200).json({
            success: true,
            message: "Dashboard data fetched successfully",
            data: {
                customers: {
                    total: totalCustomers
                },
                accounts: {
                    total: accounts.total,
                    active: accounts.active,
                    completed: accounts.completed,
                    cancelled: accounts.cancelled
                },
                sales: {
                    totalSales: accounts.totalSales,
                    totalCollected,
                    remainingBalance: accounts.remainingBalance
                },
                expenses: {
                    totalExpenses
                },
                profit: {
                    grossProfit,
                    netProfit
                }
            }
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard data"
        });
    }
};
