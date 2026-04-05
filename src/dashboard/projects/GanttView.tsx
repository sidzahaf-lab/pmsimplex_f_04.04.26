// GanttView.tsx - Fixed today line to span ALL project rows
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Calendar, 
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { ProjectAPI, BusinessUnitAPI } from '@/services/api';
import { exportToExcel } from '@/utils/excelExport';

// Types
interface Project {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  description: string | null;
  health_status: 'good' | 'warning' | 'critical' | null;
  current_phase: string | null;
  contract_type: string | null;
  contract_value: number | null;
  currency: string | null;
  start_date: string;
  planned_end_date: string;
  baseline_finish_date: string | null;
  current_finish_date: string | null;
  business_unit_id: string | null;
  is_active: boolean;
  business_unit?: {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
  };
  creator?: {
    id: string;
    name: string;
    family_name: string;
    email: string;
  };
  duration?: number;
  progress?: number;
}

interface BusinessUnit {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

const ZOOM_CONFIG: Record<ZoomLevel, { 
  label: string; 
  increment: number; 
  unit: string;
  headerFormat: (date: Date) => string;
  cellWidth: number;
}> = {
  day: {
    label: 'Day',
    increment: 1,
    unit: 'day',
    headerFormat: (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cellWidth: 60
  },
  week: {
    label: 'Week',
    increment: 7,
    unit: 'week',
    headerFormat: (date: Date) => {
      const weekNum = Math.ceil(date.getDate() / 7);
      return `W${weekNum}`;
    },
    cellWidth: 70
  },
  month: {
    label: 'Month',
    increment: 30,
    unit: 'month',
    headerFormat: (date: Date) => {
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return `${month}-${year}`;
    },
    cellWidth: 90
  },
  quarter: {
    label: 'Quarter',
    increment: 90,
    unit: 'quarter',
    headerFormat: (date: Date) => {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const year = date.getFullYear().toString().slice(-2);
      return `Q${quarter} ${year}`;
    },
    cellWidth: 100
  },
  year: {
    label: 'Year',
    increment: 365,
    unit: 'year',
    headerFormat: (date: Date) => date.getFullYear().toString(),
    cellWidth: 120
  }
};

const PROJECT_PHASES = [
  'FEED (Front-End Engineering Design)',
  'Detailed Engineering',
  'Procurement',
  'Construction',
  'Pre-Commissioning',
  'Commissioning',
  'Close-out'
];

const PHASE_COLORS = {
  'FEED (Front-End Engineering Design)': '#3B82F6',
  'Detailed Engineering': '#10B981',
  'Procurement': '#F59E0B',
  'Construction': '#EF4444',
  'Pre-Commissioning': '#8B5CF6',
  'Commissioning': '#EC4899',
  'Close-out': '#6B7280',
  'default': '#9CA3AF'
};

const HEALTH_STATUS_COLORS = {
  'good': '#10B981',
  'warning': '#F59E0B',
  'critical': '#EF4444',
  'default': '#9CA3AF'
};

export function GanttView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedHealthStatus, setSelectedHealthStatus] = useState<string>('ALL');
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [timelineStart, setTimelineStart] = useState<Date>(new Date());
  const [timelineEnd, setTimelineEnd] = useState<Date>(new Date());
  const [showBaseline, setShowBaseline] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let projectsData: Project[] = [];
      try {
        const projectsResponse = await ProjectAPI.getWithBusinessUnit({ limit: 100 });
        const responseData = projectsResponse.data;
        
        if (responseData?.data?.projects) {
          projectsData = responseData.data.projects;
        } else if (responseData?.projects) {
          projectsData = responseData.projects;
        } else if (Array.isArray(responseData)) {
          projectsData = responseData;
        }
      } catch (error) {
        const projectsResponse = await ProjectAPI.getAll({ limit: 100 });
        const responseData = projectsResponse.data;
        
        if (responseData?.data?.projects) {
          projectsData = responseData.data.projects;
        } else if (responseData?.projects) {
          projectsData = responseData.projects;
        } else if (Array.isArray(responseData)) {
          projectsData = responseData;
        }
      }
      
