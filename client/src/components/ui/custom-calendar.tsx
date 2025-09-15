import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface CustomCalendarProps {
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  numberOfMonths?: number;
  disabled?: (date: Date) => boolean;
}

export function CustomCalendar({ 
  selected, 
  onSelect, 
  numberOfMonths = 1, 
  disabled = () => false 
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const months = Array.from({ length: numberOfMonths }, (_, i) => 
    addMonths(currentMonth, i)
  );

  const handleDateClick = (date: Date) => {
    if (disabled(date)) return;
    
    console.log('Date clicked:', date, 'Current selection:', selected);
    
    if (!selected?.from || (selected.from && selected.to)) {
      // Start a new selection
      console.log('Starting new selection with:', date);
      onSelect?.({ from: date, to: undefined });
    } else {
      // Second click logic - allow any date to be selected
      console.log('Completing selection from', selected.from, 'to', date);
      if (date >= selected.from) {
        // Normal case: end date after start date
        onSelect?.({ from: selected.from, to: date });
      } else {
        // Swap case: clicked before start date
        onSelect?.({ from: date, to: selected.from });
      }
    }
  };

  const handleDateHover = (date: Date) => {
    // Show range preview when first date is selected but second isn't confirmed yet
    if (selected?.from && !selected.to && !disabled(date)) {
      console.log('Hovering over date:', date, 'with start:', selected.from);
      if (date >= selected.from) {
        // Normal case: hovering after start date
        onSelect?.({ from: selected.from, to: date });
      } else {
        // Swap case: hovering before start date
        onSelect?.({ from: date, to: selected.from });
      }
    }
  };

  const isDateInRange = (date: Date): 'start' | 'end' | 'middle' | 'single' | null => {
    if (!selected?.from) return null;
    
    if (!selected.to) {
      return isSameDay(date, selected.from) ? 'single' : null;
    }
    
    if (isSameDay(date, selected.from)) return 'start';
    if (isSameDay(date, selected.to)) return 'end';
    if (date > selected.from && date < selected.to) return 'middle';
    
    return null;
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  const getDateStyle = (date: Date) => {
    const rangeType = isDateInRange(date);
    const today = isToday(date);
    const isDisabled = disabled(date);
    
    if (isDisabled) {
      return 'opacity-50 cursor-not-allowed text-gray-400';
    }
    
    if (rangeType === 'start' || rangeType === 'end' || rangeType === 'single') {
      return 'bg-purple-600 text-white border-2 border-purple-600 font-bold shadow-lg';
    }
    
    if (rangeType === 'middle') {
      return 'bg-purple-200 text-purple-800 border border-purple-400';
    }
    
    if (today) {
      return 'bg-green-200 text-green-800 border-2 border-green-500 font-bold';
    }
    
    return 'hover:bg-purple-50 hover:border-purple-300 border border-transparent';
  };

  const renderMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days to make a complete grid
    const firstDayOfWeek = monthStart.getDay();
    const paddingDays = Array.from({ length: firstDayOfWeek }, (_, i) => 
      new Date(monthStart.getTime() - (firstDayOfWeek - i) * 24 * 60 * 60 * 1000)
    );
    
    const lastDayOfWeek = monthEnd.getDay();
    const trailingDays = Array.from({ length: 6 - lastDayOfWeek }, (_, i) => 
      new Date(monthEnd.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
    );
    
    const allDays = [...paddingDays, ...days, ...trailingDays];
    
    return (
      <div key={month.getTime()} className="w-full md:flex-1 md:min-w-64">
        <div className="text-center font-semibold text-lg mb-4">
          {format(month, 'MMMM yyyy')}
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-sm font-medium p-2 text-gray-600">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, month);
            const dateStyle = getDateStyle(date);
            
            return (
              <button
                key={index}
                onClick={() => isCurrentMonth && !disabled(date) ? handleDateClick(date) : null}
                onMouseEnter={() => isCurrentMonth && !disabled(date) ? handleDateHover(date) : null}
                disabled={false}
                className={`
                  w-7 h-7 md:w-8 md:h-8 text-xs md:text-sm rounded-md transition-all duration-200 select-none
                  ${isCurrentMonth && !disabled(date) ? 'cursor-pointer' : 'cursor-not-allowed'}
                  ${isCurrentMonth ? dateStyle : 'text-gray-300'}
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                `}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-2 md:p-4 bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold text-lg">
          {format(currentMonth, 'yyyy')}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center">
        {months.map(renderMonth)}
      </div>
      
      {selected?.from && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Selected: {format(selected.from, 'MMM d, yyyy')}
          {selected.to && selected.to !== selected.from && (
            <> to {format(selected.to, 'MMM d, yyyy')}</>
          )}
        </div>
      )}
    </div>
  );
}