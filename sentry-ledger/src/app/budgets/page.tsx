/**
 * Budget Management Page
 *
 * Full budget management: create, edit, delete budgets, view progress
 * against imported transactions, and see alerts.
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/app/components/ui";
import {
  formatCurrency,
  formatPercent,
  type BudgetCategorySummary,
  type BudgetSummary,
  type OverallBudgetSummary,
} from "@/lib/budgets/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Budget {
  id: string;
  name: string;
  categoryId: string;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
}

interface BudgetFormData {
  name: string;
  categoryId: string;
  amount: string;
  period: "weekly" | "monthly" | "yearly";
}

type ModalMode = "create" | "edit" | null;

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// ─── Components ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: string }) {
  const steps: { key: string; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "budgets", label: "Budgets" },
  ];

  const stepOrder = steps.map((s) => s.key);
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs mt-1 ${
                i <= currentIndex
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-12 h-0.5 mx-2 transition-colors ${
                i < currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function OverviewPanel({
  summary,
  categories,
  onSwitchToBudgets,
}: {
  summary: OverallBudgetSummary | null;
  categories: string[];
  onSwitchToBudgets: () => void;
}) {
  if (!summary) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Budgets Yet</h3>
        <p className="text-muted-foreground mb-4">
          Create budgets to track your spending by category.
        </p>
        <button
          onClick={onSwitchToBudgets}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Create Your First Budget
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-6 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Budgeted</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.totalBudgeted)}</p>
        </div>
        <div className="p-6 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
          <p className={`text-2xl font-bold ${summary.totalSpent > summary.totalBudgeted ? "text-red-500" : ""}`}>
            {formatCurrency(summary.totalSpent)}
          </p>
        </div>
        <div className="p-6 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-1">Remaining</p>
          <p className={`text-2xl font-bold ${summary.totalRemaining < 0 ? "text-red-500" : "text-green-500"}`}>
            {formatCurrency(summary.totalRemaining)}
          </p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-8 p-6 bg-card rounded-lg border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Overall Budget Progress</h3>
          <span className="text-sm font-medium">{formatPercent(summary.overallPercentage)}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              summary.overallPercentage > 100
                ? "bg-red-500"
                : summary.overallPercentage > 80
                ? "bg-amber-500"
                : "bg-primary"
            }`}
            style={{ width: `${Math.min(summary.overallPercentage, 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {formatCurrency(summary.totalSpent)} of {formatCurrency(summary.totalBudgeted)} spent
        </p>
      </div>

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <div className="mb-8">
          <h3 className="font-semibold mb-3">Alerts</h3>
          <div className="space-y-2">
            {summary.alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  alert.level === "over"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <svg
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      alert.level === "over" ? "text-red-500" : "text-amber-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={
                        alert.level === "over"
                          ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          : "M12 9v2m0 4h.01"
                      }
                    />
                  </svg>
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    {alert.level === "over" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Over by {formatCurrency(alert.overAmount)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {summary.categoryBreakdown.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Category Breakdown</h3>
          <div className="space-y-3">
            {summary.categoryBreakdown.map((cat, i) => (
              <div key={i} className="p-4 bg-card rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budgeted)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cat.isOver
                        ? "bg-red-500"
                        : cat.percentage >= 80
                        ? "bg-amber-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {cat.transactionCount} transaction{cat.transactionCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs font-medium">{formatPercent(cat.percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetCard({
  budget,
  summary,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  summary: BudgetSummary | undefined;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}) {
  const catSummary = summary?.categorySummary;
  const alertLevel = summary?.alertLevel || "ok";

  return (
    <div className="p-6 bg-card rounded-lg border border-border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{budget.name}</h3>
          <p className="text-sm text-muted-foreground">{budget.categoryId}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(budget)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Edit budget"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(budget.id)}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-500"
            title="Delete budget"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Budget amount */}
      <div className="mb-4">
        <span className="text-2xl font-bold">{formatCurrency(budget.amount)}</span>
        <span className="text-sm text-muted-foreground ml-2">/ {budget.period}</span>
      </div>

      {/* Progress bar */}
      {catSummary && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {formatCurrency(catSummary.spent)} spent
            </span>
            <span className="text-sm font-medium">{formatPercent(catSummary.percentage)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${
                alertLevel === "over"
                  ? "bg-red-500"
                  : alertLevel === "warning"
                  ? "bg-amber-500"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min(catSummary.percentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {catSummary.transactionCount} transaction{catSummary.transactionCount !== 1 ? "s" : ""}
            </span>
            <span
              className={`text-xs font-medium ${
                catSummary.isOver
                  ? "text-red-500"
                  : catSummary.remaining < 0
                  ? "text-red-500"
                  : "text-green-500"
              }`}
            >
              {catSummary.isOver
                ? `Over by ${formatCurrency(Math.abs(catSummary.remaining))}`
                : `${formatCurrency(catSummary.remaining)} remaining`}
            </span>
          </div>
        </>
      )}

      {/* No data yet */}
      {!catSummary && (
        <p className="text-sm text-muted-foreground">
          No transactions yet for this category
        </p>
      )}
    </div>
  );
}

