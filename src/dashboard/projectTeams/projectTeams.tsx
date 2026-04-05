// frontend/src/pages/ProjectTeams/projectTeams.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { usePermissions } from '../../hooks/usePermissions';
import { ProjectAPI, TeamAPI, BusinessUnitAPI, RoleAPI } from '../../services/api';
import { toast } from 'react-hot-toast';

// Components
import { ProjectTeamsHeader } from './components/ProjectTeamsHeader';
import { ProjectFilters } from './components/ProjectFilters';
import { ProjectListView } from './components/ProjectListView';
import { ProjectCardView } from './components/ProjectCardView';
import { TeamAssignmentModal } from './components/TeamAssignmentModal';
import { ProjectTeamDetailModal } from './components/ProjectTeamDetailModal';
import { ColumnSelector } from './components/ColumnSelector';

// Types
import { Project, TeamAssignment, BusinessUnit, Role } from '../../types';

// Icons
import { List, LayoutGrid } from 'lucide-react';

// ✅ Rôles core pour le calcul du staffing (minimum requis)
const CORE_ROLES = ['Project Manager', 'Deputy PM', 'Planning Engineer', 'Cost Engineer', 'Document Controller'];

interface ProjectWithTeam extends Project {
  teamAssignments?: TeamAssignment[];
  roleAssignments?: Record<string, TeamAssignment>;
  staffingStatus?: 'fully_staffed' | 'partially_staffed' | 'unstaffed';
  filledCoreRolesCount?: number;
  totalCoreRolesCount?: number;
  filledAllRolesCount?: number;
  totalAllRolesCount?: number;
}

