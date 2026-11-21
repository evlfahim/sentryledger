/**
 * API route for exporting dashboard data as PDF.
 *
 * GET /api/export/pdf?accountId=<id>
 * Returns a PDF file download with dashboard summary, charts data, and transactions.
 */

import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import {
  getAllTransactions,
  getAccounts,
  getBudgets,
  getActiveSavingsGoals,
  type TransactionRow,
  type BudgetRow,
  type SavingsGoalRow,
} from "@/lib/import/db";
import { calculateSafeToSpend } from "@/lib/safe-to-spend/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthlySpending {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

interface CashFlowEntry {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    uniqueCategories: number;
  };
  spendingByCategory: CategoryBreakdown[];
  monthlyTrends: MonthlySpending[];
  cashFlow: CashFlowEntry[];
  recentTransactions: TransactionRow[];
  accounts: { id: string; name: string; type: string; balance: number; currency: string }[];
  budgets: { name: string; amount: number; period: string; categoryId: string }[];
}

interface SafeToSpendResult {
  safeToSpend: number;
  dailySafeAmount: number;
  remainingDays: number;
  totalIncome: number;
  totalBills: number;
  totalBudgetedSpending: number;
  totalSavingsGoals: number;
  safeToSpendPercent: number;
  deductions: { label: string; amount: number; percentage: number }[];
  isSafe: boolean;
  warning?: string;
  goals: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    monthlyContribution: number;
    deadline: string | null;
    isActive: boolean;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const date = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Food: "#2563eb",
    "Food & Dining": "#2563eb",
    Groceries: "#2563eb",
    Dining: "#3b82f6",
    Transport: "#059669",
    Transportation: "#059669",
    Gas: "#059669",
    "Gas Station": "#059669",
    Shopping: "#d97706",
    Retail: "#d97706",
    Entertainment: "#dc2626",
    Fun: "#dc2626",
    Bills: "#7c3aed",
    Utilities: "#7c3aed",
    "Electric Bill": "#7c3aed",
    "Internet Bill": "#7c3aed",
    "Phone Bill": "#7c3aed",
    Health: "#ec4899",
    Healthcare: "#ec4899",
    Medical: "#ec4899",
    "Health Insurance": "#ec4899",
    Housing: "#6366f1",
    Rent: "#6366f1",
    Mortgage: "#6366f1",
    "Auto & Transport": "#0891b2",
    Insurance: "#8b5cf6",
    "Auto Insurance": "#8b5cf6",
    "Home Insurance": "#8b5cf6",
    Savings: "#10b981",
    Investments: "#f59e0b",
    Income: "#10b981",
    Salary: "#10b981",
    Transfer: "#64748b",
    "Transfer from": "#64748b",
    "Transfer to": "#64748b",
    Other: "#94a3b8",
  };
  return colors[category] || "#94a3b8";
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

