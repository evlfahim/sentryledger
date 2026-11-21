/**
 * CSV Parser
 *
 * Parses bank CSV files with auto-detection of bank formats and column mapping wizard.
 * Uses papaparse for CSV parsing and supports multiple date/amount formats.
 */

import { parse as parseCSV } from "papaparse";
import {
  CsvFile,
  ParsedTransaction,
  ParseResult,
  WizardState,
  ColumnMapping,
  TargetField,
} from "./types";
import { detectBankProfile, BANK_PROFILES } from "./bank-profiles";

// ─── Date Parsing ─────────────────────────────────────────────────────────────

/**
 * Common date formats to try when parsing dates from CSV.
 * Order matters: more specific formats first.
 */
const DATE_FORMATS: { regex: RegExp; format: string }[] = [
  // MM/DD/YYYY
  { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: "MM/DD/YYYY" },
  // DD/MM/YYYY
  { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, format: "DD.MM.YYYY" },
  // YYYY-MM-DD
  { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, format: "YYYY-MM-DD" },
  // DD-MM-YYYY
  { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: "DD-MM-YYYY" },
  // Mon DD, YYYY or Month DD, YYYY
  {
    regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
    format: "MONTH DD, YYYY",
  },
  // DD Mon YYYY
  { regex: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/, format: "DD MONTH YYYY" },
];

/**
 * Month name to number mapping.
 */
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parse a date string into a Date object.
 * Returns null if no format matches.
 */
export function parseDate(dateStr: string): Date | null {
  if (typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();
  if (trimmed === "") return null;

  // Try each format
  for (const { regex, format } of DATE_FORMATS) {
    const match = trimmed.match(regex);
    if (match) {
      try {
        let year: number, month: number, day: number;

        if (format === "MM/DD/YYYY") {
          // MM/DD/YYYY
          month = parseInt(match[1], 10);
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        } else if (format === "DD.MM.YYYY") {
          // DD.MM.YYYY
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        } else if (format === "YYYY-MM-DD") {
          // YYYY-MM-DD
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
        } else if (format === "DD-MM-YYYY") {
          // DD-MM-YYYY
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        } else if (format === "MONTH DD, YYYY") {
          // Mon DD, YYYY or Month DD, YYYY
          const monthName = match[1].toLowerCase();
          month = MONTH_NAMES[monthName] || 0;
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        } else if (format === "DD MONTH YYYY") {
          // DD Mon YYYY
          day = parseInt(match[1], 10);
          const monthName = match[2].toLowerCase();
          month = MONTH_NAMES[monthName] || 0;
          year = parseInt(match[3], 10);
        } else {
          continue;
        }

        if (month < 1 || month > 12 || day < 1 || day > 31) continue;

        const date = new Date(year, month - 1, day);
        // Validate the date is real (e.g., Feb 30 is invalid)
        if (
          date.getFullYear() === year &&
          date.getMonth() === month - 1 &&
          date.getDate() === day
        ) {
          return date;
        }
        // Regex matched but date is invalid — don't fall through to native parsing
        return null;
      } catch {
        // Invalid date, try next format
      }
    }
  }

  // Try native Date parsing as fallback
  try {
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) {
      return native;
    }
  } catch {
    // Ignore
  }

  return null;
}

// ─── Amount Parsing ───────────────────────────────────────────────────────────

/**
 * Parse an amount string into a number.
 * Handles formats like:
 * - "100.50" -> 100.50
 * - "-100.50" -> -100.50
 * - "(100.50)" -> -100.50 (accounting format)
 * - "$100.50" -> 100.50
 * - "€100,50" -> 100.50 (European format)
 * - "100,50" -> 100.50 (European format)
 * - "1,000.50" -> 1000.50
 */
