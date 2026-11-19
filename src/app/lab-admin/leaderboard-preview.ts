import Papa from 'papaparse';
import { readSheet } from 'read-excel-file/browser';

export const leaderboardFields = [
  { key: 'participantId', label: 'Participant ID', required: true, aliases: ['participantid', 'username', 'rollnumber'] },
  { key: 'participantName', label: 'Participant name', required: true, aliases: ['participantname', 'name', 'candidate'] },
  { key: 'totalScore', label: 'Total score', required: true, aliases: ['totalscore', 'score', 'total'] },
  { key: 'problemsSolved', label: 'Problems solved', required: false, aliases: ['problemssolved', 'solved'] },
  { key: 'penalty', label: 'Penalty or contest time', required: false, aliases: ['penalty', 'contesttime'] },
  { key: 'submissionCount', label: 'Submission count', required: false, aliases: ['submissioncount', 'submissions'] },
] as const;

export type ColumnMapping = Partial<Record<(typeof leaderboardFields)[number]['key'], number>>;

export async function readLeaderboard(file: File) {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a nonempty file up to 5 MB.');
  }

  let cells: string[][];
  if (/\.xlsx$/i.test(file.name)) {
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (signature.join(',') !== '80,75,3,4') {
      throw new Error('The file is not an Excel workbook.');
    }
    try {
      cells = (await readSheet(file, 1)).map((row) => row.map((cell) => String(cell ?? '')));
    } catch {
      throw new Error('Could not read the first worksheet. Check that the workbook is a valid .xlsx file.');
    }
  } else if (/\.csv$/i.test(file.name)) {
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      throw new Error('Save the CSV with UTF-8 encoding and try again.');
    }
    if (source.includes('\0')) {
      throw new Error('The file is not a text CSV.');
    }
    const result = Papa.parse<string[]>(source, { delimiter: ',' });
    if (result.errors.length) {
      throw new Error('The CSV is malformed. Check its quotes and delimiters.');
    }
    cells = result.data;
  } else {
    throw new Error('Choose a .csv or .xlsx file.');
  }

  const [header, ...records] = cells;
  const headers = header?.map((cell) => cell.trim()) ?? [];
  const rows = records
    .map((row, index) => ({ number: index + 2, cells: row.map((cell) => cell.trim()) }))
    .filter((row) => row.cells.some(Boolean));

  if (!headers.some(Boolean) || rows.length === 0) {
    throw new Error('The file needs a header row and at least one participant record.');
  }
  if (rows.some((row) => row.cells.slice(headers.length).some(Boolean))) {
    throw new Error('One or more records have values beyond the header row.');
  }
  return { headers, rows };
}

export function suggestColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const mapping: ColumnMapping = {};
  for (const field of leaderboardFields) {
    const index = normalized.findIndex((header) => field.aliases.some((alias) => alias === header));
    if (index !== -1) mapping[field.key] = index;
  }
  return mapping;
}

export function validateLeaderboard(
  rows: Awaited<ReturnType<typeof readLeaderboard>>['rows'],
  mapping: ColumnMapping,
) {
  const issues: { row: number; message: string }[] = [];
  const idCounts = new Map<string, number>();
  const idColumn = mapping.participantId!;
  const nameColumn = mapping.participantName!;
  const scoreColumn = mapping.totalScore!;
  for (const { cells } of rows) {
    const id = cells[idColumn];
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  let invalid = 0;
  let duplicates = 0;
  for (const { cells, number } of rows) {
    const id = cells[idColumn];
    const name = cells[nameColumn];
    const score = cells[scoreColumn];
    const issueCount = issues.length;
    if (!id) issues.push({ row: number, message: 'Participant ID is required.' });
    if (id?.length > 100) issues.push({ row: number, message: 'Participant ID exceeds 100 characters.' });
    if (!name) issues.push({ row: number, message: 'Participant name is required.' });
    if (name?.length > 255) issues.push({ row: number, message: 'Participant name exceeds 255 characters.' });
    if (!score || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(score) || !Number.isFinite(Number(score))) {
      issues.push({ row: number, message: 'Total score must be a number.' });
    } else if (Number(score) < 0) {
      issues.push({ row: number, message: 'Total score cannot be negative.' });
    }
    if (id && (idCounts.get(id) ?? 0) > 1) {
      duplicates++;
      issues.push({ row: number, message: 'Participant ID appears more than once in this file.' });
    }
    if (issues.length > issueCount) invalid++;
  }
  return { issues, invalid, duplicates, valid: rows.length - invalid };
}
