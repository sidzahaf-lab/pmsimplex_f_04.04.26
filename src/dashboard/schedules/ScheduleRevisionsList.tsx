// ScheduleRevisionsList.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel, 
  ColumnDef, 
  flexRender 
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft,
  Plus, 
  MoreHorizontal,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Filter,
  Clock,
  CheckSquare,
  FileX,
  Download,
  Archive,
  FileText,
  BarChart3,
  Layers,
  FolderUp,
  History,
  Eye,
  Hash,
  FileCheck,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingUp
} from 'lucide-react';
import { ScheduleRevisionsAPI, ScheduleAPI } from '@/services/api';
import { exportToExcel } from '@/utils/excelExport';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Types
interface ScheduleRevision {
  id: string;
  schedule_id: string;
  revision_number: number;
  revision_notes?: string;
  revision_status: 'under_review' | 'current' | 'superseded';
  planned_start?: string;
  planned_finish?: string;
  data_date?: string;
  actual_data_date?: string;
  source_filename: string;
  source_file_hash: string;
  hash_algorithm: string;
  source_file_size?: number;
  source_file_path?: string;
  created_at: string;
  superseded_by?: string;
  
  // Relations
  schedule?: {
    id: string;
    code: string;
    name: string;
    type: 'baseline' | 'forecast' | 'actual';
    status: 'active' | 'archived';
    workpackage_id?: string;
    workpackage?: {
      id: string;
      code: string;
      name: string;
    };
  };
  
  superseding_revision?: {
    id: string;
    revision_number: number;
    created_at: string;
  };
}

interface Schedule {
  id: string;
  code: string;
  name: string;
  type: 'baseline' | 'forecast' | 'actual';
  status: 'active' | 'archived';
  workpackage_id?: string;
  workpackage?: {
    id: string;
    code: string;
    name: string;
    deliverable?: {
      id: string;
      code: string;
      name: string;
      project?: {
        id: string;
        code: string;
        name: string;
      };
    };
  };
}

