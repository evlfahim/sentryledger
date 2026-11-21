/**
 * CSV Parser Types
 *
 * Core type definitions for the CSV import system including bank profiles,
 * column mappings, parsed transactions, and import results.
 */

// ─── Column Mapping ───────────────────────────────────────────────────────────

/**
 * Target fields that every CSV import must map to.
 */
export type TargetField = "date" | "description" | "amount";

/**
 * Maps a target field to a CSV column name.
 * E.g. { date: "Transaction Date", description: "Description", amount: "Amount" }
 */
export type ColumnMapping = Partial<Record<TargetField, string>>;

// ─── Bank Profile ─────────────────────────────────────────────────────────────

/**
 * A known bank CSV format profile.
 * Each profile lists column name patterns (case-insensitive) that identify it.
 */
export interface BankProfile {
  /** Human-readable name */
  name: string;
  /** Column name patterns that identify this bank (case-insensitive) */
  columnPatterns: string[][];
  /** Default column mapping if the bank is detected */
  defaultMapping: ColumnMapping;
}

// ─── Parsed Transaction ───────────────────────────────────────────────────────

/**
 * A single parsed transaction ready for import.
 */
export interface ParsedTransaction {
  /** Date string from CSV (will be validated/normalized) */
  date: string;
  /** Transaction description / memo */
  description: string;
  /** Transaction amount as string (will be parsed to number) */
  amount: string;
  /** Parsed numeric amount */
  amountValue: number;
  /** Parsed date as Date object (null if unparseable) */
  dateValue: Date | null;
  /** Whether the amount is positive (credit/income) or negative (debit/expense) */
  isCredit: boolean;
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * A duplicate match found during import.
 */
export interface DuplicateMatch {
  /** The CSV row index (0-based) */
  csvRowIndex: number;
  /** The existing transaction ID in the database */
  existingTransactionId: string;
  /** The existing transaction date */
  existingDate: string;
  /** The existing transaction description */
  existingDescription: string;
  /** The existing transaction amount */
  existingAmount: number;
}

// ─── Import Result ────────────────────────────────────────────────────────────

/**
 * Result of parsing a CSV file.
 */
export interface ParseResult {
  /** All parsed transactions */
  transactions: ParsedTransaction[];
  /** Warnings about the import (e.g. unparseable dates) */
  warnings: string[];
  /** Whether the bank was auto-detected */
  autoDetected: boolean;
  /** Detected bank profile name (if any) */
  detectedBank: string | null;
  /** Available column names from the CSV header */
  availableColumns: string[];
  /** Whether column mapping is required (auto-detection failed) */
  mappingRequired: boolean;
}

/**
 * Result of committing an import to the database.
 */
export interface ImportResult {
  /** Number of transactions successfully imported */
  importedCount: number;
  /** Number of duplicates skipped */
  duplicateCount: number;
  /** Number of rows that failed to import */
  failedCount: number;
  /** Warnings generated during import */
  warnings: string[];
}

// ─── Column Mapping Wizard ────────────────────────────────────────────────────

/**
 * Wizard state for the column mapping step.
 */
export interface WizardState {
  /** Available columns from the CSV header */
  availableColumns: string[];
  /** Current mapping from target fields to CSV columns */
  mapping: ColumnMapping;
  /** Preview of parsed transactions using current mapping */
  preview: ParsedTransaction[];
  /** Warnings about the preview */
  warnings: string[];
}

/**
 * A CSV file that has been read but not yet parsed.
 */
export interface CsvFile {
  /** Original file name */
  fileName: string;
  /** Raw CSV content */
  content: string;
  /** Parsed header columns */
  columns: string[];
  /** Raw row data (each row is an object keyed by column name) */
  rows: Record<string, string>[];
}
