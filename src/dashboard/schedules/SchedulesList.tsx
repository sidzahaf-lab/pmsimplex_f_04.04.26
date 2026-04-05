// SchedulesList.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel, 
  ColumnDef, 
  flexRender 
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search,
  RefreshCw,
  Download,
  FileText,
  Calendar,
  Trash2,
  Upload,
  Eye,
  Edit,
  MoreHorizontal,
  Layers,
  Package,
  Folder,
  Hash,
  FileIcon,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Box, // CHANGED: Replaced 'Cube' with 'Box'
  Target
} from 'lucide-react';
import { ScheduleAPI, ScheduleRevisionsAPI, WorkPackageAPI } from '@/services/api';
import { toast } from 'sonner';
import DeleteScheduleDialog from './DeleteScheduleDialog';

// Types - UPDATED to match WorkPackagesList structure
interface Schedule {
  id: string;
  workpackage_id: string;
  code: string;
  name: string;
  type: 'baseline' | 'forecast' | 'actual';
  created_at: string;
  workpackage?: {
    id: string;
    code: string;
    name: string;
    deliverable_id?: string;
    deliverable?: {
      id: string;
      code: string;
      name: string;
      project_id?: string;
      project?: {
        id: string;
        code: string;
        name: string;
      };
    };
  };
  has_current_revision?: boolean;
  current_revision?: ScheduleRevision;
  revision_count?: number;
}

interface ScheduleRevision {
  id: string;
  schedule_id: string;
  revision_number: number;
  revision_status: 'under_review' | 'current' | 'superseded';
  data_date?: string;
  source_filename: string;
  source_file_size?: number;
  created_at: string;
}

