/**
 * Dashboard Page
 *
 * Main overview with Recharts visualizations:
 * - Spending by category (donut chart)
 * - Monthly spending trends (area chart)
 * - Cash flow (bar chart)
 * - Summary cards, recent transactions, accounts, budgets
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { AppLayout } from "@/app/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  uniqueCategories: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

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

interface TransactionRow {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  rule_id: string | null;
  is_bill: number;
  is_duplicate: number;
  created_at: string;
  updated_at: string;
}

interface DashboardData {
  summary: Summary;
  spendingByCategory: CategoryBreakdown[];
  monthlyTrends: MonthlySpending[];
  cashFlow: CashFlowEntry[];
  recentTransactions: TransactionRow[];
  accounts: { id: string; name: string; type: string; balance: number; currency: string }[];
  budgets: { name: string; amount: number; period: string; categoryId: string }[];
}

interface ChartColor {
  [key: string]: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: ChartColor = {
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

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"] || "#94a3b8";
}

// ─── Utility ─────────────────────────────────────────────────────────────────

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

function formatShortMonth(month: string): string {
  const [year, mon] = month.split("-");
  const date = new Date(parseInt(year), parseInt(mon) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

// ─── Components ──────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon,
  color,
  subtext,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="p-4 md:p-5 bg-card rounded-xl border border-border hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-xl md:text-2xl font-bold truncate">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-1 truncate">{subtext}</p>}
    </div>
  );
}

function SpendingDonutChart({ data }: { data: CategoryBreakdown[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No spending data to display</p>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.category,
    value: item.amount,
  }));

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="w-44 h-44 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getCategoryColor(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2 w-full max-h-56 overflow-y-auto">
        {data.slice(0, 8).map((item) => (
          <div key={item.category} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(item.category) }}
              />
              <span className="text-sm truncate">{item.category}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyTrendChart({ data }: { data: MonthlySpending[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No trend data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tickFormatter={formatShortMonth}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(value: number) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Month: ${formatMonth(label)}`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
            fontSize: "12px",
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="total"
          name="Total Spending"
          stroke="#2563eb"
          fillOpacity={1}
          fill="url(#colorSpending)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CashFlowChart({ data }: { data: CashFlowEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No cash flow data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tickFormatter={formatShortMonth}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(value: number) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === "income" ? "Income" : name === "expenses" ? "Expenses" : "Net",
          ]}
          labelFormatter={(label) => `Month: ${formatMonth(label)}`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
            fontSize: "12px",
          }}
        />
        <Legend />
        <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="net" name="Net" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RecentTransactionsTable({ transactions }: { transactions: TransactionRow[] }) {
  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <p className="text-sm">No recent transactions</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Date</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Category</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
              <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                {new Date(tx.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="py-2.5 px-4 font-medium max-w-[250px] truncate">{tx.description}</td>
              <td className="py-2.5 px-4">
                {tx.category ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: getCategoryColor(tx.category) + "20",
                      color: getCategoryColor(tx.category),
                    }}
                  >
                    {tx.category}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Uncategorized</span>
                )}
              </td>
              <td
                className={`py-2.5 px-4 text-right font-medium whitespace-nowrap ${
                  tx.amount >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {tx.amount >= 0 ? "+" : ""}
                {formatCurrency(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountBalances({ accounts }: { accounts: { id: string; name: string; type: string; balance: number; currency: string }[] }) {
  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">No accounts configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div key={account.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{account.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
          </div>
          <p
            className={`font-bold shrink-0 ${
              account.balance >= 0 ? "text-foreground" : "text-red-500"
            }`}
          >
            {formatCurrency(account.balance)}
          </p>
        </div>
      ))}
    </div>
  );
}

function BudgetOverview({ budgets }: { budgets: { name: string; amount: number; period: string; categoryId: string }[] }) {
  if (budgets.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">No budgets set</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {budgets.map((budget) => (
        <div key={budget.categoryId} className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm truncate">{budget.name}</span>
            <span className="text-xs text-muted-foreground capitalize shrink-0 ml-2">{budget.period}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: "100%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(budget.amount)} / {budget.period}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-500 text-lg mb-4 font-medium">{error}</p>
            <button
              onClick={fetchData}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No data available. Import some transactions to get started.</p>
            <Link href="/import" className="mt-4 inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Import Transactions
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { summary, spendingByCategory, monthlyTrends, cashFlow, recentTransactions, accounts, budgets } = data;

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Dashboard</h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Overview of your finances
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-3 md:px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <SummaryCard
            title="Total Income"
            value={formatCurrency(summary.totalIncome)}
            color="bg-green-500/10"
            icon={
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            }
          />
          <SummaryCard
            title="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            color="bg-red-500/10"
            icon={
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            }
          />
          <SummaryCard
            title="Net Flow"
            value={formatCurrency(summary.netFlow)}
            color={summary.netFlow >= 0 ? "bg-blue-500/10" : "bg-red-500/10"}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  className={summary.netFlow >= 0 ? "text-blue-500" : "text-red-500"}
                  d={summary.netFlow >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"}
                />
              </svg>
            }
            subtext={summary.netFlow >= 0 ? "Positive" : "Negative"}
          />
          <SummaryCard
            title="Transactions"
            value={summary.transactionCount.toString()}
            color="bg-purple-500/10"
            icon={
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <SummaryCard
            title="Categories"
            value={summary.uniqueCategories.toString()}
            color="bg-amber-500/10"
            icon={
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
          />
        </div>

        {/* Charts row 1: Spending by category + Monthly trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
          {/* Spending by category */}
          <div className="p-5 md:p-6 bg-card rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
            <SpendingDonutChart data={spendingByCategory} />
          </div>

          {/* Monthly trends */}
          <div className="p-5 md:p-6 bg-card rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Monthly Spending Trend</h3>
            <MonthlyTrendChart data={monthlyTrends} />
          </div>
        </div>

        {/* Cash flow chart */}
        <div className="p-5 md:p-6 bg-card rounded-xl border border-border mb-6 md:mb-8">
          <h3 className="text-lg font-semibold mb-4">Cash Flow</h3>
          <CashFlowChart data={cashFlow} />
        </div>

        {/* Bottom row: Recent transactions + Accounts + Budgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent transactions */}
          <div className="lg:col-span-2 p-5 md:p-6 bg-card rounded-xl border border-border">
            <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
            <RecentTransactionsTable transactions={recentTransactions} />
          </div>

          {/* Accounts & Budgets */}
          <div className="space-y-6">
            <div className="p-5 md:p-6 bg-card rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Accounts</h3>
              <AccountBalances accounts={accounts} />
            </div>
            <div className="p-5 md:p-6 bg-card rounded-xl border border-border">
              <h3 className="text-lg font-semibold mb-4">Budgets</h3>
              <BudgetOverview budgets={budgets} />
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