export function parseAmount(amountStr: string): number | null {
  if (typeof amountStr !== "string") return null;

  let trimmed = amountStr.trim();

  if (trimmed === "" || trimmed === "-" || trimmed === "0") return 0;

  // Detect European format: if there's a comma but no period, treat comma as decimal
  const hasComma = trimmed.includes(",");
  const hasPeriod = trimmed.includes(".");

  if (hasComma && !hasPeriod) {
    // European format: "1.234,56" or "100,50"
    // Remove thousands separators (periods), replace decimal comma with period
    trimmed = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && hasPeriod) {
    // Could be "1,234.56" (US) or "1.234,56" (EU)
    // If period comes after comma, it's US format: "1,234.56"
    const lastComma = trimmed.lastIndexOf(",");
    const lastPeriod = trimmed.lastIndexOf(".");
    if (lastComma < lastPeriod) {
      // US format: remove commas
      trimmed = trimmed.replace(/,/g, "");
    } else {
      // EU format: remove periods, replace comma with period
      trimmed = trimmed.replace(/\./g, "").replace(",", ".");
    }
  }

  // Remove currency symbols and whitespace
  trimmed = trimmed.replace(/[$€£¥₹\s]/g, "");

  // Handle accounting format: (100.50) -> -100.50
  let isNegative = false;
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    isNegative = true;
    trimmed = trimmed.slice(1, -1);
  }

  // Parse the number
  const value = parseFloat(trimmed);
  if (isNaN(value)) return null;

  return isNegative ? -value : value;
}

// ─── CSV File Reading ─────────────────────────────────────────────────────────

/**
 * Read and parse a CSV file from its content.
 * Returns a CsvFile object with columns and rows.
 */
export function readCsvFile(content: string, fileName: string): CsvFile {
  const result = parseCSV(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimiter: "", // Auto-detect
  });

  if (result.errors.length > 0) {
    // Log warnings but continue parsing
    console.warn("CSV parsing warnings:", result.errors);
  }

  const columns = result.meta.fields || [];
  const rows = result.data as Record<string, string>[];

  return {
    fileName,
    content,
    columns,
    rows,
  };
}

// ─── Column Mapping Wizard ────────────────────────────────────────────────────

/**
 * Create a wizard state from a parsed CSV file.
 * Attempts auto-detection of bank profile and sets default mapping.
 */
export function createWizardState(
  csvFile: CsvFile,
  existingAccountIds?: string[]
): WizardState {
  // Detect bank profile
  const detectedProfile = detectBankProfile(csvFile.columns, BANK_PROFILES);

  // Start with default mapping from profile (if detected)
  let mapping: ColumnMapping = detectedProfile
    ? { ...detectedProfile.defaultMapping }
    : {};

  // Auto-map columns if not already set
  for (const target of ["date" as TargetField, "description" as TargetField, "amount" as TargetField]) {
    if (!mapping[target]) {
      const bestMatch = findBestColumnMatch(
        csvFile.columns,
        target,
        existingAccountIds
      );
      if (bestMatch) {
        mapping[target] = bestMatch;
      }
    }
  }

  // Generate preview with current mapping
  const { transactions, warnings } = parseTransactions(csvFile, mapping);

  return {
    availableColumns: csvFile.columns,
    mapping,
    preview: transactions,
    warnings,
  };
}

/**
 * Find the best matching column for a target field.
 * Uses keyword matching with priority.
 */
function findBestColumnMatch(
  columns: string[],
  target: TargetField,
  existingAccountIds?: string[]
): string | null {
  const lowerColumns = columns.map((c) => c.toLowerCase().trim());

  // Keywords to match for each target field (in priority order)
  const keywords: Record<TargetField, string[]> = {
    date: ["date", "posted", "transaction date", "post date", "value date"],
    description: [
      "description",
      "memo",
      "payee",
      "name",
      "details",
      "narrative",
      "reference",
    ],
    amount: [
      "amount",
      "debit",
      "credit",
      "withdrawal",
      "deposit",
      "purchase",
      "payment",
      "transaction amount",
    ],
  };

  const targetKeywords = keywords[target];

  // First pass: exact match
  for (const keyword of targetKeywords) {
    const idx = lowerColumns.findIndex((c) => c === keyword);
    if (idx !== -1) return columns[idx];
  }

  // Second pass: contains match
  for (const keyword of targetKeywords) {
    const idx = lowerColumns.findIndex((c) => c.includes(keyword));
    if (idx !== -1) return columns[idx];
  }

  // Third pass: partial match (for cases like "Trans Date" matching "date")
  for (const keyword of targetKeywords) {
    const idx = lowerColumns.findIndex((c) => {
      const words = keyword.split(/\s+/);
      return words.every((w) => c.includes(w));
    });
    if (idx !== -1) return columns[idx];
  }

  return null;
}

/**
 * Update the wizard state with a new column mapping.
 */
export function updateWizardMapping(
  csvFile: CsvFile,
  mapping: ColumnMapping,
  existingAccountIds?: string[]
): WizardState {
  const { transactions, warnings } = parseTransactions(csvFile, mapping);

  return {
    availableColumns: csvFile.columns,
    mapping,
    preview: transactions,
    warnings,
  };
}

