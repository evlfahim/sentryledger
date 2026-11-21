/**
 * Rule Management Page
 *
 * Full CRUD interface for managing transaction categorization rules.
 * Supports adding, editing, reordering, testing, and deleting rules.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DEFAULT_RULES,
  validateRule,
  validateRuleRegex,
  testRule,
  type Rule,
} from "@/lib/rules";
import type { ParsedTransaction } from "@/lib/csv";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RuleFormData {
  name: string;
  description: string;
  regex: string;
  category: string;
  priority: number;
  isActive: boolean;
  minAmount: string;
  maxAmount: string;
  amountDirection: "debit" | "credit" | "any";
}

interface TestResult {
  matches: number;
  total: number;
  validation: string[];
  sampleMatches: ParsedTransaction[];
}

type ModalMode = "create" | "edit" | null;

// ─── Sample transactions for rule testing ────────────────────────────────────

const SAMPLE_TRANSACTIONS: ParsedTransaction[] = [
  { date: "2024-01-15", description: "Grocery Store", amount: "-50.00", amountValue: -50, dateValue: new Date("2024-01-15"), isCredit: false },
  { date: "2024-01-16", description: "Starbucks Coffee", amount: "-5.50", amountValue: -5.5, dateValue: new Date("2024-01-16"), isCredit: false },
  { date: "2024-01-17", description: "Gas Station", amount: "-40.00", amountValue: -40, dateValue: new Date("2024-01-17"), isCredit: false },
  { date: "2024-01-18", description: "Salary Deposit", amount: "3000.00", amountValue: 3000, dateValue: new Date("2024-01-18"), isCredit: true },
  { date: "2024-01-19", description: "Netflix Subscription", amount: "-15.99", amountValue: -15.99, dateValue: new Date("2024-01-19"), isCredit: false },
  { date: "2024-01-20", description: "Amazon Purchase", amount: "-29.99", amountValue: -29.99, dateValue: new Date("2024-01-20"), isCredit: false },
  { date: "2024-01-21", description: "Uber Ride", amount: "-12.50", amountValue: -12.5, dateValue: new Date("2024-01-21"), isCredit: false },
  { date: "2024-01-22", description: "Electric Bill", amount: "-85.00", amountValue: -85, dateValue: new Date("2024-01-22"), isCredit: false },
  { date: "2024-01-23", description: "Transfer from Savings", amount: "500.00", amountValue: 500, dateValue: new Date("2024-01-23"), isCredit: true },
  { date: "2024-01-24", description: "Pharmacy", amount: "-25.00", amountValue: -25, dateValue: new Date("2024-01-24"), isCredit: false },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
}

function emptyRuleForm(): RuleFormData {
  return {
    name: "",
    description: "",
    regex: "",
    category: "",
    priority: 0,
    isActive: true,
    minAmount: "",
    maxAmount: "",
    amountDirection: "any",
  };
}

function formToRule(form: RuleFormData, id?: string): Rule {
  return {
    id: id || crypto.randomUUID(),
    name: form.name,
    description: form.description,
    regex: form.regex,
    category: form.category,
    priority: form.priority,
    isActive: form.isActive,
    minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined,
    maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
    amountDirection: form.amountDirection,
  };
}

// ─── Components ──────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  index,
  total,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  onTest,
  testResult,
}: {
  rule: Rule;
  index: number;
  total: number;
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onTest: (rule: Rule) => void;
  testResult: TestResult | null;
}) {
  const regexError = validateRuleRegex(rule.regex);

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        rule.isActive
          ? "border-border bg-card"
          : "border-border bg-muted/30 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Rule info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              #{index + 1}
            </span>
            <h3 className="font-semibold truncate">{rule.name}</h3>
            {!rule.isActive && (
              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                Inactive
              </span>
            )}
          </div>

          {rule.description && (
            <p className="text-sm text-muted-foreground mb-2">
              {rule.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {rule.category}
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              /{rule.regex}/
            </span>
            {regexError && (
              <span className="text-xs text-red-500" title={regexError}>
                ⚠ Invalid regex
              </span>
            )}
            {rule.minAmount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ≥{formatAmount(rule.minAmount)}
              </span>
            )}
            {rule.maxAmount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ≤{formatAmount(rule.maxAmount)}
              </span>
            )}
            {rule.amountDirection && rule.amountDirection !== "any" && (
              <span className="text-xs text-muted-foreground">
                {rule.amountDirection === "debit" ? "↓" : "↑"}
              </span>
            )}
          </div>

          {/* Test result preview */}
          {testResult && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <span className="text-muted-foreground">
                Matches{" "}
                <strong className={testResult.matches > 0 ? "text-green-500" : "text-muted-foreground"}>
                  {testResult.matches}
                </strong>{" "}
                of {testResult.total} sample transactions
              </span>
              {testResult.validation.length > 0 && (
                <span className="text-red-500 ml-2">
                  • {testResult.validation[0]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Move up */}
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up (higher priority)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Move down */}
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down (lower priority)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Toggle active */}
          <button
            onClick={() => onToggleActive(rule.id, !rule.isActive)}
            className={`p-1.5 rounded transition-colors ${
              rule.isActive ? "text-green-500 hover:bg-green-500/10" : "text-muted-foreground hover:bg-muted"
            }`}
            title={rule.isActive ? "Deactivate" : "Activate"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {rule.isActive ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </>
              )}
            </svg>
          </button>

          {/* Test */}
          <button
            onClick={() => onTest(rule)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Test rule"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit rule"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete rule"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleModal({
  mode,
  rule,
  categories,
  onSave,
  onClose,
}: {
  mode: ModalMode;
  rule: Rule | null;
  categories: string[];
  onSave: (form: RuleFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RuleFormData>(emptyRuleForm());
  const [errors, setErrors] = useState<string[]>([]);
  const [regexError, setRegexError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "edit" && rule) {
      setForm({
        name: rule.name,
        description: rule.description,
        regex: rule.regex,
        category: rule.category,
        priority: rule.priority,
        isActive: rule.isActive,
        minAmount: rule.minAmount !== undefined ? rule.minAmount.toString() : "",
        maxAmount: rule.maxAmount !== undefined ? rule.maxAmount.toString() : "",
        amountDirection: rule.amountDirection || "any",
      });
    } else {
      setForm(emptyRuleForm());
    }
    setErrors([]);
    setRegexError(null);
  }, [mode, rule]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (mode) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mode, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (mode) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [mode, onClose]);

  const updateField = <K extends keyof RuleFormData>(field: K, value: RuleFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "regex") {
      setRegexError(validateRuleRegex(value as string));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateRule({
      name: form.name,
      regex: form.regex,
      category: form.category,
      minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined,
      maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(form);
  };

  if (!mode) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {mode === "create" ? "Create Rule" : "Edit Rule"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g., Coffee Shops"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Optional description of this rule"
              />
            </div>

            {/* Regex */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Regex Pattern <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.regex}
                onChange={(e) => updateField("regex", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono ${
                  regexError ? "border-red-500" : "border-border"
                }`}
                placeholder="e.g., starbucks|coffee|cafe"
              />
              {regexError && (
                <p className="mt-1 text-xs text-red-500">{regexError}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Case-insensitive regex. Test against transaction descriptions.
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g., Restaurants"
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Priority
              </label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => updateField("priority", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                min={0}
                max={1000}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Higher numbers = higher priority. First matching rule wins.
              </p>
            </div>

            {/* Amount Direction */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount Direction
              </label>
              <select
                value={form.amountDirection}
                onChange={(e) => updateField("amountDirection", e.target.value as "debit" | "credit" | "any")}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="any">Any</option>
                <option value="debit">Debit (expense)</option>
                <option value="credit">Credit (income)</option>
              </select>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  value={form.minAmount}
                  onChange={(e) => updateField("minAmount", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Optional"
                  min={0}
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Amount
                </label>
                <input
                  type="number"
                  value={form.maxAmount}
                  onChange={(e) => updateField("maxAmount", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Optional"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateField("isActive", !form.isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.isActive ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm font-medium">
                {form.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <ul className="text-sm text-red-500 list-disc list-inside">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

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
                {mode === "create" ? "Create Rule" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TestPanel({
  rule,
  onClose,
}: {
  rule: Rule | null;
  onClose: () => void;
}) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!rule) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/rules?action=test&name=${encodeURIComponent(rule.name)}&regex=${encodeURIComponent(rule.regex)}&category=${encodeURIComponent(rule.category)}&priority=${rule.priority}&isActive=${rule.isActive}&minAmount=${rule.minAmount ?? ""}&maxAmount=${rule.maxAmount ?? ""}&amountDirection=${rule.amountDirection}`
      );
      const data = await response.json();
      setTestResult(data);
    } catch {
      // Fallback: test locally
      const localResult = {
        matches: 0,
        total: SAMPLE_TRANSACTIONS.length,
        validation: validateRule(rule),
        sampleMatches: SAMPLE_TRANSACTIONS.filter((tx) => testRule(rule, tx)),
      };
      setTestResult(localResult);
    } finally {
      setLoading(false);
    }
  };

  if (!rule) return null;

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Test Rule: {rule.name}</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <button
        onClick={handleTest}
        disabled={loading}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Testing..." : "Test Against Sample Data"}
      </button>

      {testResult && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Matches:{" "}
              <strong className={testResult.matches > 0 ? "text-green-500" : "text-muted-foreground"}>
                {testResult.matches}
              </strong>{" "}
              / {testResult.total}
            </span>
            {testResult.validation.length > 0 && (
              <span className="text-xs text-red-500">
                • {testResult.validation[0]}
              </span>
            )}
          </div>

          {testResult.sampleMatches.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Matched transactions:
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {testResult.sampleMatches.map((tx, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 bg-card rounded border border-border">
                    <span className="text-muted-foreground font-mono w-20 shrink-0">
                      {tx.date}
                    </span>
                    <span className="truncate">{tx.description}</span>
                    <span className={`ml-auto font-mono ${tx.isCredit ? "text-green-500" : "text-red-500"}`}>
                      {formatAmount(tx.amountValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {testResult.sampleMatches.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No sample transactions matched this rule.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [testingRule, setTestingRule] = useState<Rule | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, categoriesRes] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/rules?action=categories"),
      ]);
      const rulesData = await rulesRes.json();
      const categoriesData = await categoriesRes.json();
      setRules(rulesData.rules || []);
      setCategories(categoriesData.categories || []);
    } catch {
      setError("Failed to load rules. Using default rules locally.");
      setRules(DEFAULT_RULES);
      // Extract categories from default rules
      const cats = new Set(DEFAULT_RULES.map((r) => r.category));
      setCategories(Array.from(cats));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setModalMode("create");
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setModalMode("edit");
  };

  const handleSave = async (form: RuleFormData) => {
    const rule = formToRule(form);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        setRules((prev) => [...prev, data.rule]);
      } else {
        const res = await fetch(`/api/rules?id=${editingRule?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule?.id ? rule : r))
        );
      }
      setModalMode(null);
      setEditingRule(null);
      // Refresh categories
      const catsRes = await fetch("/api/rules?action=categories");
      const catsData = await catsRes.json();
      setCategories(catsData.categories || []);
    } catch {
      setError("Failed to save rule.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    try {
      await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
      // Refresh categories
      const catsRes = await fetch("/api/rules?action=categories");
      const catsData = await catsRes.json();
      setCategories(catsData.categories || []);
    } catch {
      setError("Failed to delete rule.");
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/rules?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: active } : r))
      );
    } catch {
      setError("Failed to update rule.");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newRules = [...rules];
    const temp = newRules[index].priority;
    newRules[index] = { ...newRules[index], priority: newRules[index - 1].priority };
    newRules[index - 1] = { ...newRules[index - 1], priority: temp };

    try {
      await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: newRules.map((r, i) => ({ id: r.id, priority: newRules.length - i })),
        }),
      });
      setRules(newRules);
    } catch {
      setError("Failed to reorder rules.");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    const temp = newRules[index].priority;
    newRules[index] = { ...newRules[index], priority: newRules[index + 1].priority };
    newRules[index + 1] = { ...newRules[index + 1], priority: temp };

    try {
      await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: newRules.map((r, i) => ({ id: r.id, priority: newRules.length - i })),
        }),
      });
      setRules(newRules);
    } catch {
      setError("Failed to reorder rules.");
    }
  };

  const handleTest = async (rule: Rule) => {
    setTestingRule(rule);
    try {
      const res = await fetch(
        `/api/rules?action=test&name=${encodeURIComponent(rule.name)}&regex=${encodeURIComponent(rule.regex)}&category=${encodeURIComponent(rule.category)}&priority=${rule.priority}&isActive=${rule.isActive}&minAmount=${rule.minAmount ?? ""}&maxAmount=${rule.maxAmount ?? ""}&amountDirection=${rule.amountDirection}`
      );
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [rule.id]: data }));
    } catch {
      // Fallback: test locally
      const localResult = {
        matches: 0,
        total: SAMPLE_TRANSACTIONS.length,
        validation: validateRule(rule),
        sampleMatches: SAMPLE_TRANSACTIONS.filter((tx) => testRule(rule, tx)),
      };
      setTestResults((prev) => ({ ...prev, [rule.id]: localResult }));
    }
  };

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    if (!showInactive && !rule.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        rule.name.toLowerCase().includes(q) ||
        rule.regex.toLowerCase().includes(q) ||
        rule.category.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = rules.filter((r) => r.isActive).length;
  const totalCategories = new Set(rules.map((r) => r.category)).size;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Rule Manager</h1>
          <p className="text-muted-foreground">
            Create and manage rules to automatically categorize your transactions.
            Rules are applied in priority order (highest first).
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">Total Rules</p>
            <p className="text-2xl font-bold">{rules.length}</p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">{activeCount}</p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{totalCategories}</p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Rule
          </button>

          <div className="flex-1" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules..."
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm w-48"
          />

          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showInactive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {showInactive ? "Hide Inactive" : "Show Inactive"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading rules...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-lg font-semibold mb-2">No rules found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "No rules match your search. Try a different query."
                : "Create your first rule to start auto-categorizing transactions."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Create Rule
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={index}
                total={filteredRules.length}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onTest={handleTest}
                testResult={testResults[rule.id] || null}
              />
            ))}
          </div>
        )}

        {/* Test panel */}
        {testingRule && (
          <div className="mt-8">
            <TestPanel
              rule={testingRule}
              onClose={() => setTestingRule(null)}
            />
          </div>
        )}

        {/* Help text */}
        <div className="mt-12 p-6 bg-muted/30 rounded-lg border border-border">
          <h3 className="font-semibold mb-3">How Rules Work</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                <strong>Priority:</strong> Rules are evaluated in order of priority (highest first). The first matching rule categorizes the transaction.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                <strong>Regex:</strong> Use regular expressions to match transaction descriptions. Patterns are case-insensitive.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                <strong>Amount filters:</strong> Optionally restrict rules to specific amount ranges or directions (debit/credit).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                <strong>Testing:</strong> Use the test button to preview which sample transactions your rule would match.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                <strong>Reordering:</strong> Use the arrow buttons to change rule priority. Higher priority rules appear first.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Modal */}
      <RuleModal
        mode={modalMode}
        rule={editingRule}
        categories={categories}
        onSave={handleSave}
        onClose={() => {
          setModalMode(null);
          setEditingRule(null);
        }}
      />
    </div>
  );
}