export const ProjectTeams: React.FC = () => {
  const queryClient = useQueryClient();
  const { canManageTeam, canExportData, isSuperAdmin } = usePermissions();
  
  const [viewMode, setViewMode] = useLocalStorage<'list' | 'cards'>('projectTeamsViewMode', 'list');
  const [selectedColumns, setSelectedColumns] = useLocalStorage<string[]>('projectTeamsSelectedColumns', []);
  const [filters, setFilters] = useState({
    businessUnitId: '',
    healthStatus: '',
    phase: '',
    staffingStatus: '',
    search: '',
  });
  const [selectedProject, setSelectedProject] = useState<ProjectWithTeam | null>(null);
  const [selectedRole, setSelectedRole] = useState<{ project: Project; roleName: string } | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [understaffedCount, setUnderstaffedCount] = useState(0);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // ============================================
  // REQUÊTES API
  // ============================================

  // Fetch all projects with business units
  const { data: projectsResponse, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'withBusinessUnit'],
    queryFn: () => ProjectAPI.getWithBusinessUnit({ is_active: true }),
  });

  // Fetch all team assignments
  const { data: teamsResponse, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', 'all'],
    queryFn: () => TeamAPI.getAll({ is_active: true, limit: 1000 }),
  });

  // Fetch all business units
  const { data: businessUnitsResponse, isLoading: businessUnitsLoading } = useQuery({
    queryKey: ['businessUnits'],
    queryFn: () => BusinessUnitAPI.getAll(),
  });

  // ✅ Fetch all roles (pour récupérer les rôles projet uniquement)
  const { data: rolesResponse, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', 'project-scope'],
    queryFn: () => RoleAPI.getAll({ limit: 100, scope: 'project' }),
  });

  // ============================================
  // EXTRACTION DES DONNÉES
  // ============================================

  const businessUnits = useMemo(() => {
    if (!businessUnitsResponse?.data) return [];
    
    const responseData = businessUnitsResponse.data;
    let businessUnitsData: BusinessUnit[] = [];
    
    if (responseData?.data?.business_units && Array.isArray(responseData.data.business_units)) {
      businessUnitsData = responseData.data.business_units;
    } else if (responseData?.business_units && Array.isArray(responseData.business_units)) {
      businessUnitsData = responseData.business_units;
    } else if (Array.isArray(responseData)) {
      businessUnitsData = responseData;
    }
    
    return businessUnitsData;
  }, [businessUnitsResponse]);

  const projects = useMemo(() => {
    if (!projectsResponse?.data) return [];
    
    const responseData = projectsResponse.data;
    let projectsData: Project[] = [];
    
    if (responseData?.data?.projects && Array.isArray(responseData.data.projects)) {
      projectsData = responseData.data.projects;
    } else if (responseData?.projects && Array.isArray(responseData.projects)) {
      projectsData = responseData.projects;
    } else if (Array.isArray(responseData)) {
      projectsData = responseData;
    }
    
    return projectsData;
  }, [projectsResponse]);

  const teams = useMemo(() => {
    if (!teamsResponse?.data) return [];
    
    const responseData = teamsResponse.data;
    let teamsData: TeamAssignment[] = [];
    
    if (responseData?.data?.teams && Array.isArray(responseData.data.teams)) {
      teamsData = responseData.data.teams;
    } else if (responseData?.teams && Array.isArray(responseData.teams)) {
      teamsData = responseData.teams;
    } else if (Array.isArray(responseData)) {
      teamsData = responseData;
    }
    
    return teamsData as TeamAssignment[];
  }, [teamsResponse]);

  // ✅ Extraire les rôles projet uniquement (exclure corporate et bu)
  const projectRoles = useMemo(() => {
    if (!rolesResponse?.data) return [];
    
    const responseData = rolesResponse.data;
    let rolesList: Role[] = [];
    
    if (responseData?.data?.roles && Array.isArray(responseData.data.roles)) {
      rolesList = responseData.data.roles;
    } else if (responseData?.roles && Array.isArray(responseData.roles)) {
      rolesList = responseData.roles;
    } else if (Array.isArray(responseData)) {
      rolesList = responseData;
    }
    
    // Filtrer pour n'avoir que les rôles avec scope 'project'
    return rolesList.filter(role => role.scope === 'project');
  }, [rolesResponse]);

  // ✅ Initialiser les colonnes sélectionnées
  useEffect(() => {
    if (projectRoles.length > 0 && selectedColumns.length === 0) {
      // Par défaut, sélectionner les rôles core
      const defaultColumns = projectRoles
        .filter(role => CORE_ROLES.includes(role.name))
        .map(role => role.name);
      setSelectedColumns(defaultColumns);
    }
  }, [projectRoles, selectedColumns.length, setSelectedColumns]);

  // Mettre à jour la liste des rôles disponibles
  useEffect(() => {
    if (projectRoles.length > 0) {
      setAvailableRoles(projectRoles.map(role => role.name));
    }
  }, [projectRoles]);

  // ============================================
  // TRAITEMENT DES DONNÉES
  // ============================================

  // Process projects with team data
  const projectsWithTeam = useMemo(() => {
    if (!projects.length) return [];

    const teamsByProject: Record<string, TeamAssignment[]> = {};
    teams.forEach((team: TeamAssignment) => {
      if (!teamsByProject[team.project_id]) {
        teamsByProject[team.project_id] = [];
      }
      teamsByProject[team.project_id].push(team);
    });

    const processed = projects.map((project: Project) => {
      const projectTeams = teamsByProject[project.id] || [];

      const roleAssignments: Record<string, TeamAssignment> = {};
      projectTeams.forEach((team: TeamAssignment) => {
        if (team.role?.name) {
          roleAssignments[team.role.name] = team;
        }
      });

      // Calcul pour les rôles core (staffing)
      const filledCoreRoles = CORE_ROLES.filter(role => roleAssignments[role]);
      const filledCoreRolesCount = filledCoreRoles.length;
      const totalCoreRolesCount = CORE_ROLES.length;

      // Calcul pour tous les rôles projet
      const filledAllRoles = projectRoles.filter(role => roleAssignments[role.name]);
      const filledAllRolesCount = filledAllRoles.length;
      const totalAllRolesCount = projectRoles.length;

      let staffingStatus: 'fully_staffed' | 'partially_staffed' | 'unstaffed' = 'unstaffed';
      if (filledCoreRolesCount === totalCoreRolesCount) {
        staffingStatus = 'fully_staffed';
      } else if (filledCoreRolesCount > 0) {
        staffingStatus = 'partially_staffed';
      }

      return {
        ...project,
        teamAssignments: projectTeams,
        roleAssignments,
        staffingStatus,
        filledCoreRolesCount,
        totalCoreRolesCount,
        filledAllRolesCount,
        totalAllRolesCount,
      };
    });

    return processed;
  }, [projects, teams, projectRoles]);

  // Apply filters
  const filteredProjects = useMemo(() => {
    let filtered = projectsWithTeam;

    if (filters.businessUnitId) {
      filtered = filtered.filter(p => p.business_unit_id === filters.businessUnitId);
    }

    if (filters.healthStatus) {
      filtered = filtered.filter(p => p.health_status === filters.healthStatus);
    }

    if (filters.phase) {
      filtered = filtered.filter(p => p.current_phase === filters.phase);
    }

    if (filters.staffingStatus) {
      filtered = filtered.filter(p => p.staffingStatus === filters.staffingStatus);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.code?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower) ||
        p.teamAssignments?.some(t =>
          t.user?.name?.toLowerCase().includes(searchLower) ||
          t.user?.family_name?.toLowerCase().includes(searchLower)
        )
      );
    }

    return filtered;
  }, [projectsWithTeam, filters]);

  // Calculate understaffed count
  useEffect(() => {
    const understaffed = projectsWithTeam.filter(
      p => p.staffingStatus === 'partially_staffed' || p.staffingStatus === 'unstaffed'
    ).length;
    setUnderstaffedCount(understaffed);
  }, [projectsWithTeam]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleQuickAssign = (project: ProjectWithTeam, roleName: string) => {
    console.log('🎯 handleQuickAssign called:', { projectId: project.id, roleName });
    setSelectedProject(project);
    setSelectedRole({ project, roleName });
    setShowAssignmentModal(true);
  };

  const handleViewTeam = (project: ProjectWithTeam) => {
    console.log('👁️ handleViewTeam called:', { projectId: project.id, projectName: project.name });
    setSelectedProject(project);
    setShowTeamModal(true);
  };

  const handleUnderstaffedClick = () => {
    setFilters(prev => ({
      ...prev,
      staffingStatus: 'partially_staffed',
    }));
  };

  const handleExportExcel = async () => {
    if (!canExportData) {
      toast.error('You do not have permission to export data');
      return;
    }
    
    try {
      const exportData = filteredProjects.map(project => {
        const row: any = {
          'Project Code': project.code,
          'Project Name': project.name,
          'Business Unit': project.business_unit?.name,
          'Phase': project.current_phase,
          'Health Status': project.health_status,
          'Staffing Status': project.staffingStatus === 'fully_staffed' ? 'Fully Staffed' :
                            project.staffingStatus === 'partially_staffed' ? 'Partially Staffed' : 'Unstaffed',
        };
        
        // Ajouter les colonnes des rôles sélectionnés
        selectedColumns.forEach(roleName => {
          const assignment = project.roleAssignments?.[roleName];
          row[roleName] = assignment?.user?.name 
            ? `${assignment.user.name} ${assignment.user.family_name || ''}`
            : 'Unassigned';
        });
        
        return row;
      });

      console.log('Export data:', exportData);
      toast.success('Export initiated');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['teams'] });
    queryClient.invalidateQueries({ queryKey: ['businessUnits'] });
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    toast.success('Refreshing data...');
  };

  const handleColumnToggle = (roleName: string) => {
    if (selectedColumns.includes(roleName)) {
      setSelectedColumns(selectedColumns.filter(col => col !== roleName));
    } else {
      setSelectedColumns([...selectedColumns, roleName]);
    }
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns([...availableRoles]);
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const isLoading = projectsLoading || teamsLoading || businessUnitsLoading || rolesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProjectTeamsHeader
          userRole={isSuperAdmin ? 'Super Admin' : 'User'}
          onExport={handleExportExcel}
          onRefresh={handleRefresh}
          understaffedCount={understaffedCount}
          totalBUs={businessUnits.length}
          onUnderstaffedClick={handleUnderstaffedClick}
          canExport={canExportData}
        />

        <ProjectFilters
          filters={filters}
          onFilterChange={setFilters}
          businessUnits={businessUnits}
        />

        {/* Column Selector */}
        {viewMode === 'list' && availableRoles.length > 0 && (
          <ColumnSelector
            availableRoles={availableRoles}
            selectedColumns={selectedColumns}
            onToggleColumn={handleColumnToggle}
            onSelectAll={handleSelectAllColumns}
            onDeselectAll={handleDeselectAllColumns}
          />
        )}

        {/* View Toggle */}
        <div className="flex justify-end mb-4 space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="List view"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'cards'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Card view"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No projects match your filters</p>
          </div>
        ) : viewMode === 'list' ? (
          <ProjectListView
            projects={filteredProjects}
            selectedColumns={selectedColumns}
            availableRoles={availableRoles}
            canManageTeam={canManageTeam}
            onQuickAssign={handleQuickAssign}
            onViewTeam={handleViewTeam}
          />
        ) : (
          <ProjectCardView
            projects={filteredProjects}
            coreRoles={CORE_ROLES}
            canManageTeam={canManageTeam}
            onQuickAssign={handleQuickAssign}
            onViewTeam={handleViewTeam}
          />
        )}
      </div>

      {/* Modals */}
      {showAssignmentModal && selectedProject && selectedRole && (
        <TeamAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedProject(null);
            setSelectedRole(null);
          }}
          project={selectedProject}
          roleName={selectedRole.roleName}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['teams', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['projects', 'withBusinessUnit'] });
            toast.success('Team member assigned successfully');
            setShowAssignmentModal(false);
            setSelectedProject(null);
            setSelectedRole(null);
          }}
        />
      )}

      {showTeamModal && selectedProject && (
        <ProjectTeamDetailModal
          isOpen={showTeamModal}
          onClose={() => {
            setShowTeamModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          canManage={canManageTeam}
          onAssignmentChange={() => {
            queryClient.invalidateQueries({ queryKey: ['teams', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['projects', 'withBusinessUnit'] });
          }}
        />
      )}
    </div>
  );
};