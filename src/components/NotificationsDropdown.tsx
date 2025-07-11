import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getNotifications, markNotificationsAsRead } from '../lib/supabase';
import Avatar from './Avatar';

export default function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  useEffect(() => {
    // Get IDs of unread notifications
    const ids = notifications
      .filter(n => !n.is_read)
      .map(n => n.id);
    setUnreadIds(ids);

    // Mark as read after 2 seconds of viewing
    if (ids.length > 0) {
      const timer = setTimeout(() => {
        markAsReadMutation.mutate(ids);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const renderNotificationContent = (notification: any) => {
    switch (notification.type) {
      case 'follow':
        return (
          <div className="flex items-center gap-3">
            <Link 
              to={`/user/${notification.actor_id}`}
              onClick={onClose}
              className="flex-shrink-0"
            >
              <Avatar
                url={notification.actor?.avatar_url}
                name={notification.actor?.display_name || notification.actor?.username}
                size="sm"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to={`/user/${notification.actor_id}`}
                onClick={onClose}
                className="font-medium hover:text-accent"
              >
                {notification.actor?.display_name || notification.actor?.username}
              </Link>
              <span className="text-secondary"> started following you</span>
              <p className="text-sm text-secondary">
                {format(new Date(notification.created_at), 'MMM d, h:mm a')}
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-surface rounded-lg shadow-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="font-bold">Notifications</h3>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-white/10">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 ${!notification.is_read ? 'bg-accent/5' : ''}`}
              >
                {renderNotificationContent(notification)}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-secondary">
            No notifications yet
          </div>
        )}
      </div>
    </div>
  );
}