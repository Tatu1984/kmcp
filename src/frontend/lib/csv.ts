/**
 * Client-side CSV export for the tables in this portal.
 *
 * Every "Export" button used to raise a toast promising an emailed file that
 * nothing was ever going to send. The rows are already in the browser — filtered,
 * sorted and column-labelled by the table that is showing them — so the honest
 * implementation is to write them out here rather than to invent a job queue.
 *
 * This is deliberately not the reports module. `POST /reports` re-runs a query
 * server-side over a period the operator chooses, and is the right tool for a
 * statutory return. This is "give me what I am looking at", which is a different
 * request and should not need a round trip.
 */

/** One column of the file: the heading, and how to read it off a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/**
 * One cell, escaped per RFC 4180.
 *
 * The leading-apostrophe guard is not cosmetic. A plate or a closure reason
 * beginning with `=`, `+`, `-` or `@` is read by Excel and Sheets as a formula,
 * and a spreadsheet that runs whatever a field officer typed into a free-text
 * box is a real attack on whoever opens the file. Prefixing forces it to stay
 * text; the apostrophe is not shown in the cell.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw = value instanceof Date ? value.toISOString() : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The file's text, header row first. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((column) => cell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => cell(column.value(row))).join(","));
  }
  // CRLF, which is what every spreadsheet expects from a .csv.
  return lines.join("\r\n");
}

/**
 * Writes the rows to a file the browser downloads, and returns its name so the
 * caller can say which file it just handed over.
 *
 * The byte-order mark is there for Excel: without it, Excel on Windows reads a
 * UTF-8 file as the local code page and every Bengali zone name arrives as
 * mojibake. Every other reader ignores it.
 */
export function downloadCsv<T>(
  name: string,
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const filename = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Freed on the next tick — Safari has not started reading the blob yet when
  // click() returns, and revoking synchronously gives it an empty file.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);

  return filename;
}
