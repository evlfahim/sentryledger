/**
 * Dashboard API route.
 *
 * Provides aggregated data for the dashboard:
 * - Monthly spending by category
 * - Monthly spending trends over time
 * - Cash flow (income vs expenses)
 * - Category breakdown with amounts
 * - Recent transactions
 * - Account balances
 */

import { NextResponse } from "next/server";
import {
  getAccounts,
  getAllTransactions,
  getBudgets,
  type TransactionRow,
  type AccountRow,
  type BudgetRow,
} from "@/lib/import/db";
import { getMonthlyEquivalent } from "@/lib/budgets/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthlySpending {
  month: string; // "YYYY-MM"
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // "YYYY-MM"
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// ─── GET: Dashboard data ─────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const months = searchParams.get("months");
    const numMonths = months ? parseInt(months) : 6;

    // Fetch all data
    const transactions = getAllTransactions(100000, 0);
    const accounts = getAccounts();
    const budgets = getBudgets();

    if (transactions.length === 0) {
      return NextResponse.json({
        summary: {
          totalIncome: 0,
          totalExpenses: 0,
          netFlow: 0,
          transactionCount: 0,
          uniqueCategories: 0,
        },
        spendingByCategory: [],
        monthlyTrends: [],
        cashFlow: [],
        recentTransactions: [],
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
      });
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();

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
    }

    const totalNet = totalIncome - totalExpenses;
    const uniqueCategories = categoryMap.size;

    const summary = {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netFlow: Math.round(totalNet * 100) / 100,
      transactionCount: transactions.length,
      uniqueCategories,
    };

    // ── Spending by category ─────────────────────────────────────────────────
    const spendingByCategory: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ── Monthly trends (spending by month) ───────────────────────────────────
    const monthMap = new Map<string, { total: number; byCategory: Record<string, number> }>();

    for (const tx of transactions) {
      const monthKey = getMonthKey(tx.date);
      const existing = monthMap.get(monthKey);
      if (existing) {
        existing.total += Math.abs(tx.amount);
        if (tx.category) {
          existing.byCategory[tx.category] =
            (existing.byCategory[tx.category] || 0) + Math.abs(tx.amount);
        }
      } else {
        monthMap.set(monthKey, {
          total: Math.abs(tx.amount),
          byCategory: tx.category ? { [tx.category]: Math.abs(tx.amount) } : {},
        });
      }
    }

    const monthlyTrends: MonthlySpending[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        total: Math.round(data.total * 100) / 100,
        byCategory: Object.fromEntries(
          Object.entries(data.byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ── Cash flow (income vs expenses by month) ──────────────────────────────
    const cashFlowMap = new Map<string, { income: number; expenses: number }>();

    for (const tx of transactions) {
      const monthKey = getMonthKey(tx.date);
      const existing = cashFlowMap.get(monthKey);
      if (existing) {
        if (tx.amount > 0) {
          existing.income += tx.amount;
        } else {
          existing.expenses += Math.abs(tx.amount);
        }
      } else {
        if (tx.amount > 0) {
          cashFlowMap.set(monthKey, { income: tx.amount, expenses: 0 });
        } else {
          cashFlowMap.set(monthKey, { income: 0, expenses: Math.abs(tx.amount) });
        }
      }
    }

    const cashFlow: CashFlowEntry[] = Array.from(cashFlowMap.entries())
      .map(([month, data]) => ({
        month,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income - data.expenses) * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ── Recent transactions ──────────────────────────────────────────────────
    const recentTransactions = transactions
      .sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      })
      .slice(0, 20);

    // ── Accounts ─────────────────────────────────────────────────────────────
    const accountsData = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      currency: a.currency,
    }));

    // ── Budgets ──────────────────────────────────────────────────────────────
    const budgetsData = budgets.map((b) => ({
      name: b.name,
      amount: b.amount,
      period: b.period,
      categoryId: b.category_id,
    }));

    return NextResponse.json({
      summary,
      spendingByCategory,
      monthlyTrends,
      cashFlow,
      recentTransactions,
      accounts: accountsData,
      budgets: budgetsData,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
