// ProjectsList.tsx
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
  Clock,
  AlertCircle,
  Ban,
  Filter,
  TrendingUp,
  Target,
  Download,
  DollarSign,
  Users
} from 'lucide-react';
import { ProjectAPI, BusinessUnitAPI } from '@/services/api';
import { exportToExcel } from '@/utils/excelExport';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/permissions';

// Types based on backend model
interface Project {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  description: string | null;
  health_status: 'good' | 'warning' | 'critical' | null;
  current_phase: 'FEED (Front-End Engineering Design)' | 'Detailed Engineering' | 'Procurement' | 'Construction' | 'Pre-Commissioning' | 'Commissioning' | 'Close-out' | null;
  contract_type: 'EPC (Engineering, Procurement, Construction)' | 'EPCM (Engineering, Procurement, Construction Management)' | 'Conception-Construction' | 'Régie' | 'Forfait' | 'BOT (Build, Operate, Transfer)' | null;
  contract_value: number | null;
  currency: string | null;
  start_date: string;
  planned_end_date: string;
  baseline_finish_date: string | null;
  current_finish_date: string | null;
  business_unit_id: string | null;
  created_by: string | null;
  created_at: string;
  last_modified_at: string | null;
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
  // Calculated fields
  duration?: number;
  days_remaining?: number | null;
  progress?: number;
}