export function ScheduleRevisionsList() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  
  const [revisions, setRevisions] = useState<ScheduleRevision[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [exportLoading, setExportLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching schedule and revisions for schedule ID:', scheduleId);
      
      if (!scheduleId) {
        throw new Error('Schedule ID is required');
      }
      
      // Fetch schedule details
      let scheduleData: Schedule | null = null;
      try {
        const scheduleResponse = await ScheduleAPI.getById(scheduleId);
        const responseData = scheduleResponse.data;
        
        if (responseData?.data?.schedule) {
          scheduleData = responseData.data.schedule;
        } else if (responseData?.schedule) {
          scheduleData = responseData.schedule;
        } else {
          scheduleData = responseData;
        }
        
        console.log('✅ Schedule data:', scheduleData);
        setSchedule(scheduleData);
      } catch (error) {
        console.error('❌ Error fetching schedule:', error);
        throw new Error('Failed to load schedule details');
      }
      
      // Fetch revisions for this schedule
      let revisionsData: ScheduleRevision[] = [];
      try {
        const revisionsResponse = await ScheduleRevisionsAPI.getBySchedule(scheduleId, { 
          include: 'all',
          limit: 100 
        });
        
        console.log('✅ Revisions response:', revisionsResponse.data);
        
        const responseData = revisionsResponse.data;
        if (responseData?.data?.revisions) {
          revisionsData = responseData.data.revisions;
        } else if (responseData?.revisions) {
          revisionsData = responseData.revisions;
        } else if (Array.isArray(responseData)) {
          revisionsData = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          revisionsData = responseData.data;
        }
        
        // Sort by created_at
        revisionsData.sort((a, b) => {
          if (sortOrder === 'newest') {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          } else {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
        });
        
      } catch (error) {
        console.error('❌ Error fetching revisions:', error);
        throw new Error('Failed to load schedule revisions');
      }
      
      console.log('🎯 Processed Revisions:', revisionsData);
      console.log('📊 Total revisions count:', revisionsData.length);
      
      setRevisions(revisionsData);
      
    } catch (error: any) {
      console.error('❌ Error fetching data:', error);
      
      if (error.response) {
        console.error('❌ Server error response:', error.response.status, error.response.data);
        setError(`Server error (${error.response.status}): ${error.response.data?.message || 'Failed to load revisions'}`);
      } else if (error.request) {
        console.error('❌ No response received:', error.request);
        setError('Network error: Cannot connect to server. Please make sure backend is running.');
      } else {
        console.error('❌ Request error:', error.message);
        setError(error.message || 'Failed to load schedule revisions');
      }
      
      setRevisions([]);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [scheduleId, refreshTrigger, sortOrder]);

  const handleBackToSchedules = () => {
    navigate('/schedules');
  };

  const handleGoToSchedule = () => {
    if (scheduleId) {
      navigate(`/schedules/${scheduleId}`);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExportExcel = () => {
    setExportLoading(true);
    
    try {
      const dataToExport = filteredRevisions.length > 0 ? filteredRevisions : revisions;
      
      const excelData = dataToExport.map(revision => ({
        'Revision ID': revision.id,
        'Revision Number': revision.revision_number,
        'Schedule Code': schedule?.code || 'N/A',
        'Schedule Name': schedule?.name || 'N/A',
        'Status': revision.revision_status.charAt(0).toUpperCase() + revision.revision_status.slice(1),
        'Filename': revision.source_filename,
        'File Hash': revision.source_file_hash.substring(0, 12) + '...',
        'File Size (MB)': revision.source_file_size ? (revision.source_file_size / 1024 / 1024).toFixed(2) : 'N/A',
        'Revision Notes': revision.revision_notes || 'N/A',
        'Planned Start': revision.planned_start ? formatDateForExcel(revision.planned_start) : 'N/A',
        'Planned Finish': revision.planned_finish ? formatDateForExcel(revision.planned_finish) : 'N/A',
        'Data Date': revision.data_date ? formatDateForExcel(revision.data_date) : 'N/A',
        'Created At': formatDateForExcel(revision.created_at),
        'Superseded By': revision.superseding_revision ? `Rev. ${revision.superseding_revision.revision_number}` : 'N/A'
      }));
      
      const timestamp = format(new Date(), 'yyyy-MM-dd');
      const filename = `Schedule_${schedule?.code}_Revisions_${timestamp}.xlsx`;
      
      exportToExcel(excelData, filename, `${schedule?.code} - Schedule Revisions List`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export data to Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const formatDateForExcel = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredRevisions = useMemo(() => {
    let filtered = revisions;
    
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter(revision => revision.revision_status === selectedStatus);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(revision => 
        revision.source_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.revision_notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.revision_number?.toString().includes(searchTerm) ||
        revision.revision_status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [revisions, searchTerm, selectedStatus]);

  const handleDelete = async (id: string, revisionNumber: number) => {
    if (!window.confirm(`Are you sure you want to delete revision ${revisionNumber}? This action cannot be undone.`)) {
      return;
    }

    setProcessingAction(`deleting-${id}`);
    try {
      await ScheduleRevisionsAPI.delete(id);
      toast.success(`Revision ${revisionNumber} deleted successfully`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting revision:', error);
      toast.error(error.response?.data?.message || 'Failed to delete revision');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleMarkCurrent = async (id: string, revisionNumber: number) => {
    if (!window.confirm(`Are you sure you want to mark revision ${revisionNumber} as current? This will supersede the current revision.`)) {
      return;
    }

    setProcessingAction(`marking-${id}`);
    try {
      await ScheduleRevisionsAPI.markCurrent(id);
      toast.success(`Revision ${revisionNumber} marked as current`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error marking revision as current:', error);
      toast.error(error.response?.data?.message || 'Failed to mark revision as current');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDownloadFile = async (revision: ScheduleRevision) => {
    setProcessingAction(`downloading-${revision.id}`);
    try {
      const response = await ScheduleRevisionsAPI.downloadFile(revision.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', revision.source_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`File downloaded: ${revision.source_filename}`);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error(error.response?.data?.message || 'Failed to download file');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleViewRevision = (revision: ScheduleRevision) => {
    navigate(`/revisions/${revision.id}`);
  };

  const handleUploadRevision = () => {
    if (scheduleId) {
      navigate(`/schedules/${scheduleId}/revisions/create`);
    }
  };

  const handleCompareRevisions = (revision1Id: string, revision2Id: string) => {
    navigate(`/revisions/compare/${revision1Id}/${revision2Id}`);
  };

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'current':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
          label: 'Current'
        };
      case 'under_review':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <Clock className="h-3 w-3 mr-1" />,
          label: 'Under Review'
        };
      case 'superseded':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <FileX className="h-3 w-3 mr-1" />,
          label: 'Superseded'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
          label: status
        };
    }
  };

  const getTypeBadgeProps = (type: string) => {
    switch (type) {
      case 'baseline':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'Baseline'
        };
      case 'forecast':
        return {
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          label: 'Forecast'
        };
      case 'actual':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          label: 'Actual'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: type
        };
    }
  };

  const getScheduleStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          label: 'Active'
        };
      case 'archived':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: 'Archived'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          label: status
        };
    }
  };

  const columns: ColumnDef<ScheduleRevision>[] = [
    {
      accessorKey: 'revision_number',
      header: 'Revision #',
      cell: ({ row }) => (
        <div className="font-mono font-bold text-lg">
          Rev. {row.getValue('revision_number')}
        </div>
      ),
    },
    {
      accessorKey: 'revision_status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('revision_status') as string;
        const badgeProps = getStatusBadgeProps(status);
        return (
          <div className="flex items-center">
            <Badge 
              variant="outline" 
              className={badgeProps.color}
            >
              {badgeProps.icon}
              {badgeProps.label}
            </Badge>
            {row.original.superseding_revision && status === 'superseded' && (
              <div className="ml-2 text-xs text-muted-foreground">
                → Rev. {row.original.superseding_revision.revision_number}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'source_filename',
      header: 'File',
      cell: ({ row }) => {
        const revision = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium text-sm truncate max-w-[200px]" title={revision.source_filename}>
              {revision.source_filename}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {formatFileSize(revision.source_file_size)}
              <Hash className="h-3 w-3 ml-2" />
              <span className="font-mono" title={revision.source_file_hash}>
                {revision.source_file_hash.substring(0, 8)}...
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'revision_notes',
      header: 'Notes',
      cell: ({ row }) => {
        const notes = row.getValue('revision_notes') as string;
        return notes ? (
          <div className="max-w-[200px] truncate text-sm" title={notes}>
            {notes}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm italic">No notes</span>
        );
      },
    },
    {
      accessorKey: 'data_date',
      header: 'Data Date',
      cell: ({ row }) => {
        const revision = row.original;
        return revision.data_date ? (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {formatDate(revision.data_date)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => {
        const revision = row.original;
        return (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {formatDate(revision.created_at)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTime(revision.created_at).split(' ')[3]}
            </div>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const revision = row.original;
        const isProcessing = processingAction?.includes(revision.id);
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewRevision(revision)}
              className="flex items-center gap-1 h-8"
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadFile(revision)}
              disabled={isProcessing}
              className="flex items-center gap-1 h-8"
            >
              {isProcessing && processingAction === `downloading-${revision.id}` ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
              ) : (
                <Download className="h-3 w-3" />
              )}
              Download
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => handleViewRevision(revision)}
                  className="cursor-pointer"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  onClick={() => handleDownloadFile(revision)}
                  disabled={isProcessing}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </DropdownMenuItem>
                
                {revision.revision_status !== 'current' && (
                  <DropdownMenuItem 
                    onClick={() => handleMarkCurrent(revision.id, revision.revision_number)}
                    disabled={isProcessing}
                    className="cursor-pointer text-green-600"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Mark as Current
                  </DropdownMenuItem>
                )}
                
                {/* Compare option - only show if there are other revisions */}
                {revisions.filter(r => r.id !== revision.id).length > 0 && (
                  <DropdownMenuItem 
                    onClick={() => {
                      const otherRevision = revisions.find(r => r.id !== revision.id);
                      if (otherRevision) {
                        handleCompareRevisions(revision.id, otherRevision.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Compare
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600"
                  onClick={() => handleDelete(revision.id, revision.revision_number)}
                  disabled={isProcessing}
                >
                  {isProcessing && processingAction === `deleting-${revision.id}` ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></div>
                  ) : (
                    <FileX className="h-4 w-4 mr-2" />
                  )}
                  Delete Revision
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredRevisions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: revisions.length,
      current: 0,
      under_review: 0,
      superseded: 0
    };
    
    revisions.forEach(revision => {
      counts[revision.revision_status]++;
    });
    
    return counts;
  }, [revisions]);

  const totalFileSize = useMemo(() => {
    return revisions.reduce((total, revision) => {
      return total + (revision.source_file_size || 0);
    }, 0);
  }, [revisions]);

  // Get hierarchy info for the schedule
  const getHierarchyInfo = () => {
    if (!schedule) return null;
    
    const workpackage = schedule.workpackage;
    const deliverable = workpackage?.deliverable;
    const project = deliverable?.project;
    
    return { project, deliverable, workpackage };
  };

  const hierarchy = getHierarchyInfo();

  return (
    <div className="flex-1">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-4">
          <div className="flex flex-col gap-4">
            {/* Back and Schedule Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSchedules}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Schedules
                </Button>
                
                {schedule && (
                  <div className="flex items-center gap-2 ml-4">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGoToSchedule}
                      className="text-sm font-medium"
                    >
                      {schedule.code}
                    </Button>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Revisions</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            
            {/* Schedule Header */}
            {schedule && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold">{schedule.name}</h1>
                        <Badge 
                          variant="outline" 
                          className={getTypeBadgeProps(schedule.type).color}
                        >
                          {getTypeBadgeProps(schedule.type).label}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={getScheduleStatusBadgeProps(schedule.status).color}
                        >
                          {getScheduleStatusBadgeProps(schedule.status).label}
                        </Badge>
                      </div>
                      
                      <div className="text-lg font-mono text-gray-600 mb-3">
                        {schedule.code}
                      </div>
                      
                      {/* Hierarchy Info */}
                      {hierarchy && (
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          {hierarchy.project && (
                            <div className="flex items-center gap-1">
                              <Layers className="h-4 w-4" />
                              <span className="font-medium">{hierarchy.project.code}:</span>
                              <span>{hierarchy.project.name}</span>
                            </div>
                          )}
                          
                          {hierarchy.deliverable && (
                            <div className="flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{hierarchy.deliverable.code}:</span>
                              <span>{hierarchy.deliverable.name}</span>
                            </div>
                          )}
                          
                          {hierarchy.workpackage && (
                            <div className="flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{hierarchy.workpackage.code}:</span>
                              <span>{hierarchy.workpackage.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={handleUploadRevision}
                        className="flex items-center gap-2"
                      >
                        <FolderUp className="h-4 w-4" />
                        Upload New Revision
                      </Button>
                      
                      <Button 
                        variant="outline"
                        onClick={handleExportExcel}
                        disabled={exportLoading || revisions.length === 0}
                        className="flex items-center gap-2"
                      >
                        <Download className={`h-4 w-4 ${exportLoading ? 'animate-pulse' : ''}`} />
                        {exportLoading ? 'Exporting...' : 'Export Excel'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
                        
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-2">
              <div className="relative w-full lg:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by filename, revision number, notes, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full lg:w-[400px]"
                />
              </div>
              
              {/* Filters Section */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="border rounded p-2 text-sm min-w-[140px]"
                  >
                    <option value="ALL">All Status ({statusCounts.ALL})</option>
                    <option value="current">Current ({statusCounts.current})</option>
                    <option value="under_review">Under Review ({statusCounts.under_review})</option>
                    <option value="superseded">Superseded ({statusCounts.superseded})</option>
                  </select>
                </div>
                
                {/* Sort Order */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="border rounded p-2 text-sm min-w-[120px]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Showing {filteredRevisions.length} of {revisions.length} revisions
                  {table.getPageCount() > 1 && ` • Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
                <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-2">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto py-6">
        {/* Revisions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Revisions</CardTitle>
            <CardDescription>
              All revisions for schedule {schedule?.code} - {schedule?.name}
              {table.getPageCount() > 1 && ` • Use pagination controls to navigate through all revisions`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3">Loading revisions...</span>
              </div>
            ) : !schedule ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">Schedule not found</h3>
                <p className="text-muted-foreground mt-2">
                  The requested schedule could not be found.
                </p>
                <Button 
                  onClick={handleBackToSchedules}
                  className="mt-4"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Schedules
                </Button>
              </div>
            ) : filteredRevisions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchTerm || selectedStatus !== 'ALL' 
                    ? 'No revisions found' 
                    : 'No revisions available'}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {searchTerm ? 'Try adjusting your search terms' : 
                   selectedStatus !== 'ALL' 
                     ? 'Try selecting different filters' : 
                     'Upload the first revision for this schedule'}
                </p>
                {(!searchTerm && selectedStatus === 'ALL') && (
                  <Button 
                    onClick={handleUploadRevision}
                    className="mt-4"
                  >
                    <FolderUp className="h-4 w-4 mr-2" />
                    Upload First Revision
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow 
                          key={row.id} 
                          className="hover:bg-gray-50"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {table.getPageCount() > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {table.getRowModel().rows.length} of {filteredRevisions.length} revisions
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                      let pageIndex: number;
                      const currentPage = table.getState().pagination.pageIndex;
                      const totalPages = table.getPageCount();
                      
                      if (totalPages <= 5) {
                        pageIndex = i;
                      } else if (currentPage < 3) {
                        pageIndex = i;
                      } else if (currentPage > totalPages - 4) {
                        pageIndex = totalPages - 5 + i;
                      } else {
                        pageIndex = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageIndex}
                          variant={currentPage === pageIndex ? "default" : "outline"}
                          size="sm"
                          onClick={() => table.setPageIndex(pageIndex)}
                          className="h-8 w-8 p-0"
                        >
                          {pageIndex + 1}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <select
                    value={table.getState().pagination.pageSize}
                    onChange={e => {
                      table.setPageSize(Number(e.target.value))
                    }}
                    className="border rounded p-1 text-sm"
                  >
                    {[10, 20, 30, 50, 100].map(pageSize => (
                      <option key={pageSize} value={pageSize}>
                        {pageSize}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScheduleRevisionsList;