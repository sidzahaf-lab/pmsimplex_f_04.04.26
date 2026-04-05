// src/dashboard/MainPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FolderOpen, 
  Search, 
  Calendar, 
  Building2, 
  Users,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = 'http://localhost:3001/api';

// Types
interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface Project {
  id: string; // UUID
  code: string;
  name: string;
  client_name?: string;
  start_date: string;
  planned_end_date: string;
  baseline_finish_date?: string;
  current_finish_date?: string;
  description?: string;
  health_status: 'good' | 'warning' | 'critical' | null;
  business_unit_id: string;
  contract_type?: string;
  current_phase?: string;
  contract_value?: number;
  currency?: string;
  is_active: boolean;
  created_at: string;
  business_unit?: BusinessUnit;
  created_by?: string;
}

interface ProjectsResponse {
  status: string;
  data: {
    projects: Project[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    }
  }
}

export const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Debug: Log component mount and auth state
  useEffect(() => {
    console.log('========================================');
    console.log('🏠 MainPage mounted');
    console.log('👤 User from auth:', user);
    console.log('🔑 isSuperAdmin:', isSuperAdmin);
    console.log('⏳ authLoading:', authLoading);
    console.log('========================================');
  }, [user, isSuperAdmin, authLoading]);

  // Charger les projets au montage
  useEffect(() => {
    console.log('🔄 MainPage useEffect - fetching projects');
    fetchProjects();
  }, []);

  // Filtrer les projets selon le terme de recherche
  useEffect(() => {
    console.log('🔍 Filtering projects with searchTerm:', searchTerm);
    if (!searchTerm.trim()) {
      console.log('📋 No search term, showing all projects:', projects.length);
      setFilteredProjects(projects);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = projects.filter(project => 
      project.name.toLowerCase().includes(term) ||
      project.code.toLowerCase().includes(term) ||
      (project.client_name && project.client_name.toLowerCase().includes(term))
    );
    console.log(`📋 Filtered projects: ${filtered.length} of ${projects.length}`);
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 Fetching projects from API...');
      console.log('🔗 API URL:', `${API_BASE_URL}/projects`);
      console.log('🔑 Auth token:', localStorage.getItem('authToken') ? 'Present' : 'Missing');
      
      // Get auth token
      const token = localStorage.getItem('authToken');
      
      const response = await axios.get<ProjectsResponse>(`${API_BASE_URL}/projects`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        }
      });
      
      console.log('✅ Projects fetch response:', response.data);
      console.log('📊 Response status:', response.status);
      console.log('📦 Response data structure:', Object.keys(response.data));
      
      const projectsData = response.data.data?.projects || response.data.projects || [];
      console.log(`📋 Total projects received: ${projectsData.length}`);
      
      if (projectsData.length > 0) {
        console.log('📋 First project sample:', {
          id: projectsData[0].id,
          code: projectsData[0].code,
          name: projectsData[0].name,
          business_unit: projectsData[0].business_unit
        });
      }
      
      setProjects(projectsData);
      setFilteredProjects(projectsData);
      
    } catch (err: any) {
      console.error('❌ Error fetching projects:', err);
      console.error('❌ Error response:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      console.error('❌ Error headers:', err.response?.headers);
      
      if (err.response?.status === 401) {
        console.log('🔒 Unauthorized - redirecting to login');
        setError('Session expired. Please login again.');
        // Redirect to login after 2 seconds
        setTimeout(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to load projects');
      }
    } finally {
      setLoading(false);
      console.log('🏁 fetchProjects completed, loading set to false');
    }
  };

  const handleProjectSelect = (project: Project) => {
    console.log('📌 Project selected:', {
      id: project.id,
      code: project.code,
      name: project.name,
      health_status: project.health_status,
      business_unit: project.business_unit?.name
    });
    
    setSelectedProject(project);
    
    // Stocker les infos du projet dans localStorage
    localStorage.setItem('currentProjectId', project.id);
    localStorage.setItem('currentProjectCode', project.code);
    localStorage.setItem('currentProjectName', project.name);
    localStorage.setItem('currentProjectData', JSON.stringify(project));
    
    console.log('💾 Project data saved to localStorage');
    console.log('🔗 Navigating to:', `/projects/${project.id}/documents`);
    
    // Naviguer vers la page des documents avec l'UUID
    navigate(`/projects/${project.id}/documents`);
  };

  const getHealthStatusColor = (status: string | null) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getHealthStatusIcon = (status: string | null) => {
    switch (status) {
      case 'good': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value: number | undefined, currency: string | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Show loading while auth is loading
  if (authLoading) {
    console.log('⏳ Auth loading, showing skeleton...');
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    console.log('⏳ Projects loading, showing skeleton...');
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  console.log('✅ MainPage rendering with', filteredProjects.length, 'projects');

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
          <p className="text-gray-500 mt-1">Select a project to manage its documents</p>
        </div>
        
        {/* Search bar */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Projects count */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <FolderOpen className="h-4 w-4" />
        <span>{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found</span>
        {searchTerm && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSearchTerm('')}
            className="ml-2 h-6 px-2 text-xs"
          >
            Clear filter
          </Button>
        )}
      </div>

      {/* Projects grid */}
      {filteredProjects.length === 0 ? (
        <Card className="bg-gray-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm 
                ? `No projects matching "${searchTerm}"` 
                : "There are no projects available. Create a project first."}
            </p>
            {!searchTerm && isSuperAdmin && (
              <Button onClick={() => navigate('/projects/create')}>
                Create New Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Card 
              key={project.id}
              className={`cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 ${
                selectedProject?.id === project.id ? 'border-primary' : 'border-transparent'
              }`}
              onClick={() => handleProjectSelect(project)}
            >
              <CardContent className="p-6">
                {/* Header avec health status */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">
                      {project.code}
                    </p>
                  </div>
                  {project.health_status && (
                    <Badge className={`${getHealthStatusColor(project.health_status)} ml-2`}>
                      <span className="flex items-center gap-1">
                        {getHealthStatusIcon(project.health_status)}
                        {project.health_status}
                      </span>
                    </Badge>
                  )}
                </div>

                {/* Client */}
                {project.client_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="line-clamp-1">{project.client_name}</span>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    {formatDate(project.start_date)} → {formatDate(project.planned_end_date)}
                  </span>
                </div>

                {/* Phase et Business Unit */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {project.current_phase && (
                    <Badge variant="outline" className="bg-blue-50">
                      {project.current_phase}
                    </Badge>
                  )}
                  {project.business_unit && (
                    <Badge variant="outline" className="bg-purple-50">
                      <Building2 className="h-3 w-3 mr-1" />
                      {project.business_unit.name}
                    </Badge>
                  )}
                  {project.contract_value && (
                    <Badge variant="outline" className="bg-green-50">
                      {formatCurrency(project.contract_value, project.currency)}
                    </Badge>
                  )}
                </div>

                {/* UUID (pour debug) */}
                <div className="mt-3 pt-3 border-t border-dashed text-xs text-gray-400 font-mono">
                  ID: {project.id}
                </div>

                {/* Sélection indicator */}
                {selectedProject?.id === project.id && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8 flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => navigate('/projects')}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          All Projects
        </Button>
        {isSuperAdmin && (
          <Button 
            onClick={() => navigate('/projects/create')}
          >
            <FileText className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>
    </div>
  );
};

export default MainPage;