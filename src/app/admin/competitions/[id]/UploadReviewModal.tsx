'use client';

import { useState, useTransition } from 'react';
import { approveUpload, rejectUpload, getUploadReviewData } from '@/app/admin/actions';

interface UploadReviewModalProps {
  uploadId: string;
  competitionId: string;
  labName: string;
  fileName: string;
  recordCount: number;
  status: string;
}

interface ReviewUpload {
  upload_id: string;
  file_name: string;
  file_path: string;
  upload_version: number;
  status: string;
  record_count: number;
  uploaded_at: string;
  rejection_reason?: string | null;
  users?: {
    name?: string | null;
    email?: string | null;
  } | null;
  labs?: {
    lab_id: string;
    lab_name: string;
  } | null;
}

interface ReviewResult {
  result_id: string;
  total_score: number | string;
  problems_solved: number;
  penalty: number | null;
  participants?: {
    participant_id?: string;
    external_participant_id?: string;
    participant_name?: string;
  } | null;
}

interface ReviewIssue {
  issue_id: string;
  row_number: number;
  field_name?: string | null;
  issue_type: string;
  message: string;
}

type ReviewData = {
  upload: ReviewUpload;
  results: ReviewResult[];
  issues: ReviewIssue[];
};

export function UploadReviewModal({
  uploadId,
  competitionId,
  labName,
  fileName,
  recordCount,
  status: initialStatus,
}: UploadReviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'issues'>('records');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function openModal() {
    setIsOpen(true);
    setLoading(true);
    setActionError(null);
    setShowRejectInput(false);

    try {
      const res = await getUploadReviewData(uploadId);
      if (res.success && res.data) {
        setReviewData(res.data as ReviewData);
      } else {
        setActionError(res.error || 'Failed to load upload preview.');
      }
    } catch {
      setActionError('An error occurred loading the submission details.');
    } finally {
      setLoading(false);
    }
  }

  function handleApprove() {
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('upload_id', uploadId);
      fd.append('competition_id', competitionId);
      const res = await approveUpload({}, fd);
      if (res.error) {
        setActionError(res.error);
      } else {
        setIsOpen(false);
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      setActionError('Please enter a rejection reason before confirming.');
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('upload_id', uploadId);
      fd.append('competition_id', competitionId);
      fd.append('rejection_reason', rejectReason.trim());
      const res = await rejectUpload({}, fd);
      if (res.error) {
        setActionError(res.error);
      } else {
        setIsOpen(false);
      }
    });
  }

  const currentStatus = reviewData?.upload?.status || initialStatus;

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
      >
        <span>Inspect & Review</span>
        <span>→</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isPending && setIsOpen(false)}
          />

          {/* Modal Panel */}
          <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-900/60">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {labName}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      currentStatus === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : currentStatus === 'PENDING_APPROVAL'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : currentStatus === 'REJECTED'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                        : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                    }`}
                  >
                    {currentStatus.replaceAll('_', ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                  Submission Review: {fileName}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                  {recordCount} participants ingested • v{reviewData?.upload?.upload_version ?? 1}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg font-mono p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Submitter & Feedback Banner */}
            {reviewData?.upload && (
              <div className="px-6 py-3 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap justify-between items-center text-xs text-zinc-600 dark:text-zinc-400 gap-2">
                <div>
                  Submitted by:{' '}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                    {reviewData.upload.users?.name || 'Lab Admin'}
                  </span>{' '}
                  <span className="text-zinc-400 font-mono">({reviewData.upload.users?.email})</span>
                </div>
                <div>
                  Time:{' '}
                  <span className="font-mono text-zinc-900 dark:text-zinc-200">
                    {new Date(reviewData.upload.uploaded_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {reviewData?.upload?.rejection_reason && (
              <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 text-xs text-red-600 dark:text-red-400">
                <span className="font-bold">Prior Rejection Reason: </span>
                {reviewData.upload.rejection_reason}
              </div>
            )}

            {/* Error banner */}
            {actionError && (
              <div className="px-6 py-2.5 bg-red-500/10 text-red-600 dark:text-red-400 text-xs border-b border-red-500/20">
                {actionError}
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loading ? (
                <div className="py-16 text-center text-zinc-500 text-xs font-mono">
                  Loading submission records...
                </div>
              ) : reviewData ? (
                <>
                  {/* Tabs */}
                  <div className="flex space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <button
                      onClick={() => setActiveTab('records')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        activeTab === 'records'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      Participants ({reviewData.results.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('issues')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        activeTab === 'issues'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      Validation Issues ({reviewData.issues.length})
                    </button>
                  </div>

                  {activeTab === 'records' ? (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/60 font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Participant ID</th>
                            <th className="px-4 py-2.5">Name</th>
                            <th className="px-4 py-2.5 text-right">Score</th>
                            <th className="px-4 py-2.5 text-right">Solved</th>
                            <th className="px-4 py-2.5 text-right">Penalty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {reviewData.results.map((res: ReviewResult, idx: number) => (
                            <tr key={res.result_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                              <td className="px-4 py-2 text-zinc-400 font-mono">{idx + 1}</td>
                              <td className="px-4 py-2 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                                {res.participants?.external_participant_id || '—'}
                              </td>
                              <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100 font-medium">
                                {res.participants?.participant_name || '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                                {res.total_score}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                                {res.problems_solved}
                              </td>
                              <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                                {res.penalty ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div>
                      {reviewData.issues.length === 0 ? (
                        <div className="py-10 text-center text-xs text-zinc-500">
                          No validation issues or schema errors detected in this submission.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/60 font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              <tr>
                                <th className="px-4 py-2.5">Row</th>
                                <th className="px-4 py-2.5">Field</th>
                                <th className="px-4 py-2.5">Issue Type</th>
                                <th className="px-4 py-2.5">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                              {reviewData.issues.map((issue: ReviewIssue) => (
                                <tr key={issue.issue_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                  <td className="px-4 py-2 font-mono text-zinc-400">{issue.row_number}</td>
                                  <td className="px-4 py-2 font-mono text-zinc-600 dark:text-zinc-300">{issue.field_name || '—'}</td>
                                  <td className="px-4 py-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                      {issue.issue_type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{issue.message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Rejection Input */}
                  {showRejectInput && (
                    <div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 space-y-2">
                      <label className="block text-xs font-semibold text-red-700 dark:text-red-400">
                        Reason for Rejection (Visible to Lab Admin):
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g., Participant scores in column C appear inverted; please re-export from HackerRank and re-upload."
                        rows={3}
                        className="w-full text-xs rounded-lg border border-red-500/20 dark:border-red-500/40 bg-white dark:bg-zinc-900 p-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-indigo-500"
                      />
                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(false)}
                          className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={isPending}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                        >
                          {isPending ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Close
              </button>

              <div className="flex items-center space-x-3">
                {!showRejectInput && (
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isPending}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    Reject with Feedback
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending || currentStatus === 'APPROVED'}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentStatus === 'APPROVED'
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  }`}
                >
                  {isPending ? 'Processing...' : currentStatus === 'APPROVED' ? '✓ Approved' : 'Approve Submission'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}