export function SchedulesList() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  // Fetch schedules from API with enriched work package data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const schedulesResponse = await ScheduleAPI.getAll();
      const responseData = schedulesResponse.data;
      
      let schedulesData: Schedule[] = [];
      
      if (responseData?.data?.schedules && Array.isArray(responseData.data.schedules)) {
        schedulesData = responseData.data.schedules;
      } else if (responseData?.schedules && Array.isArray(responseData.schedules)) {
        schedulesData = responseData.schedules;
      } else if (Array.isArray(responseData)) {
        schedulesData = responseData;
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        schedulesData = responseData.data;
      }
      
      console.log('📋 Raw schedules data:', schedulesData);
      
      // Enrich each schedule with complete work package hierarchy
      const enrichedSchedules = await Promise.all(
        schedulesData.map(async (schedule) => {
          try {
            // First, get current revision
            const currentRevResponse = await ScheduleRevisionsAPI.getCurrentBySchedule(schedule.id);
            const hasCurrentRevision = currentRevResponse.data?.data?.revision ? true : false;
            const currentRevision = currentRevResponse.data?.data?.revision;
            
            // Try to fetch complete work package data if not already present
            if (schedule.workpackage_id && (!schedule.workpackage || !schedule.workpackage.deliverable)) {
              try {
                const wpResponse = await WorkPackageAPI.getById(schedule.workpackage_id);
                const wpData = wpResponse.data?.data?.workpackage || wpResponse.data?.workpackage || wpResponse.data;
                
                if (wpData) {
                  schedule.workpackage = {
                    id: wpData.id,
                    code: wpData.code,
                    name: wpData.name,
                    deliverable_id: wpData.deliverable_id,
                    deliverable: wpData.deliverable
                  };
                }
              } catch (wpError) {
                console.warn(`Could not fetch work package ${schedule.workpackage_id}:`, wpError);
              }
            }
            
            // If we still don't have deliverable info, fetch it separately
            if (schedule.workpackage?.deliverable_id && !schedule.workpackage.deliverable) {
              try {
                // Note: You might need to add a method to fetch deliverable by ID
                // For now, we'll try to get it from the work package data
                const wpResponse = await WorkPackageAPI.getById(schedule.workpackage_id);
                const wpData = wpResponse.data?.data?.workpackage || wpResponse.data?.workpackage || wpResponse.data;
                
                if (wpData?.deliverable) {
                  schedule.workpackage.deliverable = wpData.deliverable;
                }
              } catch (deliverableError) {
                console.warn(`Could not fetch deliverable for work package ${schedule.workpackage_id}:`, deliverableError);
              }
            }
            
            return {
              ...schedule,
              has_current_revision: hasCurrentRevision,
              current_revision: currentRevision
            };
            
          } catch (error) {
            console.error(`Error enriching schedule ${schedule.id}:`, error);
            return {
              ...schedule,
              has_current_revision: false
            };
          }
        })
      );
      
      console.log('🎯 Enriched schedules:', enrichedSchedules);
      setSchedules(enrichedSchedules);
      
    } catch (error: any) {
      console.error('Error fetching schedules:', error);
      setError('Failed to load schedules. Please try again.');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Navigate to create schedule page
  const handleCreateSchedule = () => {
    navigate('/schedules/create');
  };

  // Navigate to edit schedule page
  const handleEdit = (schedule: Schedule) => {
    navigate(`/schedules/edit/${schedule.id}`);
  };

  // Navigate to schedule details
  const handleViewDetails = (schedule: Schedule) => {
    navigate(`/schedules/${schedule.id}`);
  };

  // Navigate to schedule revisions
  const handleViewRevisions = (schedule: Schedule) => {
    navigate(`/schedules/${schedule.id}/revisions`);
  };

  // Upload revision for a schedule
  const handleUploadRevision = (scheduleId: string) => {
    navigate(`/schedules/${scheduleId}/revisions/create`);
  };

  // Download current revision file
  const handleDownloadCurrentRevision = async (schedule: Schedule) => {
    if (!schedule.current_revision) {
      toast.error('No revision available to download');
      return;
    }
    
    setProcessingAction(`downloading-${schedule.id}`);
    
    try {
      const response = await ScheduleRevisionsAPI.downloadFile(schedule.current_revision.id);
      
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = schedule.current_revision.source_filename || 
                   `schedule-${schedule.code}-rev${schedule.current_revision.revision_number}.xer`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Revision ${schedule.current_revision.revision_number} downloaded`);
    } catch (error: any) {
      console.error('Error downloading revision:', error);
      toast.error('Failed to download revision file');
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle delete schedule
  const handleDelete = async (schedule: Schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  // Confirm delete schedule
  const confirmDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    setProcessingAction(`deleting-${scheduleToDelete.id}`);
    
    try {
      await ScheduleAPI.delete(scheduleToDelete.id);
      toast.success('Schedule deleted');
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    } finally {
      setProcessingAction(null);
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'baseline':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'forecast':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'actual':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper to get full hierarchy information
  const getHierarchyInfo = (schedule: Schedule) => {
    const project = schedule.workpackage?.deliverable?.project;
    const deliverable = schedule.workpackage?.deliverable;
    const workpackage = schedule.workpackage;
    
    return {
      project,
      deliverable,
      workpackage,
      hasProject: !!project,
      hasDeliverable: !!deliverable,
      hasWorkPackage: !!workpackage
    };
  };

  // Sort schedules
  const sortedSchedules = useMemo(() => {
    if (!sortConfig) return schedules;
    
    const sorted = [...schedules].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortConfig.key) {
        case 'project':
          aValue = a.workpackage?.deliverable?.project?.name || '';
          bValue = b.workpackage?.deliverable?.project?.name || '';
          break;
        case 'deliverable':
          aValue = a.workpackage?.deliverable?.name || '';
          bValue = b.workpackage?.deliverable?.name || '';
          break;
        case 'workpackage':
          aValue = a.workpackage?.name || '';
          bValue = b.workpackage?.name || '';
          break;
        case 'code':
          aValue = a.code;
          bValue = b.code;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'revision':
          aValue = a.current_revision?.revision_number || 0;
          bValue = b.current_revision?.revision_number || 0;
          break;
        case 'data_date':
          aValue = a.current_revision?.data_date || '';
          bValue = b.current_revision?.data_date || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [schedules, sortConfig]);

  // Filter schedules based on search term
  const filteredSchedules = useMemo(() => {
    if (!searchTerm) return sortedSchedules;
    
    return sortedSchedules.filter(schedule => {
      const hierarchy = getHierarchyInfo(schedule);
      
      return (
        schedule.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.workpackage?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.workpackage?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.deliverable?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.deliverable?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hierarchy.project?.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [sortedSchedules, searchTerm]);

  // Define table columns
  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: 'project',
      header: () => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>Project</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'project' && prev.direction === 'asc' 
                ? { key: 'project', direction: 'desc' }
                : { key: 'project', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'project' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        const hierarchy = getHierarchyInfo(schedule);
        
        if (!hierarchy.hasProject) {
          return (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-sm">-</span>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-gray-900">{hierarchy.project?.name}</div>
            <div className="text-xs text-gray-500 font-mono">{hierarchy.project?.code}</div>
          </div>
        );
      },
      size: 200,
    },
    {
      accessorKey: 'deliverable',
      header: () => (
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span>Deliverable</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'deliverable' && prev.direction === 'asc' 
                ? { key: 'deliverable', direction: 'desc' }
                : { key: 'deliverable', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'deliverable' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        const hierarchy = getHierarchyInfo(schedule);
        
        if (!hierarchy.hasDeliverable) {
          return (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-sm">-</span>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-gray-900">{hierarchy.deliverable?.name}</div>
            <div className="text-xs text-gray-500 font-mono">{hierarchy.deliverable?.code}</div>
          </div>
        );
      },
      size: 200,
    },
    {
      accessorKey: 'workpackage',
      header: () => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span>Work Package</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'workpackage' && prev.direction === 'asc' 
                ? { key: 'workpackage', direction: 'desc' }
                : { key: 'workpackage', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'workpackage' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        const hierarchy = getHierarchyInfo(schedule);
        
        if (!hierarchy.hasWorkPackage) {
          return (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">No WP</span>
            </div>
          );
        }
        
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-gray-900">{hierarchy.workpackage?.name}</div>
            <div className="text-xs text-gray-500 font-mono">{hierarchy.workpackage?.code}</div>
          </div>
        );
      },
      size: 200,
    },
    {
accessorKey: 'code',
header: () => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <Hash className="h-4 w-4" />
      <span>Schedule Code</span>
      <button
        onClick={() => setSortConfig(prev => 
          prev?.key === 'code' && prev.direction === 'asc' 
            ? { key: 'code', direction: 'desc' }
            : { key: 'code', direction: 'asc' }
        )}
        className="ml-1"
      >
        {sortConfig?.key === 'code' ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : <ChevronDown className="h-4 w-4 opacity-50" />}
      </button>
    </div>
    <div className="text-xs text-gray-500 font-normal mt-0.5 ml-6">
      Default: P6 Project ID
    </div>
  </div>
),
cell: ({ row }) => {
  const schedule = row.original;
  return (
    <div className="font-medium text-gray-900 font-mono">{schedule.code}</div>
  );
},
size: 150,    },
{
  accessorKey: 'name',
  header: () => (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <FileIcon className="h-4 w-4" />
        <span>Schedule Name</span>
        <button
          onClick={() => setSortConfig(prev => 
            prev?.key === 'name' && prev.direction === 'asc' 
              ? { key: 'name', direction: 'desc' }
              : { key: 'name', direction: 'asc' }
          )}
          className="ml-1"
        >
          {sortConfig?.key === 'name' ? (
            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
          ) : <ChevronDown className="h-4 w-4 opacity-50" />}
        </button>
      </div>
      <div className="text-xs text-gray-500 font-normal mt-0.5 ml-6">
        Default: P6 Project Name
      </div>
    </div>
  ),
  cell: ({ row }) => {
    const schedule = row.original;
    return (
      <div className="flex flex-col gap-1">
        <div className="font-medium text-gray-900">{schedule.name}</div>
        <div className="text-xs text-gray-500">
          Created: {formatDate(schedule.created_at)}
        </div>
      </div>
    );
  },
  size: 250,
},
    {
      accessorKey: 'type',
      header: () => (
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4" /> {/* CHANGED: Cube replaced with Box */}
          <span>Type</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'type' && prev.direction === 'asc' 
                ? { key: 'type', direction: 'desc' }
                : { key: 'type', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'type' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        return (
          <Badge variant="outline" className={getTypeBadgeColor(schedule.type)}>
            {schedule.type.toUpperCase()}
          </Badge>
        );
      },
      size: 120,
    },
    {
      id: 'current_revision',
      header: () => (
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4" />
          <span>Rev.</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'revision' && prev.direction === 'asc' 
                ? { key: 'revision', direction: 'desc' }
                : { key: 'revision', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'revision' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        if (!schedule.has_current_revision) {
          return (
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">No revision</span>
              </div>
            </div>
          );
        }
        
        const revision = schedule.current_revision;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono bg-blue-50">
                REV {revision?.revision_number}
              </Badge>
            </div>
          </div>
        );
      },
      size: 140,
    },
    {
      id: 'data_date',
      header: () => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Data Date</span>
          <button
            onClick={() => setSortConfig(prev => 
              prev?.key === 'data_date' && prev.direction === 'asc' 
                ? { key: 'data_date', direction: 'desc' }
                : { key: 'data_date', direction: 'asc' }
            )}
            className="ml-1"
          >
            {sortConfig?.key === 'data_date' ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
            ) : <ChevronDown className="h-4 w-4 opacity-50" />}
          </button>
        </div>
      ),
      cell: ({ row }) => {
        const schedule = row.original;
        const revision = schedule.current_revision;
        
        if (!revision) {
          return (
            <span className="text-sm text-gray-500">-</span>
          );
        }
        
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium">
              {formatDate(revision?.data_date) || 'Not set'}
            </div>
            {revision?.created_at && (
              <div className="text-xs text-gray-500">
                Uploaded: {formatDate(revision.created_at)}
              </div>
            )}
          </div>
        );
      },
      size: 160,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const schedule = row.original;
        const hasRevision = schedule.has_current_revision;
        
        return (
          <div className="flex items-center gap-2">
            {/* View Details Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(schedule)}
              title="View Details"
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {/* Download Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownloadCurrentRevision(schedule)}
              disabled={!hasRevision || processingAction === `downloading-${schedule.id}`}
              title={hasRevision ? "Download Current Revision" : "No revision to download"}
              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAction === `downloading-${schedule.id}` ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            
            {/* Upload Revision Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUploadRevision(schedule.id)}
              title="Upload New Revision"
              className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
            >
              <Upload className="h-4 w-4" />
            </Button>
            
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(schedule)}
              disabled={processingAction === `deleting-${schedule.id}`}
              title="Delete Schedule"
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            >
              {processingAction === `deleting-${schedule.id}` ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
            
            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleViewDetails(schedule)} className="cursor-pointer">
                  <Eye className="h-4 w-4 mr-2" />
                  View Schedule Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEdit(schedule)} className="cursor-pointer">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewRevisions(schedule)} className="cursor-pointer">
                  <Hash className="h-4 w-4 mr-2" />
                  View All Revisions
                  {schedule.revision_count && schedule.revision_count > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {schedule.revision_count}
                    </Badge>
                  )}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="my-1" />
                
                <DropdownMenuItem 
                  onClick={() => handleUploadRevision(schedule.id)}
                  className="cursor-pointer text-purple-600"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Revision
                </DropdownMenuItem>
                
                {hasRevision && (
                  <DropdownMenuItem 
                    onClick={() => handleDownloadCurrentRevision(schedule)}
                    disabled={processingAction === `downloading-${schedule.id}`}
                    className="cursor-pointer text-green-600"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Current Revision
                    {processingAction === `downloading-${schedule.id}` && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 ml-2"></div>
                    )}
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator className="my-1" />
                
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600"
                  onClick={() => handleDelete(schedule)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 200,
    },
  ];

  // Initialize table
  const table = useReactTable({
    data: filteredSchedules,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
<div className="container mx-auto py-6 space-y-6">
  {/* Header with buttons moved below */}
  <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold">Schedules</h1>
      <p className="text-gray-600">Manage project schedules and revisions</p>
    </div>
    
    {/* Buttons moved to left side under header */}
    <div className="flex flex-wrap items-center gap-3">
      <Button 
        onClick={handleCreateSchedule}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New Schedule
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        className="h-9"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      
      {/* Optional: Keep the count here if you want */}
      <span className="text-sm text-gray-600 ml-2">
        {filteredSchedules.length} of {schedules.length} schedules
      </span>
    </div>
  </div>

  {/* Search and Controls - now just search */}
  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
    <div className="relative w-full sm:w-96">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        placeholder="Search schedules, projects, deliverables, or work packages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10"
      />
    </div>
    
    {/* Optional: You can keep the count here instead, or remove this section */}
    <div className="flex items-center gap-2">
      {/* Count moved to button area above, but you can keep it here if preferred */}
    </div>
  </div>
        {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-2">
            Try Again
          </Button>
        </div>
      )}

      {/* Schedules Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Schedules List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading schedules...</span>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">
                {searchTerm ? 'No matching schedules found' : 'No schedules available'}
              </h3>
              <p className="text-gray-600 mt-2">
                {searchTerm ? 'Try a different search term' : 'Create your first schedule to get started'}
              </p>
              {!searchTerm && (
                <Button onClick={handleCreateSchedule} className="mt-4">
                  Create First Schedule
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
                        <TableHead 
                          key={header.id} 
                          style={{ width: `${header.column.getSize()}px` }}
                          className="bg-gray-50"
                        >
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
                      <TableRow key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2">
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
                      <TableCell colSpan={columns.length} className="text-center py-8">
                        No schedules found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <div className="text-sm text-gray-600">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                <span className="ml-4">
                  Showing {table.getRowModel().rows.length} of {filteredSchedules.length} schedules
                </span>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={e => table.setPageSize(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {[10, 20, 30, 50].map(size => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteScheduleDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        schedule={scheduleToDelete}
        onConfirm={confirmDeleteSchedule}
        loading={processingAction?.startsWith('deleting') || false}
      />
    </div>
  );
}

export default SchedulesList;