function BudgetModal({
  mode,
  budget,
  categories,
  onSave,
  onClose,
}: {
  mode: ModalMode;
  budget: Budget | null;
  categories: string[];
  onSave: (data: BudgetFormData) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<BudgetFormData>({
    name: budget?.name || "",
    categoryId: budget?.categoryId || (categories[0] || ""),
    amount: budget?.amount?.toString() || "",
    period: budget?.period || "monthly",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (budget && mode === "edit") {
      setFormData({
        name: budget.name,
        categoryId: budget.categoryId,
        amount: budget.amount.toString(),
        period: budget.period,
      });
    } else if (mode === "create") {
      setFormData({
        name: "",
        categoryId: categories[0] || "",
        amount: "",
        period: "monthly",
      });
    }
  }, [budget, mode, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Budget name is required";
    }
    if (!formData.categoryId) {
      newErrors.categoryId = "Category is required";
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    if (amount > 1000000) {
      newErrors.amount = "Amount must be less than 1,000,000";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...formData,
      amount: formData.amount,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {mode === "create" ? "Create Budget" : "Edit Budget"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Budget name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Budget Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g., Monthly Groceries"
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="text-sm text-red-500 mt-1">{errors.categoryId}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Budget Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0.00"
            />
            {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Period
            </label>
            <select
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value as "weekly" | "monthly" | "yearly" })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {mode === "create" ? "Create Budget" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function BudgetsPage() {
  const [view, setView] = useState<"overview" | "budgets">("overview");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<OverallBudgetSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch budgets and categories
  const fetchBudgets = useCallback(async () => {
    try {
      const [budgetsRes, categoriesRes] = await Promise.all([
        fetch("/api/budgets"),
        fetch("/api/budgets?action=categories"),
      ]);
      const budgetsData = await budgetsRes.json();
      const categoriesData = await categoriesRes.json();
      setBudgets(budgetsData.budgets || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      console.error("Failed to fetch budgets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch budget calculation
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/budgets?action=calculate");
      const data = await res.json();
      setSummary(data.summary || null);
    } catch (error) {
      console.error("Failed to fetch budget summary:", error);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
    fetchSummary();
  }, [fetchBudgets, fetchSummary]);

  // Handle creating a budget
  const handleCreate = async (data: BudgetFormData) => {
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          categoryId: data.categoryId,
          amount: parseFloat(data.amount),
          period: data.period,
        }),
      });

      if (res.ok) {
        await fetchBudgets();
        await fetchSummary();
        setModalMode(null);
      }
    } catch (error) {
      console.error("Failed to create budget:", error);
    }
  };

  // Handle editing a budget
  const handleEdit = async (data: BudgetFormData) => {
    if (!editingBudget) return;

    try {
      const res = await fetch(`/api/budgets?id=${editingBudget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          categoryId: data.categoryId,
          amount: parseFloat(data.amount),
          period: data.period,
        }),
      });

      if (res.ok) {
        await fetchBudgets();
        await fetchSummary();
        setModalMode(null);
        setEditingBudget(null);
      }
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
  };

  // Handle deleting a budget
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/budgets?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchBudgets();
        await fetchSummary();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Failed to delete budget:", error);
    }
  };

  // Get summary for a specific budget
  const getBudgetSummary = (budgetId: string): BudgetSummary | undefined => {
    return summary?.budgets.find((b) => b.budget.id === budgetId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">SentryLedger</h1>
            <div className="flex items-center gap-6">
              <a href="/import" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Import
              </a>
              <a href="/rules" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Rules
              </a>
              <a href="/budgets" className="text-sm font-medium text-primary">
                Budgets
              </a>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading budgets...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Budget Management</h1>
              <p className="text-muted-foreground text-sm">
                Set spending limits and track your progress against imported transactions.
              </p>
            </div>
            <button
              onClick={() => {
                setModalMode("create");
                setEditingBudget(null);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Budget
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2 mb-8 p-1 bg-muted rounded-lg w-fit">
            <button
              onClick={() => setView("overview")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "overview"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("budgets")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === "budgets"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Budgets ({budgets.length})
            </button>
          </div>

          {/* Content */}
          {view === "overview" ? (
            <OverviewPanel
              summary={summary}
              categories={categories}
              onSwitchToBudgets={() => setView("budgets")}
            />
          ) : (
            <>
              {budgets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11a3 3 0 116 0 3 3 0 01-6 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Budgets Created</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first budget to start tracking spending by category.
                  </p>
                  <button
                    onClick={() => {
                      setModalMode("create");
                      setEditingBudget(null);
                    }}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Create Budget
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {budgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      summary={getBudgetSummary(budget.id)}
                      onEdit={(b) => {
                        setEditingBudget(b);
                        setModalMode("edit");
                      }}
                      onDelete={(id) => setDeleteConfirm(id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Create/Edit Modal */}
        {(modalMode === "create" || modalMode === "edit") && (
          <BudgetModal
            mode={modalMode}
            budget={editingBudget}
            categories={categories}
            onSave={modalMode === "create" ? handleCreate : handleEdit}
            onClose={() => {
              setModalMode(null);
              setEditingBudget(null);
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6">
              <h3 className="text-lg font-bold mb-2">Delete Budget</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this budget? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
