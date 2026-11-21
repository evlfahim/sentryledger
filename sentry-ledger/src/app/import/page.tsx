/**
 * Import Page
 *
 * Full import flow: file upload → column mapping → account selection → preview → commit.
 * Handles duplicate detection, transaction preview, and database commit via API route.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  parseCsvFile,
  parseWithMapping,
  findDuplicates,
  type ParseResult,
  type ParsedTransaction,
  type ColumnMapping,
  type CsvFile,
} from "@/lib/csv";
import { readCsvFile } from "@/lib/csv/parser";
import { AppLayout } from "@/app/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

type ImportStep = "upload" | "mapping" | "preview" | "complete";

interface ImportState {
  step: ImportStep;
  fileName: string;
  csvFile: CsvFile | null;
  parseResult: ParseResult | null;
  mapping: ColumnMapping;
  preview: ParsedTransaction[];
  warnings: string[];
  internalDuplicates: { csvRowIndex: number; duplicateWith: number }[];
  accountId: string;
  accountName: string;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  existingDuplicates: { index: number; existingTransaction: any }[];
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Components ──────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: ImportStep }) {
  const steps: { key: ImportStep; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Map" },
    { key: "preview", label: "Preview" },
    { key: "complete", label: "Done" },
  ];

  const stepOrder = steps.map((s) => s.key);
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4 mb-8">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i <= currentIndex
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs mt-1.5 hidden sm:block ${
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
              className={`w-8 md:w-12 h-0.5 mx-1 md:mx-2 transition-colors ${
                i < currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FileUploadArea({
  onFileSelect,
}: {
  onFileSelect: (file: File) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="max-w-xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Drop your CSV file here
        </h3>
        <p className="text-muted-foreground mb-4 text-sm">
          or click to browse your files
        </p>
        <p className="text-xs text-muted-foreground">
          Supports CSV files from Chase, Bank of America, Wells Fargo, and more
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    </div>
  );
}

function ColumnMappingWizard({
  csvFile,
  parseResult,
  mapping,
  onMappingChange,
  onContinue,
  onBack,
}: {
  csvFile: CsvFile;
  parseResult: ParseResult;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const targetFields: { key: "date" | "description" | "amount"; label: string }[] =
    [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
    ];

  const handleMappingChange = (field: "date" | "description" | "amount", value: string) => {
    onMappingChange({ ...mapping, [field]: value });
  };

  const allMapped = mapping.date && mapping.description && mapping.amount;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Map Your Columns</h2>
        <p className="text-muted-foreground text-sm">
          {parseResult.autoDetected
            ? `Detected ${parseResult.detectedBank} format. Review and adjust the column mapping below.`
            : "We couldn't auto-detect your bank format. Please map the columns manually."}
        </p>
        {parseResult.warnings.length > 0 && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              <strong>Warnings:</strong> {parseResult.warnings.join(" ")}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-8">
        {targetFields.map((field) => (
          <div key={field.key} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <label className="w-32 text-sm font-medium text-muted-foreground shrink-0">
              {field.label}
            </label>
            <select
              value={mapping[field.key] || ""}
              onChange={(e) => handleMappingChange(field.key, e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              <option value="">— Select —</option>
              {csvFile.columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={!allMapped}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            allMapped
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Preview Transactions →
        </button>
      </div>
    </div>
  );
}

function TransactionPreview({
  preview,
  internalDuplicates,
  existingDuplicates,
  accounts,
  accountId,
  onAccountChange,
  onCommit,
  onBack,
}: {
  preview: ParsedTransaction[];
  internalDuplicates: { csvRowIndex: number; duplicateWith: number }[];
  existingDuplicates: { index: number; existingTransaction: any }[];
  accounts: { id: string; name: string }[];
  accountId: string;
  onAccountChange: (accountId: string, accountName: string) => void;
  onCommit: () => void;
  onBack: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayCount = showAll ? preview.length : 20;

  const internalDupSet = new Set(
    preview.map((_, i) => i).filter((i) =>
      internalDuplicates.some((d) => d.csvRowIndex === i)
    )
  );
  const existingDupSet = new Set(existingDuplicates.map((d) => d.index));

  const totalDebits = preview
    .filter((t) => t.amountValue < 0)
    .reduce((sum, t) => sum + Math.abs(t.amountValue), 0);
  const totalCredits = preview
    .filter((t) => t.amountValue > 0)
    .reduce((sum, t) => sum + t.amountValue, 0);

  const accountName =
    accounts.find((a) => a.id === accountId)?.name || "Select an account";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Review Transactions</h2>
        <p className="text-muted-foreground text-sm">
          Importing {preview.length} transactions
        </p>

        {/* Account selector */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Account:
          </label>
          <select
            value={accountId}
            onChange={(e) => {
              const acc = accounts.find((a) => a.id === e.target.value);
              if (acc) onAccountChange(acc.id, acc.name);
            }}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const name = prompt("Enter account name:");
              if (name && name.trim()) {
                onAccountChange("__new__", name.trim());
              }
            }}
            className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            + New Account
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <SummaryStat label="Total" value={preview.length.toString()} />
        <SummaryStat label="Debits" value={formatAmount(totalDebits)} color="text-red-500" />
        <SummaryStat label="Credits" value={formatAmount(totalCredits)} color="text-green-500" />
        <SummaryStat label="Duplicates" value={(internalDuplicates.length + existingDuplicates.length).toString()} color="text-amber-500" />
      </div>

      {/* Duplicates warning */}
      {(internalDuplicates.length > 0 || existingDuplicates.length > 0) && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Duplicate Transactions Detected
          </h4>
          {existingDuplicates.length > 0 && (
            <div className="mb-2">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {existingDuplicates.length} transaction(s) already exist in your database:
              </p>
              <ul className="mt-1 text-sm text-muted-foreground ml-4 list-disc">
                {existingDuplicates.map((dup, i) => (
                  <li key={i}>
                    {dup.existingTransaction.description} —{" "}
                    {formatAmount(dup.existingTransaction.amount)} on{" "}
                    {new Date(dup.existingTransaction.date).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {internalDuplicates.length > 0 && (
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {internalDuplicates.length} internal duplicate(s) in this CSV:
              </p>
              <ul className="mt-1 text-sm text-muted-foreground ml-4 list-disc">
                {internalDuplicates.map((dup, i) => (
                  <li key={i}>
                    Row {dup.csvRowIndex + 1} is a duplicate of row{" "}
                    {dup.duplicateWith + 1}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Transaction table */}
      <div className="border border-border rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Description
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Amount
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Type
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, displayCount).map((tx, i) => {
                const isInternalDup = internalDupSet.has(i);
                const existingDup = existingDuplicates.find(
                  (d) => d.index === i
                );
                return (
                  <tr
                    key={i}
                    className={`border-t border-border ${
                      isInternalDup || existingDup
                        ? "bg-amber-500/5"
                        : i % 2 === 0
                        ? "bg-card"
                        : "bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(tx.dateValue)}
                    </td>
                    <td className="px-4 py-3 max-w-[250px] truncate">{tx.description}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        tx.amountValue < 0
                          ? "text-red-500"
                          : tx.amountValue > 0
                          ? "text-green-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatAmount(tx.amountValue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.isCredit ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                          Credit
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 rounded-full">
                          Debit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {existingDup ? (
                        <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                          Exists
                        </span>
                      ) : isInternalDup ? (
                        <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                          Dup
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {preview.length > 20 && (
          <div className="px-4 py-3 border-t border-border text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary hover:underline"
            >
              {showAll ? "Show Less" : `Show All ${preview.length} Transactions`}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onCommit}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          Import {preview.length} Transactions
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color || ""}`}>{value}</p>
    </div>
  );
}

function ImportComplete({
  importedCount,
  duplicateCount,
  failedCount,
  onNewImport,
}: {
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  onNewImport: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
        <p className="text-muted-foreground text-sm">
          Your transactions have been successfully imported.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
        <SummaryStat label="Imported" value={importedCount.toString()} color="text-green-500" />
        <SummaryStat label="Duplicates" value={duplicateCount.toString()} color="text-amber-500" />
        <SummaryStat label="Failed" value={failedCount.toString()} color="text-red-500" />
      </div>

      <button
        onClick={onNewImport}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
      >
        Import Another File
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [state, setState] = useState<ImportState>({
    step: "upload",
    fileName: "",
    csvFile: null,
    parseResult: null,
    mapping: {},
    preview: [],
    warnings: [],
    internalDuplicates: [],
    accountId: "",
    accountName: "",
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    existingDuplicates: [],
  });

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load accounts on mount
  useEffect(() => {
    fetch("/api/import")
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) {
          setAccounts(data.accounts);
          if (data.accounts.length > 0) {
            setState((prev) => ({
              ...prev,
              accountId: data.accounts[0].id,
              accountName: data.accounts[0].name,
            }));
          }
        }
      })
      .catch(() => {
        // Silently fail — accounts will be created on import
      });
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const csvFile = readCsvFile(content, file.name);
        const parseResult = parseCsvFile(content, file.name);

        // Auto-detect mapping from bank profile
        let autoMapping: ColumnMapping = {};
        if (parseResult.autoDetected && parseResult.availableColumns.length >= 3) {
          autoMapping = {
            date: parseResult.availableColumns[0] || "",
            description: parseResult.availableColumns[1] || "",
            amount: parseResult.availableColumns[2] || "",
          };
        }

        setState((prev) => ({
          ...prev,
          fileName: file.name,
          csvFile,
          parseResult,
          step: "mapping",
          mapping: autoMapping,
        }));
      } catch (err) {
        setError("Failed to parse CSV file. Please check the format.");
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  }, []);

  const handleMappingChange = useCallback((mapping: ColumnMapping) => {
    setState((prev) => ({ ...prev, mapping }));
  }, []);

  const handleContinueToPreview = useCallback(() => {
    if (!state.csvFile || !state.parseResult) return;

    try {
      const result = parseWithMapping(
        state.csvFile.content,
        state.csvFile.fileName,
        state.mapping
      );

      const internalDups = findDuplicates(result.transactions);

      setState((prev) => ({
        ...prev,
        parseResult: result,
        preview: result.transactions,
        warnings: result.warnings,
        internalDuplicates: internalDups,
        step: "preview",
      }));
    } catch (err) {
      setError("Failed to parse transactions with the selected mapping.");
    }
  }, [state.csvFile, state.parseResult, state.mapping]);

  const handleAccountChange = useCallback((accountId: string, accountName: string) => {
    if (accountId === "__new__") {
      // Create new account via API
      fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName,
          transactions: [], // Empty to just create account
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.accountId) {
            setAccounts((prev) => [
              ...prev,
              { id: data.accountId, name: accountName },
            ]);
            setState((prev) => ({
              ...prev,
              accountId: data.accountId,
              accountName,
            }));
          }
        })
        .catch(() => setError("Failed to create account."));
    } else {
      setState((prev) => ({ ...prev, accountId, accountName }));
    }
  }, []);

  const handleCommit = useCallback(() => {
    setError(null);

    // Check for existing duplicates first, then import
    const importData = state.preview.map((tx) => ({
      date: tx.dateValue ? tx.dateValue.toISOString() : tx.date,
      description: tx.description,
      amount: tx.amountValue,
    }));

    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: state.accountId || undefined,
        accountName: state.accountName || undefined,
        transactions: importData,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }

        // Update existing duplicates list from server response
        setState((prev) => ({
          ...prev,
          existingDuplicates: data.existingDuplicates || [],
          step: "complete",
          importedCount: data.imported,
          duplicateCount: data.duplicates,
          failedCount: data.failed,
          accountId: data.accountId || prev.accountId,
          accountName: data.accountName || prev.accountName,
        }));
      })
      .catch(() => {
        setError("Failed to import transactions. Please try again.");
      });
  }, [state.preview, state.accountId, state.accountName]);

  const handleNewImport = useCallback(() => {
    setState({
      step: "upload",
      fileName: "",
      csvFile: null,
      parseResult: null,
      mapping: {},
      preview: [],
      warnings: [],
      internalDuplicates: [],
      accountId: "",
      accountName: "",
      importedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      existingDuplicates: [],
    });
    setError(null);
  }, []);

  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportCsv = useCallback(async () => {
    try {
      setExporting("csv");
      const res = await fetch("/api/export/csv");
      if (!res.ok) throw new Error("Failed to export CSV");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      a.download = disposition?.split("filename=")[1]?.replace(/"/g, "") || "transactions.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error:", err);
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    try {
      setExporting("pdf");
      const res = await fetch("/api/export/pdf");
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      a.download = disposition?.split("filename=")[1]?.replace(/"/g, "") || "report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }, []);

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Import Transactions</h1>
            <p className="text-muted-foreground text-sm">
              Import bank CSV files and categorize your spending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={exporting !== null}
              className="px-3 md:px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Export all transactions as CSV"
            >
              {exporting === "csv" ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="px-3 md:px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Export dashboard as PDF"
            >
              {exporting === "pdf" ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>

        <StepIndicator currentStep={state.step} />

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {state.step === "upload" && (
          <FileUploadArea onFileSelect={handleFileSelect} />
        )}

        {state.step === "mapping" && state.csvFile && state.parseResult && (
          <ColumnMappingWizard
            csvFile={state.csvFile}
            parseResult={state.parseResult}
            mapping={state.mapping}
            onMappingChange={handleMappingChange}
            onContinue={handleContinueToPreview}
            onBack={handleNewImport}
          />
        )}

        {state.step === "preview" && (
          <TransactionPreview
            preview={state.preview}
            internalDuplicates={state.internalDuplicates}
            existingDuplicates={state.existingDuplicates}
            accounts={accounts}
            accountId={state.accountId}
            onAccountChange={handleAccountChange}
            onCommit={handleCommit}
            onBack={() => setState((prev) => ({ ...prev, step: "mapping" }))}
          />
        )}

        {state.step === "complete" && (
          <ImportComplete
            importedCount={state.importedCount}
            duplicateCount={state.duplicateCount}
            failedCount={state.failedCount}
            onNewImport={handleNewImport}
          />
        )}
      </main>
    </AppLayout>
  );
}
