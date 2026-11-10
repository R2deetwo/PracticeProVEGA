/**
 * csvExport — ROUND F (Wave F3): shared CSV export helpers.
 * ─────────────────────────────────────────────────────────────────────────────
 * The report suite's "export" affordance. Pure string building + a browser
 * download trigger (the same Blob+anchor pattern the existing surfaces use,
 * extracted once so every report exports identically: RFC-4180 quoting,
 * UTF-8 BOM so Excel opens ₦ correctly, CRLF rows).
 */

/** Quote a CSV field per RFC 4180 (quote when it contains a delimiter,
 *  quote char, or newline; escape embedded quotes by doubling). */
export function csvField(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/** Build a CSV document from rows. `headers` fixes column order; missing
 *  keys render as empty fields. */
export function buildCsv(
    rows: Record<string, unknown>[],
    headers: string[],
): string {
    const lines: string[] = [headers.map(csvField).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => csvField(row[h])).join(','));
    }
    return lines.join('\r\n');
}

/** Trigger a browser download of `csv` as `filename.csv`. */
export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