interface BusinessUnit {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export function ProjectsList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedHealthStatus, setSelectedHealthStatus] = useState<string>('ALL');
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('ALL');
  const [exportLoading, setExportLoading] = useState(false);

  // Health status options
  const HEALTH_STATUSES = ['good', 'warning', 'critical'];
  
  // Project phases from backend
  const PROJECT_PHASES = [
    'FEED (Front-End Engineering Design)',
    'Detailed Engineering',
    'Procurement',
    'Construction',
    'Pre-Commissioning',
    'Commissioning',
    'Close-out'
  ];

  // Fetch projects and business units from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching projects...');
      
      // Try to fetch projects with business unit details using ProjectAPI
      let projectsData: Project[] = [];
      
      try {
        const projectsResponse = await ProjectAPI.getWithBusinessUnit({ limit: 100 });
        console.log('✅ Projects from /projects/with-business-unit:', projectsResponse.data);
        
        const responseData = projectsResponse.data;
        if (responseData?.data?.projects) {
          projectsData = responseData.data.projects;
        } else if (responseData?.projects) {
          projectsData = responseData.projects;
        } else if (Array.isArray(responseData)) {
          projectsData = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          projectsData = responseData.data;
        }
      } catch (error) {
        console.log('⚠️ /projects/with-business-unit failed, trying /projects');
        try {
          const projectsResponse = await ProjectAPI.getAll({ limit: 100 });
          console.log('✅ Projects from /projects:', projectsResponse.data);
          
          const responseData = projectsResponse.data;
          if (responseData?.data?.projects) {
            projectsData = responseData.data.projects;
          } else if (responseData?.projects) {
            projectsData = responseData.projects;
          } else if (Array.isArray(responseData)) {
            projectsData = responseData;
          } else if (responseData?.data && Array.isArray(responseData.data)) {
            projectsData = responseData.data;
          }
        } catch (error2) {
          console.error('❌ All project endpoints failed');
          throw error2;
        }
      }
      
      // Calculate duration and days remaining for each project
      const projectsWithCalculations = projectsData
        .filter(project => project.is_active !== false) // Only show active projects by default
        .map(project => {
          const start = new Date(project.start_date);
          const plannedEnd = new Date(project.planned_end_date);
          const currentEnd = project.current_finish_date ? new Date(project.current_finish_date) : null;
          const today = new Date();
          
          // Calculate duration in days
          const duration = Math.ceil((plannedEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          // Calculate days remaining (using planned end date)
          const diffTime = plannedEnd.getTime() - today.getTime();
          const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Calculate progress based on health status and phase
          let progress = 0;
          if (project.current_phase) {
            const phaseIndex = PROJECT_PHASES.indexOf(project.current_phase);
            if (phaseIndex >= 0) {
              progress = Math.round(((phaseIndex + 1) / PROJECT_PHASES.length) * 100);
            }
          }
          
          return {
            ...project,
            duration,
            days_remaining: daysRemaining,
            progress
          };
        });
      
      console.log('🎯 Processed Projects:', projectsWithCalculations);
      console.log('📊 Total projects count:', projectsWithCalculations.length);
      
      setProjects(projectsWithCalculations);
      
      // Fetch business units for filtering using BusinessUnitAPI
      console.log('🔍 Fetching business units...');
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
        } else if (businessUnitsResponseData?.data && Array.isArray(businessUnitsResponseData.data)) {
          businessUnitsData = businessUnitsResponseData.data;
        }
        
        setBusinessUnits(businessUnitsData);
      } catch (error) {
        console.log('⚠️ Could not fetch business units');
        setBusinessUnits([]);
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching data:', error);
      
      if (error.response) {
        console.error('❌ Server error response:', error.response.status, error.response.data);
        setError(`Server error (${error.response.status}): ${error.response.data?.message || 'Failed to load projects'}`);
      } else if (error.request) {
        console.error('❌ No response received:', error.request);
        setError('Network error: Cannot connect to server. Please make sure backend is running.');
      } else {
        console.error('❌ Request error:', error.message);
        setError(`Request error: ${error.message}`);
      }
      
      setProjects([]);
      setBusinessUnits([]);
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

  // Handle Excel export
  const handleExportExcel = () => {
    setExportLoading(true);
    
    try {
      // Determine which data to export
      const dataToExport = filteredProjects.length > 0 ? filteredProjects : projects;
      
      // Prepare data for Excel
      const excelData = dataToExport.map(project => ({
        'Project Code': project.code,
        'Project Name': project.name,
        'Client Name': project.client_name || 'N/A',
        'Project Manager': project.creator ? `${project.creator.name} ${project.creator.family_name}` : 'N/A',
        'Business Unit': project.business_unit?.name || 'Not assigned',
        'Health Status': project.health_status ? project.health_status.toUpperCase() : 'N/A',
        'Current Phase': project.current_phase || 'N/A',
        'Contract Type': project.contract_type || 'N/A',
        'Contract Value': project.contract_value && project.currency 
          ? `${project.currency} ${project.contract_value.toLocaleString()}`
          : 'N/A',
        'Start Date': formatDateForExcel(project.start_date),
        'Planned End Date': formatDateForExcel(project.planned_end_date),
        'Current Finish Date': project.current_finish_date ? formatDateForExcel(project.current_finish_date) : 'N/A',
        'Duration (days)': project.duration || 0,
        'Days Remaining': project.days_remaining !== null ? project.days_remaining : 'N/A',
        'Progress (%)': project.progress || 0,
        'Created By': project.creator ? `${project.creator.name} ${project.creator.family_name}` : 'N/A',
        'Created At': formatDateForExcel(project.created_at),
        'Last Modified': project.last_modified_at ? formatDateForExcel(project.last_modified_at) : 'N/A'
      }));
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Projects_List_${timestamp}.xlsx`;
      
      // Export to Excel
      exportToExcel(excelData, filename, 'Projects List');
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError('Failed to export data to Excel');
    } finally {
      setExportLoading(false);
    }
  };

  // Format date for Excel export
  const formatDateForExcel = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter projects based on search term, health status, phase, and business unit
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Apply health status filter
    if (selectedHealthStatus !== 'ALL') {
      filtered = filtered.filter(project => project.health_status === selectedHealthStatus);
    }
    
    // Apply phase filter
    if (selectedPhase !== 'ALL') {
      filtered = filtered.filter(project => project.current_phase === selectedPhase);
    }
    
    // Apply business unit filter
    if (selectedBusinessUnit !== 'ALL') {
      filtered = filtered.filter(project => project.business_unit?.id === selectedBusinessUnit);
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.business_unit?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.creator?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.creator?.family_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [projects, searchTerm, selectedHealthStatus, selectedPhase, selectedBusinessUnit]);

  // Get business unit counts
  const businessUnitCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: projects.length
    };
    
    businessUnits.forEach(bu => {
      counts[bu.id] = 0;
    });
    counts['null'] = 0;
    
    projects.forEach(project => {
      if (project.business_unit?.id) {
        counts[project.business_unit.id] = (counts[project.business_unit.id] || 0) + 1;
      } else {
        counts.null++;
      }
    });
    
    return counts;
  }, [projects, businessUnits]);

  // Handle delete project (soft delete)
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to deactivate this project? This action can be reversed later.')) {
      return;
    }

    try {
      await ProjectAPI.delete(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      setError(error.response?.data?.message || 'Failed to delete project');
    }
  };

  // Handle edit project
  const handleEdit = (project: Project) => {
    navigate(`/projects/edit/${project.id}`);
  };

  // Handle health status update
  const handleHealthStatusUpdate = async (id: string, newStatus: Project['health_status']) => {
    try {
      await ProjectAPI.updateHealthStatus(id, newStatus);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating project health status:', error);
      setError(error.response?.data?.message || 'Failed to update project health status');
    }
  };

  // Handle phase update
  const handlePhaseUpdate = async (id: string, newPhase: Project['current_phase']) => {
    try {
      await ProjectAPI.updatePhase(id, newPhase);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating project phase:', error);
      setError(error.response?.data?.message || 'Failed to update project phase');
    }
  };

  // Get health status badge color and icon
  const getHealthStatusBadgeProps = (status: string | null) => {
    switch (status) {
      case 'good':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircle2 className="h-4 w-4 mr-1" />
        };
      case 'warning':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: <AlertCircle className="h-4 w-4 mr-1" />
        };
      case 'critical':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: <Ban className="h-4 w-4 mr-1" />
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <Clock className="h-4 w-4 mr-1" />
        };
    }
  };

  // Get phase display name (short version)
  const getPhaseDisplayName = (phase: string | null) => {
    if (!phase) return 'Not Set';
    
    const phaseMap: Record<string, string> = {
      'FEED (Front-End Engineering Design)': 'FEED',
      'Detailed Engineering': 'Detailed Eng',
      'Procurement': 'Procurement',
      'Construction': 'Construction',
      'Pre-Commissioning': 'Pre-Comm',
      'Commissioning': 'Commissioning',
      'Close-out': 'Close-out'
    };
    
    return phaseMap[phase] || phase;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format currency
  const formatCurrency = (value: number | null, currency: string | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Define table columns
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'code',
      header: 'Project Code',
      cell: ({ row }) => (
        <div className="font-mono font-medium">
          {row.getValue('code')}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Project Name',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('name')}
          {row.original.client_name && (
            <div className="text-xs text-muted-foreground">
              Client: {row.original.client_name}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'creator',
      header: 'Project Manager',
      cell: ({ row }) => {
        const creator = row.original.creator;
        return creator ? (
          <div className="text-sm">
            <div className="font-medium">{creator.name} {creator.family_name}</div>
            <div className="text-xs text-muted-foreground">{creator.email}</div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Not assigned</span>
        );
      },
    },
    {
      accessorKey: 'health_status',
      header: 'Health',
      cell: ({ row }) => {
        const status = row.getValue('health_status') as string | null;
        const badgeProps = getHealthStatusBadgeProps(status);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeProps.color}`}>
            {badgeProps.icon}
            {status ? status.toUpperCase() : 'NOT SET'}
          </span>
        );
      },
    },
    {
      accessorKey: 'current_phase',
      header: 'Phase',
      cell: ({ row }) => {
        const phase = row.getValue('current_phase') as string | null;
        return (
          <div className="text-sm">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
              {getPhaseDisplayName(phase)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'dates',
      header: 'Timeline',
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>Start: {formatDate(project.start_date)}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span>Planned: {formatDate(project.planned_end_date)}</span>
            </div>
            {project.days_remaining !== null && project.days_remaining !== undefined && (
              <div className={`text-xs mt-1 ${
                project.days_remaining < 0 ? 'text-red-600' : 
                project.days_remaining < 7 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {project.days_remaining < 0 
                  ? `Overdue by ${Math.abs(project.days_remaining)} days` 
                  : `${project.days_remaining} days remaining`
                }
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'contract',
      header: 'Contract',
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="text-sm">
            {project.contract_value && (
              <div className="flex items-center gap-1 font-medium">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                {formatCurrency(project.contract_value, project.currency)}
              </div>
            )}
            {project.contract_type && (
              <div className="text-xs text-muted-foreground mt-1">
                {project.contract_type.split(' ')[0]}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'business_unit',
      header: 'Business Unit',
      cell: ({ row }) => {
        const businessUnit = row.original.business_unit;
        return businessUnit ? (
          <div className="text-sm">
            <div>{businessUnit.name}</div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Not assigned</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const project = row.original;
        
        // ✅ Vérifier la permission d'édition
        if (!can(PERMISSIONS.PROJECT_EDIT)) {
          return null;
        }
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(project)}
            >
              Edit
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleEdit(project)}>
                  Edit Details
                </DropdownMenuItem>
                
                {/* Health Status Change Options */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Update Health Status
                </div>
                {HEALTH_STATUSES.map(status => (
                  <DropdownMenuItem 
                    key={status}
                    onClick={() => handleHealthStatusUpdate(project.id, status as any)}
                    className="pl-4"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      status === 'good' ? 'bg-green-500' :
                      status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </DropdownMenuItem>
                ))}
                
                <div className="border-t my-1" />
                
                {/* Phase Change Options */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Update Phase
                </div>
                {PROJECT_PHASES.map(phase => (
                  <DropdownMenuItem 
                    key={phase}
                    onClick={() => handlePhaseUpdate(project.id, phase as any)}
                    className="pl-4 text-xs"
                  >
                    {getPhaseDisplayName(phase)}
                  </DropdownMenuItem>
                ))}
                
                <div className="border-t my-1" />
                
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleDelete(project.id)}
                >
                  Deactivate Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Initialize table with pagination - SET TO 5 ROWS PER PAGE
  const table = useReactTable({
    data: filteredProjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  // Get health status counts
  const healthStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: projects.length,
      good: 0,
      warning: 0,
      critical: 0,
      null: 0
    };
    
    projects.forEach(project => {
      if (project.health_status) {
        counts[project.health_status]++;
      } else {
        counts.null++;
      }
    });
    
    return counts;
  }, [projects]);

  // Get phase counts
  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: projects.length
    };
    
    PROJECT_PHASES.forEach(phase => {
      counts[phase] = 0;
    });
    counts['null'] = 0;
    
    projects.forEach(project => {
      if (project.current_phase) {
        counts[project.current_phase] = (counts[project.current_phase] || 0) + 1;
      } else {
        counts.null++;
      }
    });
    
    return counts;
  }, [projects]);

  return (
    <div className="flex-1">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">
                Manage and track all projects with health status and phase monitoring
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* ✅ Afficher le bouton Create Project seulement si l'utilisateur a la permission */}
              {can(PERMISSIONS.PROJECT_CREATE) && (
                <Button 
                  onClick={() => navigate('/projects/create')}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              )}
              
              {/* Excel Export Button */}
              <Button 
                variant="outline"
                onClick={handleExportExcel}
                disabled={exportLoading || projects.length === 0}
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

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by code, name, client, manager, or business unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[400px]"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Business Unit Filter */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedBusinessUnit}
                  onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                  className="border rounded p-2 text-sm bg-background"
                >
                  <option value="ALL">All Business Units ({businessUnitCounts.ALL})</option>
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name} ({businessUnitCounts[bu.id] || 0})
                    </option>
                  ))}
                  <option value="null">Not Assigned ({businessUnitCounts.null})</option>
                </select>
              </div>

              {/* Health Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedHealthStatus}
                  onChange={(e) => setSelectedHealthStatus(e.target.value)}
                  className="border rounded p-2 text-sm bg-background"
                >
                  <option value="ALL">All Health ({healthStatusCounts.ALL})</option>
                  <option value="good">Good ({healthStatusCounts.good})</option>
                  <option value="warning">Warning ({healthStatusCounts.warning})</option>
                  <option value="critical">Critical ({healthStatusCounts.critical})</option>
                  <option value="null">Not Set ({healthStatusCounts.null})</option>
                </select>
              </div>

              {/* Phase Filter */}
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="border rounded p-2 text-sm bg-background min-w-[150px]"
              >
                <option value="ALL">All Phases ({phaseCounts.ALL})</option>
                {PROJECT_PHASES.map(phase => (
                  <option key={phase} value={phase}>
                    {getPhaseDisplayName(phase)} ({phaseCounts[phase] || 0})
                  </option>
                ))}
                <option value="null">Not Set ({phaseCounts.null})</option>
              </select>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Showing {filteredProjects.length} of {projects.length} projects
              {table.getPageCount() > 1 && ` • Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
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
        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Projects List</CardTitle>
            <CardDescription>
              Manage all projects with health status tracking and phase management
              {table.getPageCount() > 1 && ` • Use pagination controls to navigate through all projects`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading projects...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchTerm || selectedHealthStatus !== 'ALL' || selectedPhase !== 'ALL' || selectedBusinessUnit !== 'ALL'
                    ? 'No projects found' 
                    : 'No projects'}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {searchTerm ? 'Try adjusting your search terms' : 
                   selectedHealthStatus !== 'ALL' ? 'Try selecting a different health status' :
                   selectedPhase !== 'ALL' ? 'Try selecting a different phase' :
                   selectedBusinessUnit !== 'ALL' ? 'Try selecting a different business unit' : 
                   'Get started by creating your first project'}
                </p>
                {/* ✅ Afficher le bouton Create Project seulement si l'utilisateur a la permission */}
                {(!searchTerm && selectedHealthStatus === 'ALL' && selectedPhase === 'ALL' && selectedBusinessUnit === 'ALL') && (
                  can(PERMISSIONS.PROJECT_CREATE) && (
                    <Button 
                      onClick={() => navigate('/projects/create')}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  )
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
                  Showing {table.getRowModel().rows.length} of {filteredProjects.length} projects
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
                    {[5, 10, 20, 30, 50].map(pageSize => (
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

export default ProjectsList;