import { IoBugOutline, IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { motion } from 'framer-motion';

interface FeedbackButtonProps {
  onClick: () => void;
  isHidden: boolean; // New prop to control visibility
}

export default function FeedbackButton({ onClick, isHidden }: FeedbackButtonProps) {
  if (isHidden) {
    return null; // Don't render if hidden
  }

  return (
    <motion.button
      className="fixed bottom-4 right-4 bg-accent text-white p-4 rounded-full shadow-lg z-40 flex items-center justify-center"
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      aria-label="Give feedback"
    >
      <IoChatbubbleEllipsesOutline size={24} />
    </motion.button>
  );
}