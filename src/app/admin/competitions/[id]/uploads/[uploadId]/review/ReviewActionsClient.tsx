'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveUpload, rejectUpload } from '@/app/admin/actions';

interface ReviewActionsClientProps {
  uploadId: string;
  competitionId: string;
  currentStatus: string;
}

export default function ReviewActionsClient({
  uploadId,
  competitionId,
  currentStatus,
}: ReviewActionsClientProps) {
  const router = useRouter();
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsLoading(true);
    setError(null);
    const res = await approveUpload(uploadId);
    setIsLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(`/admin/competitions/${competitionId}`);
      router.refresh();
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await rejectUpload(uploadId, reason);
    setIsLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(`/admin/competitions/${competitionId}`);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col items-end space-y-2">
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center space-x-2">
        {!isRejecting ? (
          <>
            <button
              onClick={() => setIsRejecting(true)}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors"
            >
              Reject with Feedback
            </button>
            <button
              onClick={handleApprove}
              disabled={isLoading || currentStatus === 'APPROVED'}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading ? 'Processing...' : '✓ Approve Upload'}
            </button>
          </>
        ) : (
          <form onSubmit={handleReject} className="flex flex-col space-y-2 items-end">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this upload is rejected..."
              rows={2}
              className="w-64 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-1 text-xs font-semibold rounded-md text-white bg-red-600 hover:bg-red-500"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
