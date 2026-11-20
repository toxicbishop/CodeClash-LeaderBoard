'use client';

import { useActionState, useState } from 'react';
import { submitLeaderboard } from './submission-actions';
import type { ActionResponse } from '@/app/admin/actions';
import {
  leaderboardFields,
  readLeaderboard,
  suggestColumns,
  validateLeaderboard,
  type ColumnMapping,
} from './leaderboard-preview';

const inputClass =
  'rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const initialState: ActionResponse = { error: null, success: false };

type Props = { competitionId: string; labId: string };

export default function LeaderboardPreview({ competitionId, labId }: Props) {
  const [state, action, pending] = useActionState(submitLeaderboard, initialState);
  const [file, setFile] = useState<Awaited<ReturnType<typeof readLeaderboard>>>();
  const [selectedFileName, setSelectedFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  async function inspect(selected: File | undefined) {
    setFile(undefined);
    setSelectedFileName('');
    setError('');
    if (!selected) return;
    setReading(true);
    try {
      const parsed = await readLeaderboard(selected);
      setMapping(suggestColumns(parsed.headers));
      setFile(parsed);
      setSelectedFileName(selected.name);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not read the file.');
    } finally {
      setReading(false);
    }
  }

  const mappedFields = leaderboardFields.filter((field) => mapping[field.key] !== undefined);
  const selectedColumns = mappedFields.map((field) => mapping[field.key]);
  const columnsAreUnique = new Set(selectedColumns).size === selectedColumns.length;
  const requiredColumnsMapped = leaderboardFields.every(
    (field) => !field.required || mapping[field.key] !== undefined
  );
  const report =
    file && columnsAreUnique && requiredColumnsMapped
      ? validateLeaderboard(file.rows, mapping)
      : undefined;

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="competition_id" value={competitionId} />
      <input type="hidden" name="lab_id" value={labId} />
      <input type="hidden" name="rows" value={file ? JSON.stringify(file.rows) : ''} />
      <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
      <h2 className="text-lg font-semibold">Preview leaderboard file</h2>
      <div className="space-y-2">
        <label htmlFor="leaderboard-file" className="block text-sm font-medium">
          Results file
        </label>
        <p id="file-instructions" className="text-sm text-zinc-600 dark:text-zinc-400">
          Choose a CSV or Excel workbook up to 5 MB. Put column headers in the first row. Excel
          previews use the first worksheet.
        </p>
        <input
          id="leaderboard-file"
          name="file"
          type="file"
          accept=".csv,.xlsx"
          aria-describedby="file-instructions"
          disabled={reading || pending}
          onChange={(event) => void inspect(event.currentTarget.files?.[0])}
          className={inputClass}
        />
      </div>
      <div aria-live="polite">
        {reading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Reading file...</p>}
        {(error || state.error) && (
          <p className="text-sm text-red-700 dark:text-red-300">{error || state.error}</p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Submission received and queued for admin approval.
          </p>
        )}
      </div>
      {file && (
        <>
          <input type="hidden" name="file_name" value={selectedFileName} />
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-medium">Match file columns</legend>
            {leaderboardFields.map((field) => (
              <label key={field.key} className="flex min-w-0 flex-col gap-1 text-sm">
                {field.label}
                {field.required && ' (required)'}
                <select
                  className={inputClass}
                  value={mapping[field.key] ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setMapping((previous) => ({
                      ...previous,
                      [field.key]: value === '' ? undefined : Number(value),
                    }));
                  }}
                >
                  <option value="">Choose a column</option>
                  {file.headers.map((header, index) => (
                    <option key={index} value={index}>
                      {header || 'Unnamed'} (column {index + 1})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          {!requiredColumnsMapped && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Match all required fields to see the preview.
            </p>
          )}
          {!columnsAreUnique && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Choose a different column for each field.
            </p>
          )}
          {report && (
            <>
              <p className="text-sm" aria-live="polite">
                {file.rows.length} records · {report.valid} valid · {report.invalid} invalid ·{' '}
                {report.duplicates} with duplicate IDs
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="pb-2 text-left font-medium">
                    First {Math.min(10, file.rows.length)} records
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2">
                        Row
                      </th>
                      {mappedFields.map((field) => (
                        <th scope="col" key={field.key} className="p-2">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {file.rows.slice(0, 10).map((row) => (
                      <tr
                        key={row.number}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className="p-2">{row.number}</td>
                        {mappedFields.map((field) => (
                          <td key={field.key} className="p-2">
                            {row.cells[mapping[field.key]!] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.issues.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-amber-600 dark:text-amber-400">
                    Validation issues ({report.issues.length})
                  </summary>
                  <ul className="mt-2 max-h-56 list-disc overflow-y-auto pl-5 text-sm">
                    {report.issues.map((issue) => (
                      <li key={`${issue.row}-${issue.message}`}>
                        Row {issue.row}. {issue.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                type="submit"
                disabled={pending || report.invalid > 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {pending ? 'Submitting...' : 'Submit for admin approval'}
              </button>
            </>
          )}
        </>
      )}
    </form>
  );
}
