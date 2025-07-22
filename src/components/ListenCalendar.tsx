import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import type { Listen } from '../lib/supabase';

interface ListenCalendarViewProps {
  listens: Listen[];
}

export default function ListenCalendarView({ listens }: ListenCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfMonth = startOfMonth(currentMonth).getDay(); // 0 for Sunday, 1 for Monday, etc.
  const emptyCellsBefore = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Adjust for Monday start

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Group listens by date for easy lookup
  const listensByDate = listens.reduce((acc, listen) => {
    const dateKey = format(new Date(listen.listened_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(listen);
    return acc;
  }, {} as Record<string, Listen[]>);

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div className="rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <button onClick={goToPreviousMonth} className="btn btn-secondary">
          &lt;
        </button>
        <h2 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={goToNextMonth} className="btn btn-secondary">
          &gt;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-secondary">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyCellsBefore }).map((_, i) => (
          <div key={`empty-prev-${i}`} className="p-2"></div>
        ))}
        {daysInMonth.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayListens = listensByDate[dateKey] || [];
          const isCurrentDay = isSameDay(day, new Date());

          return (
            <div
              key={index}
              className={`p-1 border border-white/10 rounded flex flex-col items-center justify-start min-h-[80px] sm:min-h-[100px] ${
                isSameMonth(day, currentMonth) ? 'bg-surface' : 'bg-background'
              } ${isCurrentDay ? 'border-accent' : ''}`}
            >
              <span className={`text-xs font-bold mb-1 ${isCurrentDay ? 'text-accent' : ''}`}>
                {format(day, 'd')}
              </span>
              <div className="flex flex-wrap justify-center gap-1">
                {dayListens.slice(0, 2).map((listen) => ( // Show up to 2 album covers
                  <img
                    key={listen.id}
                    src={listen.album?.cover_url}
                    alt={listen.album?.name}
                    className="w-8 h-8 object-cover rounded-sm"
                    title={`${listen.album?.name} - ${listen.album?.artist}`}
                  />
                ))}
                {dayListens.length > 2 && (
                  <span className="text-xs text-secondary mt-1">+{dayListens.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