      const projectsWithCalculations = projectsData
        .filter(project => project.is_active !== false)
        .map(project => {
          const start = new Date(project.start_date);
          const plannedEnd = new Date(project.planned_end_date);
          const duration = Math.ceil((plannedEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          let progress = 0;
          if (project.current_phase) {
            const phaseIndex = PROJECT_PHASES.indexOf(project.current_phase);
            if (phaseIndex >= 0) {
              progress = Math.round(((phaseIndex + 1) / PROJECT_PHASES.length) * 100);
            }
          }
          
          return { ...project, duration, progress };
        });
      
      const sortedProjects = [...projectsWithCalculations].sort((a, b) => {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });
      
      setProjects(sortedProjects);
      
      let businessUnitsData: BusinessUnit[] = [];
      try {
        const businessUnitsResponse = await BusinessUnitAPI.getAll();
        const businessUnitsResponseData = businessUnitsResponse.data;
        
        if (businessUnitsResponseData?.data?.business_units) {
          businessUnitsData = businessUnitsResponseData.data.business_units;
        } else if (businessUnitsResponseData?.business_units) {
          businessUnitsData = businessUnitsResponseData.business_units;
        } else if (Array.isArray(businessUnitsResponseData)) {
          businessUnitsData = businessUnitsResponseData;
        }
        
        setBusinessUnits(businessUnitsData);
      } catch (error) {
        setBusinessUnits([]);
      }
      
      if (projectsWithCalculations.length > 0) {
        const startDates = projectsWithCalculations.map(p => new Date(p.start_date));
        const endDates = projectsWithCalculations.map(p => new Date(p.planned_end_date));
        const minStart = new Date(Math.min(...startDates.map(d => d.getTime())));
        const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
        
        const paddingMonths = 2;
        minStart.setMonth(minStart.getMonth() - paddingMonths);
        maxEnd.setMonth(maxEnd.getMonth() + paddingMonths);
        
        setTimelineStart(minStart);
        setTimelineEnd(maxEnd);
      }
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(350, Math.min(700, resizeStartWidthRef.current + deltaX));
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const container = ganttContainerRef.current;
    if (container) {
      const handleScroll = () => {
        setScrollOffset(container.scrollLeft);
      };
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExportGantt = () => {
    const exportData = filteredProjects.map(project => ({
      'Project Name': project.name,
      'Project Code': project.code,
      'Phase': project.current_phase || 'N/A',
      'Health Status': project.health_status?.toUpperCase() || 'N/A',
      'Start Date': formatMonthYear(project.start_date),
      'End Date': formatMonthYear(project.planned_end_date),
      'Duration (days)': project.duration || 0,
      'Progress (%)': project.progress || 0,
      'Client': project.client_name || 'N/A',
      'Business Unit': project.business_unit?.name || 'N/A'
    }));
    
    const timestamp = new Date().toISOString().split('T')[0];
    exportToExcel(exportData, `Gantt_Chart_${timestamp}.xlsx`, 'Gantt Chart');
  };

  const formatMonthYear = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    return `${month}-${year}`;
  };

  const getTimelineHeaders = () => {
    const headers: { label: string; startDate: Date; width: number }[] = [];
    const config = ZOOM_CONFIG[zoomLevel];
    let currentDate = new Date(timelineStart);
    
    if (zoomLevel === 'month') {
      currentDate.setDate(1);
    } else if (zoomLevel === 'quarter') {
      currentDate.setMonth(Math.floor(currentDate.getMonth() / 3) * 3, 1);
    } else if (zoomLevel === 'year') {
      currentDate.setMonth(0, 1);
    }
    
    while (currentDate <= timelineEnd) {
      headers.push({
        label: config.headerFormat(currentDate),
        startDate: new Date(currentDate),
        width: config.cellWidth
      });
      
      if (zoomLevel === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (zoomLevel === 'quarter') {
        currentDate.setMonth(currentDate.getMonth() + 3);
      } else if (zoomLevel === 'year') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else {
        currentDate.setDate(currentDate.getDate() + config.increment);
      }
    }
    
    return headers;
  };

  const totalGanttWidth = useMemo(() => {
    const headers = getTimelineHeaders();
    return headers.reduce((sum, header) => sum + header.width, 0);
  }, [timelineStart, timelineEnd, zoomLevel]);

  const calculateBarPosition = (task: Project) => {
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const startOffset = new Date(task.start_date).getTime() - timelineStart.getTime();
    const taskDuration = (task.duration || 1) * 24 * 60 * 60 * 1000;
    
    const position = (startOffset / totalDuration) * totalGanttWidth;
    const width = (taskDuration / totalDuration) * totalGanttWidth;
    
    return { position, width: Math.max(width, 4) };
  };

  const todayPosition = useMemo(() => {
    const today = new Date();
    const totalDuration = timelineEnd.getTime() - timelineStart.getTime();
    const todayOffset = today.getTime() - timelineStart.getTime();
    const position = (todayOffset / totalDuration) * totalGanttWidth;
    
    if (position >= 0 && position <= totalGanttWidth) {
      return position;
    }
    return null;
  }, [timelineStart, timelineEnd, totalGanttWidth]);

  const calculateProgressWidth = (task: Project, barWidth: number) => {
    const progress = (task.progress || 0) / 100;
    return barWidth * progress;
  };

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    if (selectedProjectId !== 'ALL') {
      filtered = filtered.filter(p => p.id === selectedProjectId);
    }
    
    if (selectedBusinessUnit !== 'ALL') {
      filtered = filtered.filter(p => p.business_unit?.id === selectedBusinessUnit);
    }
    
    if (selectedHealthStatus !== 'ALL') {
      filtered = filtered.filter(p => p.health_status === selectedHealthStatus);
    }
    
    if (selectedPhase !== 'ALL') {
      filtered = filtered.filter(p => p.current_phase === selectedPhase);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.business_unit?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [projects, searchTerm, selectedHealthStatus, selectedPhase, selectedBusinessUnit, selectedProjectId]);

  const getTaskColor = (task: Project) => {
    // Always return dark blue for planned bars
    return '#04f909'; // Dark blue color for planned bars
  };

  // Calculate total height of all rows including borders
  const totalRowsHeight = useMemo(() => {
    const rowHeight = 71; // 70px min-height + 1px border
    return filteredProjects.length * rowHeight;
  }, [filteredProjects.length]);

  const renderProjects = (tasks: Project[]): JSX.Element[] => {
    return tasks.map((task, index) => {
      const barPosition = calculateBarPosition(task);
      const isEvenRow = index % 2 === 0;
      
      return (
        <div
          key={task.id}
          className="gantt-row hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            minHeight: '70px',
            backgroundColor: isEvenRow ? 'white' : '#fafafa',
            position: 'relative'
          }}
        >
          <div
            className="gantt-task-info"
            style={{
              width: `${sidebarWidth}px`,
              padding: '10px 12px',
              borderRight: '2px solid #e5e7eb',
              position: 'sticky',
              left: 0,
              zIndex: 10,
              backgroundColor: isEvenRow ? 'white' : '#fafafa',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{task.name}</div>
                <div className="task-progress text-xs font-medium px-2 py-0.5 bg-gray-100 rounded">
                  {task.progress}%
                </div>
              </div>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {task.code && <span className="font-mono">Code: {task.code}</span>}
                {task.client_name && <span>Client: {task.client_name}</span>}
                {task.business_unit && <span>BU: {task.business_unit.name}</span>}
                <span>
                  {formatMonthYear(task.start_date)} → {formatMonthYear(task.planned_end_date)}
                </span>
                {task.duration && <span>Duration: {task.duration} days</span>}
              </div>
              
              <div className="flex gap-2 mt-1">
                {task.current_phase && (
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                    {task.current_phase.replace(' (Front-End Engineering Design)', '')}
                  </span>
                )}
                {task.health_status && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    task.health_status === 'good' ? 'bg-green-50 text-green-700' :
                    task.health_status === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {task.health_status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div
            className="gantt-bars"
            style={{
              flex: 1,
              position: 'relative',
              backgroundColor: isEvenRow ? 'white' : '#fafafa',
              minWidth: `${totalGanttWidth}px`,
              overflow: 'visible'
            }}
          >
            {getTimelineHeaders().map((header, idx) => {
              const leftPosition = header.width * idx;
              return (
                <div
                  key={`grid-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${leftPosition}px`,
                    top: 0,
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#e5e7eb',
                    pointerEvents: 'none'
                  }}
                />
              );
            })}
            
            {showBaseline && task.baseline_finish_date && (
              <div
                className="baseline-bar"
                style={{
                  position: 'absolute',
                  left: `${barPosition.position}px`,
                  top: '18px',
                  width: `${barPosition.width}px`,
                  height: '24px',
                  backgroundColor: '#d1d5db',
                  opacity: 0.5,
                  borderRadius: '4px',
                  zIndex: 1
                }}
              />
            )}
            
            <div
              className="task-bar"
              style={{
                position: 'absolute',
                left: `${barPosition.position}px`,
                top: '18px',
                width: `${barPosition.width}px`,
                height: '24px',
                backgroundColor: getTaskColor(task),
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 2,
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              onClick={() => handleTaskClick(task)}
              title={`${task.name}\nStart: ${formatMonthYear(task.start_date)}\nEnd: ${formatMonthYear(task.planned_end_date)}\nProgress: ${task.progress}%\nDuration: ${task.duration} days`}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${calculateProgressWidth(task, barPosition.width)}px`,
                  height: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.35)',
                  transition: 'width 0.3s'
                }}
              />
              
              {barPosition.width > 100 && (
                <span
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '5px',
                    fontSize: '12px',
                    color: 'black',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                </span>
              )}
              
              {barPosition.width > 60 && task.progress && task.progress > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '5px',
                    fontSize: '12px',
                    color: 'black',
                    fontWeight: 600
                  }}
                >
                  {task.progress}%
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  const handleTaskClick = (task: Project) => {
    window.location.href = `/projects/edit/${task.id}`;
  };

  const zoomLevels: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];
  
  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevel);
    if (currentIndex < zoomLevels.length - 1) {
      setZoomLevel(zoomLevels[currentIndex + 1]);
    }
  };

  const handleTimelineNavigation = (direction: 'prev' | 'next') => {
    const config = ZOOM_CONFIG[zoomLevel];
    const offset = direction === 'prev' ? -config.increment * 2 : config.increment * 2;
    const newStart = new Date(timelineStart);
    const newEnd = new Date(timelineEnd);
    
    if (zoomLevel === 'month') {
      newStart.setMonth(newStart.getMonth() + offset / 30);
      newEnd.setMonth(newEnd.getMonth() + offset / 30);
    } else if (zoomLevel === 'quarter') {
      newStart.setMonth(newStart.getMonth() + offset / 30);
      newEnd.setMonth(newEnd.getMonth() + offset / 30);
    } else if (zoomLevel === 'year') {
      newStart.setFullYear(newStart.getFullYear() + offset / 365);
      newEnd.setFullYear(newEnd.getFullYear() + offset / 365);
    } else {
      newStart.setDate(newStart.getDate() + offset);
      newEnd.setDate(newEnd.getDate() + offset);
    }
    
    setTimelineStart(newStart);
    setTimelineEnd(newEnd);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = sidebarWidth;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const clearFilters = () => {
    setSelectedProjectId('ALL');
    setSelectedBusinessUnit('ALL');
    setSelectedHealthStatus('ALL');
    setSelectedPhase('ALL');
    setSearchTerm('');
  };

  const headers = getTimelineHeaders();
  const uniqueProjects = projects;

  return (
    <div className={`flex-1 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-blue-600" />
                  Gantt Chart View
                </h1>
                <p className="text-sm text-gray-500">
                  Project timeline visualization with progress tracking
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportGantt}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 min-w-[220px]"
              >
                <option value="ALL">📊 All Projects ({uniqueProjects.length})</option>
                {uniqueProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    📋 {project.name} ({formatMonthYear(project.start_date)} - {formatMonthYear(project.planned_end_date)})
                  </option>
                ))}
              </select>
              
              <select
                value={selectedBusinessUnit}
                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 min-w-[180px]"
              >
                <option value="ALL">🏢 All Business Units</option>
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.name}</option>
                ))}
              </select>
              
              <select
                value={selectedHealthStatus}
                onChange={(e) => setSelectedHealthStatus(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
              >
                <option value="ALL">💚 All Health</option>
                <option value="good">✅ Good</option>
                <option value="warning">⚠️ Warning</option>
                <option value="critical">🔴 Critical</option>
              </select>
              
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 min-w-[150px]"
              >
                <option value="ALL">📐 All Phases</option>
                {PROJECT_PHASES.map(phase => (
                  <option key={phase} value={phase}>{phase.replace(' (Front-End Engineering Design)', '')}</option>
                ))}
              </select>
              
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              
              {(selectedProjectId !== 'ALL' || selectedBusinessUnit !== 'ALL' || 
                selectedHealthStatus !== 'ALL' || selectedPhase !== 'ALL' || searchTerm) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear Filters
                </Button>
              )}
              
              <div className="border-l pl-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[50px] text-center">
                  {ZOOM_CONFIG[zoomLevel].label}
                </span>
                <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleTimelineNavigation('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleTimelineNavigation('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-3 ml-auto">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showBaseline}
                    onChange={(e) => setShowBaseline(e.target.checked)}
                    className="rounded"
                  />
                  Show Baseline
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto py-4 px-4">
        <Card className="overflow-hidden shadow-lg">
          <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-white">
            <CardTitle>Project Timeline - Gantt Chart</CardTitle>
            <CardDescription>
              Visual project schedule with progress tracking
              {filteredProjects.length > 0 && ` • Showing ${filteredProjects.length} projects`}
              {` • ${ZOOM_CONFIG[zoomLevel].label} view`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading Gantt chart...</span>
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-600">
                <p>Error loading data: {error}</p>
                <Button onClick={handleRefresh} variant="outline" className="mt-4">
                  Retry
                </Button>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No projects found matching your criteria</p>
                <Button onClick={clearFilters} variant="outline" className="mt-4">
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <div className="gantt-container overflow-x-auto">
                <div
                  className="resize-handle"
                  onMouseDown={startResize}
                  style={{
                    position: 'sticky',
                    left: `${sidebarWidth}px`,
                    width: '4px',
                    height: '100%',
                    backgroundColor: '#e5e7eb',
                    cursor: 'col-resize',
                    zIndex: 20,
                    top: 0
                  }}
                />
                
                <div className="gantt-header sticky top-0 z-20 bg-white dark:bg-gray-900 border-b shadow-sm">
                  <div style={{ display: 'flex' }}>
                    <div
                      className="gantt-header-task-col font-semibold"
                      style={{
                        width: `${sidebarWidth}px`,
                        padding: '14px 12px',
                        borderRight: '2px solid #e5e7eb',
                        backgroundColor: '#f8f9fa',
                        fontSize: '13px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      Project Name / Details
                    </div>
                    <div
                      className="gantt-header-timeline"
                      style={{
                        flex: 1,
                        display: 'flex',
                        backgroundColor: '#f8f9fa',
                        minWidth: `${totalGanttWidth}px`,
                        position: 'relative'
                      }}
                    >
                      {headers.map((header, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: `${header.width}px`,
                            padding: '14px 4px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: '600',
                            borderRight: '1px solid #e5e7eb',
                            color: '#374151',
                            flexShrink: 0
                          }}
                        >
                          {header.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div
                  ref={ganttContainerRef}
                  className="gantt-rows"
                  style={{
                    overflowX: 'auto',
                    maxHeight: 'calc(100vh - 400px)',
                    position: 'relative'
                  }}
                >
                  {/* Today Line - spans from first row to last row */}
                  {todayPosition !== null && totalRowsHeight > 0 && (
                    <div
                      className="today-line"
                      style={{
                        position: 'absolute',
                        left: `${sidebarWidth + todayPosition - scrollOffset}px`,
                        top: '0px',
                        width: '3px',
                        height: `${totalRowsHeight}px`,
                        backgroundColor: '#ef4444',
                        zIndex: 15,
                        pointerEvents: 'none',
                        boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '-20px',
                          fontSize: '10px',
                          color: '#ef4444',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          backgroundColor: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #ef4444',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          zIndex: 16
                        }}
                      >
                        TODAY
                      </div>
                    </div>
                  )}
                  
                  {renderProjects(filteredProjects)}
                </div>
              </div>
            )}
            
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
              <div className="flex flex-wrap justify-between items-center">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="font-semibold">Legend:</div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-3 bg-blue-800 rounded" />
                    <span className="text-xs">Planned</span>
                  </div>
                  <div className="border-l pl-4 flex items-center gap-2">
                    <div className="w-0.5 h-5 bg-red-500" />
                    <span className="text-xs">Today</span>
                  </div>
                  {showBaseline && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-3 bg-gray-400 opacity-50 rounded" />
                      <span className="text-xs">Baseline</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  Total: {uniqueProjects.length} | Showing: {filteredProjects.length} | View: {ZOOM_CONFIG[zoomLevel].label}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <style jsx>{`
        .gantt-row:hover {
          background-color: #f9fafb !important;
        }
        
        .task-bar:hover {
          opacity: 0.9;
          transform: scaleY(1.05);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transition: all 0.2s;
        }
        
        .resize-handle:hover {
          background-color: #3b82f6;
        }
        
        .gantt-rows {
          position: relative;
        }
        
        .today-line {
          transition: left 0.1s ease;
        }
        
        ::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

export default GanttView;