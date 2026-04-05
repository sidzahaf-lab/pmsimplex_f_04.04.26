// frontend/src/pages/ProjectTeams/components/ProjectCardView.tsx
import React from 'react';
import { Eye, UserPlus, Users, Briefcase, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Project } from '../../../types';

interface ProjectWithTeam extends Project {
  roleAssignments?: Record<string, any>;
  staffingStatus?: string;
  filledRolesCount?: number;
  totalCoreRolesCount?: number;
}

interface ProjectCardViewProps {
  projects: ProjectWithTeam[];
  coreRoles: string[];
  canManageTeam: boolean;
  onQuickAssign: (project: ProjectWithTeam, roleName: string) => void;
  onViewTeam: (project: ProjectWithTeam) => void;
}

const HEALTH_STATUS_CONFIG = {
  good: { color: 'border-l-green-500', icon: CheckCircle, text: 'Good', bg: 'bg-green-50' },
  warning: { color: 'border-l-yellow-500', icon: AlertTriangle, text: 'Warning', bg: 'bg-yellow-50' },
  critical: { color: 'border-l-red-500', icon: AlertTriangle, text: 'Critical', bg: 'bg-red-50' },
};

const STAFFING_COLORS = {
  fully_staffed: 'border-l-green-500',
  partially_staffed: 'border-l-orange-500',
  unstaffed: 'border-l-red-500',
};

// ✅ CORRECTION: Utiliser les mêmes noms de rôles
const ROLE_ICONS: Record<string, any> = {
  'Project Manager': Briefcase,
  'Deputy PM': Briefcase,
  'Planning Engineer': TrendingUp,
  'Cost Engineer': TrendingUp,
  'Document Controller': Users,
};

export const ProjectCardView: React.FC<ProjectCardViewProps> = ({
  projects,
  coreRoles,
  canManageTeam,
  onQuickAssign,
  onViewTeam,
}) => {
  const getStaffingPercentage = (filled: number, total: number) => {
    if (total === 0) return 0;
    return (filled / total) * 100;
  };

  const handleViewTeam = (project: ProjectWithTeam) => {
    console.log('🔍 View Team clicked for project:', project.id, project.name);
    if (onViewTeam) {
      onViewTeam(project);
    } else {
      console.error('onViewTeam callback is not defined');
    }
  };

  const handleQuickAssign = (project: ProjectWithTeam, roleName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    console.log('📝 Quick Assign clicked for project:', project.id, 'role:', roleName);
    if (onQuickAssign) {
      onQuickAssign(project, roleName);
    } else {
      console.error('onQuickAssign callback is not defined');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => {
        const staffingColor = STAFFING_COLORS[project.staffingStatus as keyof typeof STAFFING_COLORS] || 'border-l-gray-300';
        const healthConfig = HEALTH_STATUS_CONFIG[project.health_status as keyof typeof HEALTH_STATUS_CONFIG] || {
          color: 'border-l-gray-300',
          icon: Users,
          text: 'Not Set',
          bg: 'bg-gray-50',
        };
        const HealthIcon = healthConfig.icon;
        const staffingPercentage = getStaffingPercentage(
          project.filledRolesCount || 0,
          project.totalCoreRolesCount || coreRoles.length
        );

        return (
          <div
            key={project.id}
            className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow border-l-4 ${staffingColor}`}
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-mono text-gray-500 mb-1">{project.code}</p>
                  <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                    <button 
                      onClick={() => handleViewTeam(project)} 
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      {project.name}
                    </button>
                  </h3>
                </div>
                <div className="flex space-x-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${healthConfig.bg} ${healthConfig.text === 'Good' ? 'text-green-700' : healthConfig.text === 'Warning' ? 'text-yellow-700' : 'text-red-700'}`}>
                    <HealthIcon className="w-3 h-3 mr-1" />
                    {healthConfig.text}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {project.current_phase?.split(' ')[0] || 'N/A'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">{project.business_unit?.name}</p>
            </div>

            {/* Core Roles Grid */}
            <div className="p-4 border-b border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                {coreRoles.map((role) => {
                  const assignment = project.roleAssignments?.[role];
                  const RoleIcon = ROLE_ICONS[role] || Users;
                  return (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RoleIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">{role}</span>
                      </div>
                      {assignment ? (
                        <span className="text-xs font-medium text-green-600 truncate max-w-[100px]" title={`${assignment.user?.name} ${assignment.user?.family_name || ''}`}>
                          {assignment.user?.name} {assignment.user?.family_name?.charAt(0)}.
                        </span>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                          {canManageTeam && (
                            <button
                              onClick={(e) => handleQuickAssign(project, role, e)}
                              className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                              title={`Assign ${role}`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer with staffing bar and actions */}
            <div className="p-4">
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Staffing</span>
                  <span>{project.filledRolesCount || 0}/{project.totalCoreRolesCount || coreRoles.length} roles filled</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      staffingPercentage === 100 ? 'bg-green-500' :
                      staffingPercentage > 0 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${staffingPercentage}%` }}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewTeam(project)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Team
                </button>
                {canManageTeam && (
                  <button
                    onClick={() => handleViewTeam(project)}
                    className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};