import React from 'react';
import { format, differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface GanttTimelineProps {
  startDate: string | Date;
  endDate: string | Date;
  showLegend?: boolean;
  showProjectLabels?: boolean;
  showDuration?: boolean;
  showToday?: boolean;
  className?: string;
  legendClassName?: string;
  onYearClick?: (year: number) => void;
  onMonthClick?: (date: Date) => void;
}

interface YearMarker {
  year: number;
  date: Date;
  position: number;
}

interface MonthMarker {
  date: Date;
  position: number;
}

export function GanttTimeline({
  startDate,
  endDate,
  showLegend = false,
  showProjectLabels = true,
  showDuration = true,
  showToday = true,
  className = '',
  legendClassName = '',
  onYearClick,
  onMonthClick,
}: GanttTimelineProps) {
  // Parse dates
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const today = new Date();
  
  // Calculate durations
  const totalDays = differenceInDays(end, start);
  const weeksWithDecimals = (totalDays / 7).toFixed(2);
  const totalMonths = differenceInMonths(end, start);
  
  // Calculate year boundaries
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  // Create timeline boundaries (first day of start year to last day of end year)
  const timelineStart = new Date(startYear, 0, 1); // January 1st of start year
  const timelineEnd = new Date(endYear, 11, 31); // December 31st of end year
  
  const timelineTotalDays = differenceInDays(timelineEnd, timelineStart);
  const projectStartDays = differenceInDays(start, timelineStart);
  const projectEndDays = differenceInDays(end, timelineStart);
  const daysElapsed = Math.max(0, differenceInDays(today, timelineStart));
  
  // Calculate positions as percentages
  const projectStartPosition = (projectStartDays / timelineTotalDays) * 100;
  const projectEndPosition = (projectEndDays / timelineTotalDays) * 100;
  const todayPosition = Math.min(100, (daysElapsed / timelineTotalDays) * 100);
  
  // Generate year markers
  const years: YearMarker[] = [];
  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1);
    const daysFromStart = differenceInDays(yearStart, timelineStart);
    const position = (daysFromStart / timelineTotalDays) * 100;
    
    years.push({
      year,
      date: yearStart,
      position
    });
  }
  
  // Add end marker
  years.push({
    year: endYear + 1,
    date: new Date(endYear + 1, 0, 1),
    position: 100
  });
  
  // Generate month markers within the timeline range
  const months: MonthMarker[] = [];
  let currentMonth = new Date(startYear, 0, 1); // Start from January of start year
  
  while (currentMonth <= timelineEnd) {
    const monthStart = new Date(currentMonth);
    const daysFromStart = differenceInDays(monthStart, timelineStart);
    const position = (daysFromStart / timelineTotalDays) * 100;
    
    if (position >= 0 && position <= 100) {
      months.push({
        date: new Date(currentMonth),
        position
      });
    }
    
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  const handleYearClick = (year: number, event: React.MouseEvent) => {
    if (onYearClick) {
      event.stopPropagation();
      onYearClick(year);
    }
  };

  const handleMonthClick = (date: Date, event: React.MouseEvent) => {
    if (onMonthClick) {
      event.stopPropagation();
      onMonthClick(date);
    }
  };

  // Function to determine if month label should be hidden to avoid overlap
  const shouldHideMonthLabel = (index: number, months: MonthMarker[]) => {
    if (index === 0 || index === months.length - 1) return false;
    
    const currentPos = months[index].position;
    const prevPos = months[index - 1].position;
    const nextPos = months[index + 1].position;
    
    // Hide label if too close to previous or next month
    return (currentPos - prevPos < 6) || (nextPos - currentPos < 6);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Duration display */}
      {showDuration && (
        <div className="flex items-center justify-start text-xs text-gray-600 mb-2 pb-1 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-700">Duration:</span>
            <div className="flex gap-4">
              <span className="bg-gray-50 px-2 py-0.5 rounded"><span className="font-medium text-gray-900">{totalDays}</span> days</span>
              <span className="bg-gray-50 px-2 py-0.5 rounded"><span className="font-medium text-gray-900">{weeksWithDecimals}</span> weeks</span>
              <span className="bg-gray-50 px-2 py-0.5 rounded"><span className="font-medium text-gray-900">{totalMonths}</span> months</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Main timeline container */}
      <div className="relative h-24">
        {/* Timeline bar - positioned in middle */}
        <div className="absolute inset-x-0 top-8 flex items-center">
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            {/* Project period bar */}
            <div 
              className="absolute h-4 bg-blue-200 rounded-full transition-all duration-300"
              style={{ 
                left: `${projectStartPosition}%`,
                width: `${projectEndPosition - projectStartPosition}%`
              }}
            />
          </div>
        </div>
        
        {/* Year markers - positioned above the bar */}
        <div className="absolute inset-x-0 top-0 h-8">
          {years.map((year, index) => (
            <div
              key={`year-${index}`}
              className="absolute h-full"
              style={{ left: `${year.position}%` }}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={`relative h-full ${onYearClick ? 'cursor-pointer' : ''}`}
                      onClick={(e) => handleYearClick(year.year, e)}
                    >
                      {/* Year marker line */}
                      <div className="absolute top-0 w-px h-5 bg-gray-400 -translate-x-1/2" />
                      
                      {/* Year label - positioned above the line */}
                      <div className={cn(
                        "absolute whitespace-nowrap text-xs font-medium text-gray-600",
                        year.position === 0 ? "left-0 -translate-x-0" : 
                        year.position === 100 ? "right-0 translate-x-0" : 
                        "-translate-x-1/2",
                        "top-6"
                      )}>
                        {year.year}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="mb-1">
                    <p className="text-xs">Year {year.year}</p>
                    {onYearClick && <p className="text-xs text-blue-500">Click to view</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
        
        {/* Month markers - positioned below the bar */}
        <div className="absolute inset-x-0 top-12 h-12">
          {months.map((month, index) => {
            const hideLabel = shouldHideMonthLabel(index, months);
            
            return (
              <div
                key={`month-${index}`}
                className="absolute h-full"
                style={{ left: `${month.position}%` }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className={`relative h-full ${onMonthClick ? 'cursor-pointer' : ''}`}
                        onClick={(e) => handleMonthClick(month.date, e)}
                      >
                        {/* Month marker line */}
                        <div className="absolute top-1 w-px h-3 bg-gray-300 -translate-x-1/2" />
                        
                        {/* Month label - only show if not hidden due to overlap */}
                        {!hideLabel && (
                          <div className="absolute top-4 text-[8px] text-gray-400 -translate-x-1/2 whitespace-nowrap">
                            {format(month.date, 'MMM')}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="mt-1">
                      <p className="text-xs">{format(month.date, 'MMMM yyyy')}</p>
                      {onMonthClick && <p className="text-xs text-blue-500">Click to filter</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>
        
        {/* Today marker - red line */}
        {showToday && today >= timelineStart && today <= timelineEnd && (
          <div 
            className="absolute inset-y-0"
            style={{ left: `${todayPosition}%` }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative h-full">
                    {/* Vertical red line through entire height */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 -translate-x-1/2" />
                    
                    {/* Today label - positioned above */}
                    <div className="absolute -top-1 -translate-x-1/2 text-xs font-medium text-red-600 whitespace-nowrap bg-white px-1.5 py-0.5 rounded shadow-sm border border-red-200">
                      Today
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="mb-1">
                  <p className="text-xs">Current date: {format(today, 'MMMM d, yyyy')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      
      {/* Project period labels */}
      {showProjectLabels && (
        <div className="relative flex justify-between text-xs mt-4 pt-2 border-t border-gray-100">
          <div className="flex flex-col items-start bg-gray-50 px-3 py-1.5 rounded">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">Start</span>
            <span className="font-medium text-gray-900">{format(start, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex flex-col items-end bg-gray-50 px-3 py-1.5 rounded">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">End</span>
            <span className="font-medium text-gray-900">{format(end, 'MMM d, yyyy')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Wrapper component with legend
interface GanttTimelineWithLegendProps extends GanttTimelineProps {
  showLegend?: boolean;
}

export function GanttTimelineWithLegend(props: GanttTimelineWithLegendProps) {
  const { showLegend = true, legendClassName = '', ...rest } = props;
  
  return (
    <div className="space-y-3">
      {showLegend && (
        <div className={`flex items-center justify-end gap-4 ${legendClassName}`}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-200 rounded-sm"></div>
            <span className="text-xs text-gray-600">Project period</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 bg-red-500"></div>
            <span className="text-xs text-gray-600">Today</span>
          </div>
        </div>
      )}
      <GanttTimeline {...rest} />
    </div>
  );
}

// Compact version
export function CompactGanttTimeline(props: GanttTimelineProps) {
  return (
    <GanttTimeline
      {...props}
      showProjectLabels={false}
      showDuration={false}
    />
  );
}

export default GanttTimeline;