// ─── Transaction Parsing ──────────────────────────────────────────────────────

/**
 * Parse transactions from a CSV file using the given column mapping.
 */
export function parseTransactions(
  csvFile: CsvFile,
  mapping: ColumnMapping
): { transactions: ParsedTransaction[]; warnings: string[] } {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const dateCol = mapping.date;
  const descCol = mapping.description;
  const amountCol = mapping.amount;

  if (!dateCol || !descCol || !amountCol) {
    warnings.push("Missing required column mappings (date, description, amount)");
    return { transactions, warnings };
  }

  for (let i = 0; i < csvFile.rows.length; i++) {
    const row = csvFile.rows[i];
    const dateStr = row[dateCol] || "";
    const descStr = row[descCol] || "";
    const amountStr = row[amountCol] || "";

    // Skip empty rows
    if (!dateStr && !descStr && !amountStr) continue;

    const dateValue = parseDate(dateStr);
    const amountValue = parseAmount(amountStr);

    if (!dateValue) {
      warnings.push(
        `Row ${i + 1}: Could not parse date "${dateStr}"`
      );
    }

    if (amountValue === null) {
      warnings.push(
        `Row ${i + 1}: Could not parse amount "${amountStr}"`
      );
    }

    transactions.push({
      date: dateStr,
      description: descStr,
      amount: amountStr,
      amountValue: amountValue ?? 0,
      dateValue,
      isCredit: amountValue !== null && amountValue > 0,
    });
  }

  return { transactions, warnings };
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Check for potential duplicates among the parsed transactions.
 * Two transactions are considered duplicates if they have the same date,
 * description (case-insensitive), and amount (within $0.01).
 */
export function findDuplicates(
  transactions: ParsedTransaction[]
): { csvRowIndex: number; duplicateWith: number }[] {
  const duplicates: { csvRowIndex: number; duplicateWith: number }[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (!t.dateValue || t.amountValue === 0) continue;

    // Create a dedup key
    const key = `${t.dateValue.toISOString().split("T")[0]}|${t.description
      .toLowerCase()
      .trim()}|${Math.abs(t.amountValue).toFixed(2)}`;

    if (seen.has(key)) {
      duplicates.push({
        csvRowIndex: i,
        duplicateWith: seen.get(key)!,
      });
    } else {
      seen.set(key, i);
    }
  }

  return duplicates;
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Export parsed transactions to CSV format.
 */
export function exportToCsv(transactions: ParsedTransaction[]): string {
  const header = "Date,Description,Amount";
  const rows = transactions.map((t) => {
    const dateStr = t.dateValue
      ? `${t.dateValue.getFullYear()}-${String(t.dateValue.getMonth() + 1).padStart(2, "0")}-${String(t.dateValue.getDate()).padStart(2, "0")}`
      : t.date;
    return `${dateStr},"${t.description.replace(/"/g, '""')}","${t.amount}"`;
  });

  return [header, ...rows].join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a CSV file and return the result with auto-detection.
 */
export function parseCsvFile(
  content: string,
  fileName: string,
  existingAccountIds?: string[]
): ParseResult {
  const csvFile = readCsvFile(content, fileName);

  // Detect bank profile
  const detectedProfile = detectBankProfile(csvFile.columns, BANK_PROFILES);

  // Create wizard state
  const wizardState = createWizardState(csvFile, existingAccountIds);

  // Determine if mapping is required
  const mappingRequired =
    !wizardState.mapping.date ||
    !wizardState.mapping.description ||
    !wizardState.mapping.amount;

  return {
    transactions: wizardState.preview,
    warnings: wizardState.warnings,
    autoDetected: detectedProfile !== null,
    detectedBank: detectedProfile?.name ?? null,
    availableColumns: csvFile.columns,
    mappingRequired,
  };
}

/**
 * Parse transactions using a specific column mapping.
 */
export function parseWithMapping(
  content: string,
  fileName: string,
  mapping: ColumnMapping,
  existingAccountIds?: string[]
): ParseResult {
  const csvFile = readCsvFile(content, fileName);
  const wizardState = updateWizardMapping(csvFile, mapping, existingAccountIds);

  return {
    transactions: wizardState.preview,
    warnings: wizardState.warnings,
    autoDetected: false,
    detectedBank: null,
    availableColumns: csvFile.columns,
    mappingRequired: false,
  };
}
