/**
 * API route for exporting transactions as CSV.
 *
 * GET /api/export/csv?accountId=<id>&includeDuplicates=<true|false>
 * Returns a CSV file download with all transactions.
 */

import { NextResponse } from "next/server";
import {
  getTransactions,
  getAccounts,
  getAllTransactions,
  type TransactionRow,
  type AccountRow,
} from "@/lib/import/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If the field contains commas, quotes, or newlines, wrap in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvHeader(): string {
  return [
    "Date",
    "Description",
    "Amount",
    "Category",
    "Is Bill",
    "Is Duplicate",
    "Account",
  ].join(",");
}

function buildCsvRow(tx: TransactionRow, accountName: string): string {
  return [
    escapeCsvField(tx.date),
    escapeCsvField(tx.description),
    escapeCsvField(tx.amount.toFixed(2)),
    escapeCsvField(tx.category),
    escapeCsvField(tx.is_bill ? "Yes" : "No"),
    escapeCsvField(tx.is_duplicate ? "Yes" : "No"),
    escapeCsvField(accountName),
  ].join(",");
}

// ─── GET: Export transactions as CSV ─────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const includeDuplicates = searchParams.get("includeDuplicates") !== "false";

    let transactions: TransactionRow[];
    let accountName = "All Accounts";

    if (accountId) {
      const accounts = getAccounts();
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      accountName = account.name;
      transactions = getTransactions(accountId, 100000, 0);
    } else {
      transactions = getAllTransactions(100000, 0);
    }

    // Sort by date ascending for the CSV
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Filter out duplicates if requested
    if (!includeDuplicates) {
      transactions = transactions.filter((tx) => !tx.is_duplicate);
    }

    // Build CSV content
    const rows = transactions.map((tx) => buildCsvRow(tx, accountName));
    const csvContent = [buildCsvHeader(), ...rows].join("\n");

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `sentry-ledger-transactions-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    );
  }
}
