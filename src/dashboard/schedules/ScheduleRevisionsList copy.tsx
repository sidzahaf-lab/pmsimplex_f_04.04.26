// ScheduleRevisionsList.tsx
import { useState, useEffect, useMemo } from 'react';
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
  FileWarning
} from 'lucide-react';
import { ScheduleRevisionsAPI, ScheduleAPI } from '@/services/api';
import { exportToExcel } from '@/utils/excelExport';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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
}

export function ScheduleRevisionsList() {
  const [revisions, setRevisions] = useState<ScheduleRevision[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('ALL');
  const [exportLoading, setExportLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching schedule revisions...');
      
      // Fetch revisions with relations
      let revisionsData: ScheduleRevision[] = [];
      
      try {
        const revisionsResponse = await ScheduleRevisionsAPI.getAll({ 
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
        
        // Sort by created_at (newest first by default)
        revisionsData.sort((a, b) => {
          if (sortOrder === 'newest') {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          } else {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
        });
        
      } catch (error) {
        console.error('❌ Error fetching revisions:', error);
        throw error;
      }
      
      console.log('🎯 Processed Revisions:', revisionsData);
      console.log('📊 Total revisions count:', revisionsData.length);
      
      setRevisions(revisionsData);
      
      // Fetch schedules for filtering
      console.log('🔍 Fetching schedules...');
      let schedulesData: Schedule[] = [];
      try {
        const schedulesResponse = await ScheduleAPI.getAll({ limit: 100 });
        const schedulesResponseData = schedulesResponse.data;
        
        if (schedulesResponseData?.data?.schedules) {
          schedulesData = schedulesResponseData.data.schedules;
        } else if (schedulesResponseData?.schedules) {
          schedulesData = schedulesResponseData.schedules;
        } else if (Array.isArray(schedulesResponseData)) {
          schedulesData = schedulesResponseData;
        } else if (schedulesResponseData?.data && Array.isArray(schedulesResponseData.data)) {
          schedulesData = schedulesResponseData.data;
        }
        
        console.log('✅ Schedules:', schedulesData);
        setSchedules(schedulesData);
      } catch (error) {
        console.log('⚠️ Could not fetch schedules');
        setSchedules([]);
      }
      
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
        setError(`Request error: ${error.message}`);
      }
      
      setRevisions([]);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, sortOrder]);

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
        'Schedule Code': revision.schedule?.code || 'N/A',
        'Schedule Name': revision.schedule?.name || 'N/A',
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
      const filename = `Schedule_Revisions_${timestamp}.xlsx`;
      
      exportToExcel(excelData, filename, 'Schedule Revisions List');
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError('Failed to export data to Excel');
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
    
    if (selectedSchedule !== 'ALL') {
      filtered = filtered.filter(revision => revision.schedule_id === selectedSchedule);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(revision => 
        revision.schedule?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.schedule?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.source_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.revision_notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        revision.revision_number?.toString().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [revisions, searchTerm, selectedStatus, selectedSchedule]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this revision? This action cannot be undone.')) {
      return;
    }

    try {
      await ScheduleRevisionsAPI.delete(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting revision:', error);
      setError(error.response?.data?.message || 'Failed to delete revision');
    }
  };

  const handleMarkCurrent = async (id: string) => {
    if (!window.confirm('Are you sure you want to mark this revision as current? This will supersede the current revision.')) {
      return;
    }

    try {
      await ScheduleRevisionsAPI.markCurrent(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error marking revision as current:', error);
      setError(error.response?.data?.message || 'Failed to mark revision as current');
    }
  };

  const handleDownloadFile = async (revision: ScheduleRevision) => {
    try {
      const response = await ScheduleRevisionsAPI.downloadFile(revision.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', revision.source_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      console.error('Error downloading file:', error);
      setError(error.response?.data?.message || 'Failed to download file');
    }
  };

  const handleViewRevision = (revision: ScheduleRevision) => {
    window.location.href = `/revisions/${revision.id}`;
  };

  const handleUploadRevision = () => {
    window.location.href = '/revisions/upload';
  };

  const handleViewSchedule = (scheduleId: string) => {
    window.location.href = `/schedules/${scheduleId}`;
  };

  const handleCompareRevisions = (revision1Id: string, revision2Id: string) => {
    window.location.href = `/revisions/compare/${revision1Id}/${revision2Id}`;
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
          icon: <Target className="h-3 w-3 mr-1" />,
          label: 'Baseline'
        };
      case 'forecast':
        return {
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <TrendingUp className="h-3 w-3 mr-1" />,
          label: 'Forecast'
        };
      case 'actual':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <BarChart3 className="h-3 w-3 mr-1" />,
          label: 'Actual'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <FileText className="h-3 w-3 mr-1" />,
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
      accessorKey: 'schedule.code',
      header: 'Schedule',
      cell: ({ row }) => {
        const revision = row.original;
        return revision.schedule ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button 
                variant="link" 
                className="h-auto p-0 font-medium text-left"
                onClick={() => handleViewSchedule(revision.schedule_id)}
              >
                {revision.schedule.code}
              </Button>
              <Badge 
                variant="outline" 
                className={`text-xs ${getScheduleStatusBadgeProps(revision.schedule.status).color}`}
              >
                {getScheduleStatusBadgeProps(revision.schedule.status).label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
              {revision.schedule.name}
            </div>
            {revision.schedule.workpackage && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {revision.schedule.workpackage.code}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Schedule not found</span>
        );
      },
    },
    {
      accessorKey: 'revision_status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('revision_status') as string;
        const badgeProps = getStatusBadgeProps(status);
        return (
          <div className="flex items-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeProps.color}`}>
              {badgeProps.icon}
              {badgeProps.label}
            </span>
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
              {formatDateTime(revision.created_at).split(' ')[3]} {/* Time only */}
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
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewRevision(revision)}
              className="flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadFile(revision)}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewRevision(revision)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => handleDownloadFile(revision)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </DropdownMenuItem>
                
                {revision.revision_status !== 'current' && (
                  <DropdownMenuItem onClick={() => handleMarkCurrent(revision.id)}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Mark as Current
                  </DropdownMenuItem>
                )}
                
                {/* Compare option - only show if there are other revisions for the same schedule */}
                {revisions.filter(r => r.schedule_id === revision.schedule_id && r.id !== revision.id).length > 0 && (
                  <DropdownMenuItem 
                    onClick={() => {
                      const otherRevision = revisions.find(r => r.schedule_id === revision.schedule_id && r.id !== revision.id);
                      if (otherRevision) {
                        handleCompareRevisions(revision.id, otherRevision.id);
                      }
                    }}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Compare with Another
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleDelete(revision.id)}
                >
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

  const scheduleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: revisions.length
    };
    
    schedules.forEach(schedule => {
      const scheduleRevisions = revisions.filter(r => r.schedule_id === schedule.id);
      counts[schedule.id] = scheduleRevisions.length;
    });
    
    return counts;
  }, [revisions, schedules]);

  const totalFileSize = useMemo(() => {
    return revisions.reduce((total, revision) => {
      return total + (revision.source_file_size || 0);
    }, 0);
  }, [revisions]);

  return (
    <div className="flex-1">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Schedule Revisions</h1>
              <p className="text-muted-foreground">
                Manage and track all schedule revisions with version control and file management
              </p>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revisions</p>
                      <p className="text-2xl font-bold">{revisions.length}</p>
                    </div>
                    <History className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Revisions</p>
                      <p className="text-2xl font-bold">{statusCounts.current}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Under Review</p>
                      <p className="text-2xl font-bold">{statusCounts.under_review}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total File Size</p>
                      <p className="text-2xl font-bold">{formatFileSize(totalFileSize)}</p>
                    </div>
                    <FileText className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleUploadRevision}
                className="flex items-center gap-2"
              >
                <FolderUp className="h-4 w-4" />
                Upload Revision
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
              
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Search, Filters, and Controls */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-4">
            <div className="relative w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by schedule code, filename, revision number, or notes..."
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
              
              {/* Schedule Filter */}
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedSchedule}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  className="border rounded p-2 text-sm min-w-[180px]"
                >
                  <option value="ALL">All Schedules ({scheduleCounts.ALL})</option>
                  {schedules.map(schedule => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.code} ({scheduleCounts[schedule.id] || 0})
                    </option>
                  ))}
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
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">
                <strong>Error:</strong> {error}
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-2">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto py-6">
        {/* Revisions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Revisions List</CardTitle>
            <CardDescription>
              Manage all schedule revisions with version control and file management
              {table.getPageCount() > 1 && ` • Use pagination controls to navigate through all revisions`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading revisions...</span>
              </div>
            ) : filteredRevisions.length === 0 ? (
              <div className="text-center py-8">
                <History className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchTerm || selectedStatus !== 'ALL' || selectedSchedule !== 'ALL' 
                    ? 'No revisions found' 
                    : 'No revisions'}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {searchTerm ? 'Try adjusting your search terms' : 
                   selectedStatus !== 'ALL' || selectedSchedule !== 'ALL' 
                     ? 'Try selecting different filters' : 
                     'Get started by uploading your first revision'}
                </p>
                {(!searchTerm && selectedStatus === 'ALL' && selectedSchedule === 'ALL') && (
                  <Button 
                    onClick={handleUploadRevision}
                    className="mt-4"
                  >
                    <FolderUp className="h-4 w-4 mr-2" />
                    Upload Revision
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
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {table.getRowModel().rows.length} of {filteredRevisions.length} revisions
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
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