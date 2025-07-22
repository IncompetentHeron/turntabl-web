import { useState } from 'react';
import { IoClose, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { reportContent } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { ToastOptions } from '../hooks/useToast';

interface ReportContentModalProps {
  contentType: 'review' | 'comment';
  contentId: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (options: ToastOptions) => void;
}

export default function ReportContentModal({
  contentType,
  contentId,
  onClose,
  onSuccess,
  showToast,
}: ReportContentModalProps) {
  const { user } = useUser();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<'form' | 'success' | 'error'>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to report content.');
      setSubmissionState('error');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for reporting.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await reportContent(contentType, contentId, reason);
      setSubmissionState('success');
      onSuccess(); // Trigger parent's refetch/update
    } catch (err: any) {
      setError(err.message);
      setSubmissionState('error');
      showToast({ title: 'Report Failed', description: err.message || 'Could not submit report. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // MODIFIED: handleBackgroundClick to only close if not in success/error state
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && submissionState === 'form') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackgroundClick} // Use the modified handler
    >
      <div className="bg-surface p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {submissionState === 'form' && `Report ${contentType === 'review' ? 'Review' : 'Comment'}`}
            {submissionState === 'success' && 'Report Submitted!'}
            {submissionState === 'error' && 'Submission Error'}
          </h2>
          {/* MODIFIED: Close button always present, but behavior depends on state */}
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
          >
            ✕
          </button>
        </div>

        {submissionState === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium mb-2">
                Reason for reporting
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-32 px-4 py-2 bg-surface border border-white/10 rounded-lg resize-none"
                placeholder="e.g., Inappropriate language, spam, hate speech, etc."
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}

        {submissionState === 'success' && (
          <div className="text-center py-8">
            <IoCheckmarkCircleOutline className="text-accent text-6xl mx-auto mb-4" />
            <p className="text-lg font-medium mb-4">
              Thank you for your report.
            </p>
            <p className="text-secondary mb-6">
              The {contentType} has been sent for review.
            </p>
            {/* ADDED: Close button for success state */}
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}

        {submissionState === 'error' && (
          <div className="text-center py-8">
            <p className="text-red-500 text-lg font-medium mb-4">
              An error occurred during submission.
            </p>
            {error && <p className="text-red-500 text-sm mb-6">{error}</p>}
            {/* ADDED: Close button for error state */}
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
