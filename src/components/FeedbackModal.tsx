import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { IoClose, IoBugOutline, IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitBugReport, submitGeneralFeedback } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { ToastOptions } from '../hooks/useToast';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (options: ToastOptions) => void;
}

export default function FeedbackModal({ isOpen, onClose, showToast }: FeedbackModalProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [generalFeedbackText, setGeneralFeedbackText] = useState('');
  const [activeTab, setActiveTab] = useState('bugReport');

  const bugReportMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) =>
      submitBugReport(user?.id || null, data.title, data.description),
    onSuccess: () => {
      showToast({ title: 'Bug Report Submitted!', description: 'Thank you for helping us improve.' });
      setBugTitle('');
      setBugDescription('');
      onClose();
    },
    onError: (error) => {
      console.error('Bug report submission error:', error);
      showToast({ title: 'Submission Failed', description: 'Could not submit bug report. Please try again.' });
    },
  });

  const generalFeedbackMutation = useMutation({
    mutationFn: (data: { feedbackText: string }) =>
      submitGeneralFeedback(user?.id || null, data.feedbackText),
    onSuccess: () => {
      showToast({ title: 'Feedback Submitted!', description: 'Thank you for your valuable input.' });
      setGeneralFeedbackText('');
      onClose();
    },
    onError: (error) => {
      console.error('General feedback submission error:', error);
      showToast({ title: 'Submission Failed', description: 'Could not submit feedback. Please try again.' });
    },
  });

  const handleBugReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDescription.trim()) {
      showToast({ title: 'Missing Fields', description: 'Please fill in both title and description for the bug report.' });
      return;
    }
    bugReportMutation.mutate({ title: bugTitle, description: bugDescription });
  };

  const handleGeneralFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalFeedbackText.trim()) {
      showToast({ title: 'Missing Feedback', description: 'Please enter your feedback.' });
      return;
    }
    generalFeedbackMutation.mutate({ feedbackText: generalFeedbackText });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-surface p-6 rounded-lg w-[90vw] max-w-md max-h-[85vh] overflow-y-auto shadow-lg z-50">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-2xl font-bold">Give Feedback</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-secondary hover:text-primary" aria-label="Close">
                <IoClose size={24} />
              </button>
            </Dialog.Close>
          </div>

          <Tabs.Root className="flex flex-col w-full" defaultValue="bugReport" onValueChange={setActiveTab}>
            <Tabs.List className="flex border-b border-white/10 mb-4" aria-label="Feedback type">
              <Tabs.Trigger
                className="flex-1 py-2 text-center text-secondary data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent flex items-center justify-center gap-2"
                value="bugReport"
              >
                <IoBugOutline size={20} /> Bug Report
              </Tabs.Trigger>
              <Tabs.Trigger
                className="flex-1 py-2 text-center text-secondary data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-accent flex items-center justify-center gap-2"
                value="generalFeedback"
              >
                <IoChatbubbleEllipsesOutline size={20} /> General Feedback
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content className="flex-grow" value="bugReport">
              <form onSubmit={handleBugReportSubmit} className="space-y-4">
                <div>
                  <label htmlFor="bugTitle" className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    id="bugTitle"
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg"
                    placeholder="e.g., App crashes when I click 'Like'"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="bugDescription" className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    id="bugDescription"
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    className="w-full h-32 px-4 py-2 bg-background border border-white/10 rounded-lg resize-none"
                    placeholder="Describe the bug and what you were doing when it occurred. Steps to reproduce are helpful!"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={bugReportMutation.isPending}
                >
                  {bugReportMutation.isPending ? 'Submitting...' : 'Submit Bug Report'}
                </button>
              </form>
            </Tabs.Content>

            <Tabs.Content className="flex-grow" value="generalFeedback">
              <form onSubmit={handleGeneralFeedbackSubmit} className="space-y-4">
                <div>
                  <label htmlFor="generalFeedbackText" className="block text-sm font-medium mb-2">Your Feedback</label>
                  <textarea
                    id="generalFeedbackText"
                    value={generalFeedbackText}
                    onChange={(e) => setGeneralFeedbackText(e.target.value)}
                    className="w-full h-32 px-4 py-2 bg-background border border-white/10 rounded-lg resize-none"
                    placeholder="Share your thoughts, suggestions, or positive comments here!"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={generalFeedbackMutation.isPending}
                >
                  {generalFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
