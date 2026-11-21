/**
 * API route for importing transactions.
 *
 * Receives parsed transaction data from the client and imports it into the database.
 */

import { NextResponse } from "next/server";
import { importTransactions, getAccounts, createAccount, findExistingDuplicate } from "@/lib/import/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { accountId, accountName, transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    // If no account specified, create one
    let finalAccountId = accountId;
    let finalAccountName = accountName;

    if (!finalAccountId) {
      const accounts = getAccounts();
      if (accounts.length === 0) {
        finalAccountId = createAccount("Main Account", "checking", 0, "USD");
        finalAccountName = "Main Account";
      } else {
        finalAccountId = accounts[0].id;
        finalAccountName = accounts[0].name;
      }
    }

    // Check for existing duplicates in the database
    const existingDuplicates: { index: number; existingTransaction: any }[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!tx.date || tx.amount === 0) continue;

      const existing = findExistingDuplicate(
        tx.date,
        tx.description,
        tx.amount,
        finalAccountId
      );

      if (existing) {
        existingDuplicates.push({ index: i, existingTransaction: existing });
      }
    }

    // Import transactions
    const result = importTransactions(finalAccountId, transactions);

    return NextResponse.json({
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      failed: result.failed,
      existingDuplicates,
      accountId: finalAccountId,
      accountName: finalAccountName,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import transactions" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const accounts = getAccounts();
    return NextResponse.json({
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    });
  } catch (error) {
    console.error("Get accounts error:", error);
    return NextResponse.json(
      { error: "Failed to get accounts" },
      { status: 500 }
    );
  }
}
