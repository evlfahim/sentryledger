/**
 * Safe-to-Spend Page
 *
 * Shows how much money is available for discretionary spending after
 * accounting for bills, budgeted spending, and savings goals.
 *
 * Features:
 * - Safe-to-spend amount prominently displayed
 * - Daily safe amount calculation
 * - Deductions breakdown (bills, budgets, savings)
 * - Savings goals management (create, edit, delete, track progress)
 * - Visual progress bars and color-coded alerts
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/app/components/ui";
import {
  formatCurrency,
  formatPercent,
  getDaysRemainingInMonth,
  type SavingsGoalInput,
  type UpdateSavingsGoalInput,
} from "@/lib/safe-to-spend/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SafeToSpendResult {
  totalIncome: number;
  totalBills: number;
  totalBudgetedSpending: number;
  totalSavingsGoals: number;
  safeToSpend: number;
  safeToSpendPercent: number;
  deductions: {
    label: string;
    amount: number;
    percentage: number;
  }[];
  isSafe: boolean;
  warning?: string;
}

interface SavingsGoalProgress {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  percentage: number;
  monthlyContribution: number;
  deadline?: string;
  daysUntilDeadline?: number;
  isComplete: boolean;
}

interface DailySafeAmount {
  dailyAmount: number;
  daysRemaining: number;
  totalSafe: number;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Components ──────────────────────────────────────────────────────────────

function SafeToSpendHero({ result, daily }: { result: SafeToSpendResult; daily: DailySafeAmount }) {
  const daysRemaining = getDaysRemainingInMonth();

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Safe to Spend</h2>
          <p className="text-sm text-muted-foreground">
            Available for discretionary spending this month
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            {daysRemaining} days remaining in {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Main safe-to-spend display */}
      <div className={`p-8 rounded-2xl border-2 text-center ${
        result.isSafe
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}>
        <p className="text-sm text-muted-foreground mb-2 font-medium uppercase tracking-wide">
          {result.isSafe ? "You're in the green" : "Over budget"}
        </p>
        <p className={`text-5xl font-bold mb-2 ${
          result.isSafe ? "text-green-500" : "text-red-500"
        }`}>
          {formatCurrency(result.safeToSpend)}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {formatPercent(result.safeToSpendPercent)} of income remaining
        </p>

        {/* Daily breakdown */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">
            {formatCurrency(daily.dailyAmount)} / day
          </span>
          <span className="text-xs text-muted-foreground">
            ({daily.daysRemaining} days)
          </span>
        </div>

        {/* Warning */}
        {result.warning && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-600 dark:text-amber-400">{result.warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeductionsBreakdown({ result }: { result: SafeToSpendResult }) {
  const totalDeductions = result.totalBills + result.totalBudgetedSpending + result.totalSavingsGoals;

  return (
    <div className="p-6 bg-card rounded-xl border border-border">
      <h3 className="text-lg font-semibold mb-4">Deductions Breakdown</h3>

      {/* Income bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Total Income</span>
          <span className="text-sm font-bold text-green-500">{formatCurrency(result.totalIncome)}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div className="h-full rounded-full bg-green-500" style={{ width: "100%" }} />
        </div>
      </div>

      {/* Deductions */}
      {result.deductions.map((deduction, i) => (
        <div key={i} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">{deduction.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatPercent(deduction.percentage)}</span>
              <span className="text-sm font-medium text-red-500">-{formatCurrency(deduction.amount)}</span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500/70"
              style={{ width: `${Math.min(deduction.percentage, 100)}%` }}
            />
          </div>
        </div>
      ))}

      {/* Total deductions */}
      {totalDeductions > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total Deductions</span>
            <span className="text-sm font-bold text-red-500">-{formatCurrency(totalDeductions)}</span>
          </div>
        </div>
      )}

      {/* Safe to spend summary */}
      <div className={`mt-4 pt-4 border-t-2 border-t-${result.isSafe ? "green" : "red"}-500`}>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold">Safe to Spend</span>
          <span className={`text-lg font-bold ${result.isSafe ? "text-green-500" : "text-red-500"}`}>
            {formatCurrency(result.safeToSpend)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SavingsGoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
}: {
  goal: SavingsGoalProgress;
  onEdit: (goal: SavingsGoalProgress) => void;
  onDelete: (name: string) => void;
  onContribute: (name: string, amount: number) => void;
}) {
  const [showContribute, setShowContribute] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");

  const handleContribute = () => {
    const amount = parseFloat(contributionAmount);
    if (amount > 0 && !isNaN(amount)) {
      onContribute(goal.name, amount);
      setContributionAmount("");
      setShowContribute(false);
    }
  };

  return (
    <div className={`p-5 rounded-xl border ${
      goal.isComplete
        ? "bg-green-500/5 border-green-500/20"
        : "bg-card border-border"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{goal.name}</h4>
            {goal.isComplete && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded-full font-medium">
                Complete
              </span>
            )}
          </div>
          {goal.deadline && (
            <p className="text-xs text-muted-foreground">
              Deadline: {formatDate(goal.deadline)}
              {goal.daysUntilDeadline !== undefined && ` (${goal.daysUntilDeadline} days left)`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!goal.isComplete && (
            <button
              onClick={() => setShowContribute(!showContribute)}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              title="Add contribution"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            title="Edit goal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(goal.name)}
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-500"
            title="Delete goal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">
            {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
          </span>
          <span className="text-sm font-medium">{formatPercent(goal.percentage)}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              goal.isComplete
                ? "bg-green-500"
                : goal.percentage >= 75
                ? "bg-amber-500"
                : "bg-primary"
            }`}
            style={{ width: `${Math.min(goal.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatCurrency(goal.remaining)} remaining
          {goal.monthlyContribution > 0 && ` · ${formatCurrency(goal.monthlyContribution)}/mo`}
        </span>
      </div>

      {/* Contribution form */}
      {showContribute && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              min="0"
              step="0.01"
            />
            <button
              onClick={handleContribute}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowContribute(false)}
              className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SavingsGoalModal({
  mode,
  goal,
  onSave,
  onClose,
}: {
  mode: "create" | "edit";
  goal: SavingsGoalProgress | null;
  onSave: (data: SavingsGoalInput) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<SavingsGoalInput>({
    name: goal?.name || "",
    targetAmount: goal?.targetAmount || 0,
    currentAmount: goal?.currentAmount || 0,
    monthlyContribution: goal?.monthlyContribution || 0,
    deadline: goal?.deadline || "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Goal name is required";
    }
    if (formData.targetAmount <= 0) {
      newErrors.targetAmount = "Target amount must be greater than 0";
    }
    if (formData.currentAmount < 0) {
      newErrors.currentAmount = "Current amount cannot be negative";
    }
    if (formData.currentAmount > formData.targetAmount) {
      newErrors.currentAmount = "Current amount cannot exceed target";
    }
    if (formData.monthlyContribution < 0) {
      newErrors.monthlyContribution = "Monthly contribution cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {goal ? "Edit Savings Goal" : "New Savings Goal"}
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
          {/* Goal name */}
          <div>
            <label className="block text-sm font-medium mb-1">Goal Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g., Emergency Fund"
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Target amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Target Amount</label>
            <input
              type="number"
              value={formData.targetAmount || ""}
              onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="10000"
              min="0"
              step="0.01"
            />
            {errors.targetAmount && <p className="text-sm text-red-500 mt-1">{errors.targetAmount}</p>}
          </div>

          {/* Current amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Current Amount</label>
            <input
              type="number"
              value={formData.currentAmount || ""}
              onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0"
              min="0"
              step="0.01"
            />
            {errors.currentAmount && <p className="text-sm text-red-500 mt-1">{errors.currentAmount}</p>}
          </div>

          {/* Monthly contribution */}
          <div>
            <label className="block text-sm font-medium mb-1">Monthly Contribution</label>
            <input
              type="number"
              value={formData.monthlyContribution || ""}
              onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0"
              min="0"
              step="0.01"
            />
            {errors.monthlyContribution && <p className="text-sm text-red-500 mt-1">{errors.monthlyContribution}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              How much you plan to save each month toward this goal
            </p>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium mb-1">Deadline (optional)</label>
            <input
              type="date"
              value={formData.deadline || ""}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {mode === "edit" ? "Update Goal" : "Create Goal"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SafeToSpendPage() {
  const [safeResult, setSafeResult] = useState<SafeToSpendResult | null>(null);
  const [dailyResult, setDailyResult] = useState<DailySafeAmount | null>(null);
  const [goals, setGoals] = useState<SavingsGoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalProgress | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch safe-to-spend calculation
      const safeRes = await fetch("/api/safe-to-spend?action=calculate");
      if (!safeRes.ok) throw new Error("Failed to fetch safe-to-spend data");
      const safeData = await safeRes.json();
      setSafeResult(safeData.result);

      // Fetch daily safe amount
      const dailyRes = await fetch("/api/safe-to-spend?action=daily");
      if (!dailyRes.ok) throw new Error("Failed to fetch daily safe amount");
      const dailyData = await dailyRes.json();
      setDailyResult(dailyData.daily);

      // Fetch savings goals
      const goalsRes = await fetch("/api/safe-to-spend?action=goals");
      if (!goalsRes.ok) throw new Error("Failed to fetch savings goals");
      const goalsData = await goalsRes.json();
      setGoals(goalsData.goals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveGoal = async (data: SavingsGoalInput) => {
    try {
      if (editingGoal) {
        // Update existing goal
        const res = await fetch(`/api/safe-to-spend?id=${editingGoal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update savings goal");
      } else {
        // Create new goal
        const res = await fetch("/api/safe-to-spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create savings goal");
      }
      setModalMode(null);
      setEditingGoal(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    }
  };

  const handleDeleteGoal = async (name: string) => {
    try {
      // Find the goal by name to get its ID
      const goal = goals.find((g) => g.name === name);
      if (!goal) throw new Error("Goal not found");

      const res = await fetch(`/api/safe-to-spend?id=${goal.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete savings goal");

      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    }
  };

  const handleContribute = async (name: string, amount: number) => {
    try {
      const goal = goals.find((g) => g.name === name);
      if (!goal) throw new Error("Goal not found");

      const res = await fetch(`/api/safe-to-spend?id=${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentAmount: goal.currentAmount + amount,
        }),
      });
      if (!res.ok) throw new Error("Failed to update goal");

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contribution");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading safe-to-spend data...</p>
        </div>
      </div>
    );
  }

  if (error && !safeResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-500 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Safe to Spend</h1>
            <p className="text-muted-foreground text-sm">
              Know exactly how much you can spend without worrying about bills or goals
            </p>
          </div>
          <button
            onClick={() => {
              setModalMode("create");
              setEditingGoal(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Goal
          </button>
        </div>

      {/* Safe-to-spend hero */}
      {safeResult && dailyResult && (
        <SafeToSpendHero result={safeResult} daily={dailyResult} />
      )}

      {/* Deductions breakdown */}
      {safeResult && <DeductionsBreakdown result={safeResult} />}

      {/* Savings Goals */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Savings Goals</h3>
        {goals.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-muted-foreground mb-3">No savings goals yet</p>
            <button
              onClick={() => {
                setModalMode("create");
                setEditingGoal(null);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <SavingsGoalCard
                key={goal.name}
                goal={goal}
                onEdit={(g) => {
                  setEditingGoal(g);
                  setModalMode("edit");
                }}
                onDelete={(name) => setDeleteConfirm(name)}
                onContribute={handleContribute}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalMode && (
        <SavingsGoalModal
          mode={modalMode}
          goal={editingGoal}
          onSave={handleSaveGoal}
          onClose={() => {
            setModalMode(null);
            setEditingGoal(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-2">Delete Savings Goal?</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete "{deleteConfirm}"? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDeleteGoal(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-muted-foreground hover:text-foreground rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      </main>
    </AppLayout>
  );
}