function generateDashboardPdf(doc: InstanceType<typeof PDFDocument>, data: DashboardData, safeToSpend: SafeToSpendResult | null) {
  let y = 60;
  const margin = 60;
  const contentWidth = doc.page.width - margin * 2;

  function checkNewPage(required: number): boolean {
    if (y + required > doc.page.height - 60) {
      doc.addPage();
      y = 60;
      return true;
    }
    return false;
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.fontSize(24).font("Helvetica-Bold").fillColor("#0a0a0a").text("SentryLedger", margin, y);
  y += 8;
  doc.fontSize(14).font("Helvetica").fillColor("#737373").text("Financial Report", margin, y);
  y += 8;
  doc.fontSize(10).font("Helvetica").fillColor("#737373").text(
    `Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    y
  );
  y += 30;

  // ── Summary Section ────────────────────────────────────────────────────────
  doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Summary", margin, y);
  y += 20;

  const summaryItems = [
    { label: "Total Income", value: formatCurrency(data.summary.totalIncome), color: "#10b981" },
    { label: "Total Expenses", value: formatCurrency(data.summary.totalExpenses), color: "#ef4444" },
    { label: "Net Flow", value: formatCurrency(data.summary.netFlow), color: data.summary.netFlow >= 0 ? "#10b981" : "#ef4444" },
    { label: "Transactions", value: String(data.summary.transactionCount), color: "#6366f1" },
    { label: "Categories", value: String(data.summary.uniqueCategories), color: "#d97706" },
  ];

  const colWidth = contentWidth / 3;
  for (let i = 0; i < 3; i++) {
    const item = summaryItems[i];
    const x = margin + i * colWidth;
    doc.fontSize(10).font("Helvetica").fillColor("#737373").text(item.label, x, y);
    doc.fontSize(14).font("Helvetica-Bold").fillColor(item.color).text(item.value, x, y + 16);
  }
  for (let i = 3; i < 5; i++) {
    const item = summaryItems[i];
    const x = margin + (i - 3) * colWidth;
    doc.fontSize(10).font("Helvetica").fillColor("#737373").text(item.label, x, y + 40);
    doc.fontSize(14).font("Helvetica-Bold").fillColor(item.color).text(item.value, x, y + 56);
  }
  y += 80;

  // ── Safe-to-Spend Section ──────────────────────────────────────────────────
  if (safeToSpend) {
    checkNewPage(80);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Safe to Spend", margin, y);
    y += 20;
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#10b981").text(
      formatCurrency(safeToSpend.safeToSpend),
      margin,
      y
    );
    y += 16;
    doc.fontSize(10).font("Helvetica").fillColor("#737373").text(
      `Daily: ${formatCurrency(safeToSpend.dailySafeAmount)}  |  Remaining days: ${safeToSpend.remainingDays}`,
      margin,
      y
    );
    y += 30;
  }

  // ── Spending by Category ───────────────────────────────────────────────────
  if (data.spendingByCategory.length > 0) {
    checkNewPage(200);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Spending by Category", margin, y);
    y += 20;

    const topCategories = data.spendingByCategory.slice(0, 8);
    for (const cat of topCategories) {
      const color = getCategoryColor(cat.category);

      // Color bar
      doc.rect(margin, y, 8, 12).fill(color);

      // Category name
      doc.fontSize(11).font("Helvetica").fillColor("#0a0a0a").text(
        cat.category,
        margin + 14,
        y
      );

      // Amount
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0a0a0a").text(
        formatCurrency(cat.amount),
        margin + contentWidth - 80,
        y
      );

      // Percentage bar
      const barWidth = (cat.percentage / 100) * (contentWidth - 200);
      if (barWidth > 0) {
        doc.rect(margin + 100, y + 2, barWidth, 8).fill(color).opacity(0.3).fill().opacity(1);
      }

      y += 22;
    }
    y += 10;
  }

  // ── Cash Flow ──────────────────────────────────────────────────────────────
  if (data.cashFlow.length > 0) {
    checkNewPage(200);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Cash Flow", margin, y);
    y += 20;

    // Table header
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#737373")
      .text("Month", margin, y)
      .text("Income", margin + 100, y)
      .text("Expenses", margin + 200, y)
      .text("Net", margin + 300, y);
    y += 2;
    doc.rect(margin, y, contentWidth, 0.5).fill("#e5e5e5");
    y += 8;

    for (const cf of data.cashFlow) {
      doc.fontSize(10).font("Helvetica").fillColor("#0a0a0a")
        .text(formatMonth(cf.month), margin, y)
        .text(formatCurrency(cf.income), margin + 100, y)
        .text(formatCurrency(cf.expenses), margin + 200, y)
        .text(formatCurrency(cf.net), margin + 300, y);
      y += 16;
    }
    y += 10;
  }

  // ── Monthly Spending Trends ────────────────────────────────────────────────
  if (data.monthlyTrends.length > 0) {
    checkNewPage(200);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Monthly Spending", margin, y);
    y += 20;

    // Simple bar chart representation
    const maxTotal = Math.max(...data.monthlyTrends.map((m) => m.total), 1);
    const barHeight = 12;
    const barGap = 4;
    const chartLeft = margin;
    const chartRight = margin + contentWidth - 80;
    const chartWidth = chartRight - chartLeft - 80;

    for (const trend of data.monthlyTrends) {
      const barWidth = (trend.total / maxTotal) * chartWidth;

      // Label
      doc.fontSize(9).font("Helvetica").fillColor("#737373").text(
        formatMonth(trend.month),
        chartLeft - 70,
        y
      );

      // Bar
      doc.rect(chartLeft, y, barWidth, barHeight).fill("#2563eb").opacity(0.7).fill().opacity(1);

      // Value
      doc.fontSize(9).font("Helvetica").fillColor("#0a0a0a").text(
        formatCurrency(trend.total),
        chartRight,
        y
      );

      y += barHeight + barGap;
    }
    y += 10;
  }

  // ── Recent Transactions ────────────────────────────────────────────────────
  if (data.recentTransactions.length > 0) {
    checkNewPage(40);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Recent Transactions", margin, y);
    y += 20;

    // Table header
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#737373")
      .text("Date", margin, y)
      .text("Description", margin + 80, y)
      .text("Category", margin + 280, y)
      .text("Amount", margin + 380, y);
    y += 2;
    doc.rect(margin, y, contentWidth, 0.5).fill("#e5e5e5");
    y += 8;

    for (const tx of data.recentTransactions.slice(0, 20)) {
      checkNewPage(20);

      const dateStr = new Date(tx.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const desc = tx.description.length > 35 ? tx.description.substring(0, 35) + "..." : tx.description;
      const category = tx.category || "Uncategorized";
      const amountStr = (tx.amount >= 0 ? "+" : "") + formatCurrency(tx.amount);
      const amountColor = tx.amount >= 0 ? "#10b981" : "#ef4444";

      doc.fontSize(9).font("Helvetica").fillColor("#737373")
        .text(dateStr, margin, y)
        .text(desc, margin + 80, y)
        .text(category, margin + 280, y);

      doc.fontSize(9).font("Helvetica").fillColor(amountColor).text(
        amountStr,
        margin + 380,
        y
      );

      y += 14;
    }
  }

  // ── Accounts ───────────────────────────────────────────────────────────────
  if (data.accounts.length > 0) {
    checkNewPage(40);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Accounts", margin, y);
    y += 20;

    for (const acc of data.accounts) {
      checkNewPage(50);

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0a0a0a").text(acc.name, margin, y);
      y += 14;
      doc.fontSize(10).font("Helvetica").fillColor("#737373")
        .text(`Type: ${acc.type}`, margin, y)
        .text(`Balance: ${formatCurrency(acc.balance)}`, margin + 200, y);
      y += 20;
    }
  }

  // ── Budgets ────────────────────────────────────────────────────────────────
  if (data.budgets.length > 0) {
    checkNewPage(40);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Budgets", margin, y);
    y += 20;

    for (const budget of data.budgets) {
      checkNewPage(50);

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0a0a0a").text(budget.name, margin, y);
      y += 14;
      doc.fontSize(10).font("Helvetica").fillColor("#737373")
        .text(`Amount: ${formatCurrency(budget.amount)}`, margin, y)
        .text(`Period: ${budget.period}`, margin + 200, y);
      y += 20;
    }
  }

  // ── Savings Goals ──────────────────────────────────────────────────────────
  if (safeToSpend && safeToSpend.goals.length > 0) {
    checkNewPage(40);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0a0a0a").text("Savings Goals", margin, y);
    y += 20;

    for (const goal of safeToSpend.goals) {
      checkNewPage(50);

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0a0a0a").text(goal.name, margin, y);
      y += 14;
      doc.fontSize(10).font("Helvetica").fillColor("#737373")
        .text(`Target: ${formatCurrency(goal.targetAmount)}`, margin, y)
        .text(`Current: ${formatCurrency(goal.currentAmount)}`, margin + 200, y);
      y += 20;
    }
  }
}

// ─── GET: Export dashboard as PDF ────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const _accountId = searchParams.get("accountId");

    const transactions = getAllTransactions(100000, 0);
    const accounts = getAccounts();
    const budgets = getBudgets();
    const savingsGoals = getActiveSavingsGoals();

    // Build dashboard data
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const monthMap = new Map<string, { total: number; byCategory: Record<string, number> }>();
    const cashFlowMap = new Map<string, { income: number; expenses: number }>();

    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalIncome += tx.amount;
      } else {
        totalExpenses += Math.abs(tx.amount);
      }

      if (tx.category) {
        const existing = categoryMap.get(tx.category);
        if (existing) {
          existing.amount += Math.abs(tx.amount);
          existing.count += 1;
        } else {
          categoryMap.set(tx.category, {
            amount: Math.abs(tx.amount),
            count: 1,
          });
        }
      }

      const monthKey = getMonthKey(tx.date);
      const monthEntry = monthMap.get(monthKey);
      if (monthEntry) {
        monthEntry.total += Math.abs(tx.amount);
        if (tx.category) {
          monthEntry.byCategory[tx.category] =
            (monthEntry.byCategory[tx.category] || 0) + Math.abs(tx.amount);
        }
      } else {
        monthMap.set(monthKey, {
          total: Math.abs(tx.amount),
          byCategory: tx.category ? { [tx.category]: Math.abs(tx.amount) } : {},
        });
      }

      const cfEntry = cashFlowMap.get(monthKey);
      if (cfEntry) {
        if (tx.amount > 0) {
          cfEntry.income += tx.amount;
        } else {
          cfEntry.expenses += Math.abs(tx.amount);
        }
      } else {
        if (tx.amount > 0) {
          cashFlowMap.set(monthKey, { income: tx.amount, expenses: 0 });
        } else {
          cashFlowMap.set(monthKey, { income: 0, expenses: Math.abs(tx.amount) });
        }
      }
    }

    const totalNet = totalIncome - totalExpenses;

    const summary = {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netFlow: Math.round(totalNet * 100) / 100,
      transactionCount: transactions.length,
      uniqueCategories: categoryMap.size,
    };

    const spendingByCategory: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyTrends: MonthlySpending[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        total: Math.round(data.total * 100) / 100,
        byCategory: Object.fromEntries(
          Object.entries(data.byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const cashFlow: CashFlowEntry[] = Array.from(cashFlowMap.entries())
      .map(([month, data]) => ({
        month,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income - data.expenses) * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const recentTransactions = transactions
      .sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      })
      .slice(0, 20);

    const dashboardData: DashboardData = {
      summary,
      spendingByCategory,
      monthlyTrends,
      cashFlow,
      recentTransactions,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        currency: a.currency,
      })),
      budgets: budgets.map((b) => ({
        name: b.name,
        amount: b.amount,
        period: b.period,
        categoryId: b.category_id,
      })),
    };

    // Calculate safe-to-spend
    let safeToSpend: SafeToSpendResult | null = null;
    try {
      const { calculateDailySafeAmount, getDaysRemainingInMonth } = await import("@/lib/safe-to-spend/engine");
      const safeResult = calculateSafeToSpend(transactions, budgets, savingsGoals);
      const dailyResult = calculateDailySafeAmount(transactions, budgets, savingsGoals);
      const daysRemaining = getDaysRemainingInMonth();
      const goals = savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        monthlyContribution: g.monthly_contribution,
        deadline: g.deadline,
        isActive: g.is_active === 1,
      }));
      safeToSpend = {
        ...safeResult,
        dailySafeAmount: dailyResult.dailyAmount,
        remainingDays: daysRemaining,
        goals,
      };
    } catch {
      // Safe-to-spend is optional; continue without it
    }

    // Generate PDF synchronously by collecting all chunks
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve());
      doc.on("error", (err: Error) => reject(err));

      generateDashboardPdf(doc, dashboardData, safeToSpend);
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `sentry-ledger-report-${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json(
      { error: "Failed to export dashboard" },
      { status: 500 }
    );
  }
}
