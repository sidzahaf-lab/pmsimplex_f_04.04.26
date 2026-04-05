// frontend/src/pages/ProjectTeams/components/ProjectListView.tsx (version avec classes CSS)
import React from 'react';
import { Eye, UserPlus, Users, Mail, Calendar, ChevronRight } from 'lucide-react';
import { Project, TeamAssignment } from '../../../types';

interface ProjectWithTeam extends Project {
  teamAssignments?: TeamAssignment[];
  roleAssignments?: Record<string, TeamAssignment>;
  staffingStatus?: string;
  filledCoreRolesCount?: number;
  totalCoreRolesCount?: number;
}

interface ProjectListViewProps {
  projects: ProjectWithTeam[];
  selectedColumns: string[];
  availableRoles: string[];
  canManageTeam: boolean;
  onQuickAssign: (project: ProjectWithTeam, roleName: string) => void;
  onViewTeam: (project: ProjectWithTeam) => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  selectedColumns,
  availableRoles,
  canManageTeam,
  onQuickAssign,
  onViewTeam,
}) => {
  const getStaffingBadge = (status: string) => {
    switch (status) {
      case 'fully_staffed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Fully Staffed</span>;
      case 'partially_staffed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Partially Staffed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Unstaffed</span>;
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'good':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Good</span>;
      case 'warning':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Warning</span>;
      case 'critical':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Critical</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Set</span>;
    }
  };

  if (selectedColumns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">Please select at least one column to display using the "Select Columns" button above.</p>
      </div>
    );
  }

  // Définition des largeurs de colonnes fixes
  const columnWidths = {
    project: 'min-w-[200px] max-w-[250px]',
    businessUnit: 'min-w-[150px] max-w-[200px]',
    phase: 'min-w-[100px] max-w-[120px]',
    health: 'min-w-[90px] max-w-[100px]',
    staffing: 'min-w-[120px] max-w-[140px]',
    role: 'min-w-[180px] max-w-[220px]',
    actions: 'min-w-[80px] max-w-[100px]',
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Project column */}
              <th className={`${columnWidths.project} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Project
              </th>
              {/* Business Unit column */}
              <th className={`${columnWidths.businessUnit} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Business Unit
              </th>
              {/* Phase column */}
              <th className={`${columnWidths.phase} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Phase
              </th>
              {/* Health column */}
              <th className={`${columnWidths.health} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Health
              </th>
              {/* Staffing column */}
              <th className={`${columnWidths.staffing} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Staffing
              </th>
              {/* Dynamic role columns */}
              {selectedColumns.map(roleName => (
                <th key={roleName} className={`${columnWidths.role} px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                  {roleName}
                </th>
              ))}
              {/* Actions column */}
              <th className={`${columnWidths.actions} px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                {/* Project column */}
                <td className={`${columnWidths.project} px-4 py-3 align-top`}>
                  <div>
                    <div className="text-sm font-medium text-gray-900 break-words">{project.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1 break-all">{project.code}</div>
                  </div>
                </td>
                
                {/* Business Unit column */}
                <td className={`${columnWidths.businessUnit} px-4 py-3 align-top text-sm text-gray-500`}>
                  <div className="break-words">{project.business_unit?.name || '-'}</div>
                </td>
                
                {/* Phase column */}
                <td className={`${columnWidths.phase} px-4 py-3 align-top text-sm text-gray-500`}>
                  {project.current_phase || 'N/A'}
                </td>
                
                {/* Health column */}
                <td className={`${columnWidths.health} px-4 py-3 align-top`}>
                  {getHealthBadge(project.health_status)}
                </td>
                
                {/* Staffing column */}
                <td className={`${columnWidths.staffing} px-4 py-3 align-top`}>
                  {getStaffingBadge(project.staffingStatus || 'unstaffed')}
                  <div className="text-xs text-gray-400 mt-1">
                    {project.filledCoreRolesCount}/{project.totalCoreRolesCount} core
                  </div>
                </td>
                
                {/* Dynamic role columns */}
                {selectedColumns.map(roleName => {
                  const assignment = project.roleAssignments?.[roleName];
                  return (
                    <td key={roleName} className={`${columnWidths.role} px-4 py-3 align-top`}>
                      {assignment ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900 break-words" title={`${assignment.user?.name} ${assignment.user?.family_name || ''}`}>
                            {assignment.user?.name} {assignment.user?.family_name || ''}
                          </div>
                          <div className="text-xs text-gray-500 break-all" title={assignment.user?.email}>
                            {assignment.user?.email}
                          </div>
                          {canManageTeam && (
                            <button
                              onClick={() => onQuickAssign(project, roleName)}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm text-gray-400 italic">Unassigned</span>
                          {canManageTeam && (
                            <button
                              onClick={() => onQuickAssign(project, roleName)}
                              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                
                {/* Actions column */}
                <td className={`${columnWidths.actions} px-4 py-3 align-top text-right text-sm font-medium whitespace-nowrap`}>
                  <button
                    onClick={() => onViewTeam(project)}
                    className="text-blue-600 hover:text-blue-900 mr-2 inline-flex items-center"
                    title="View Team"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canManageTeam && (
                    <button
                      onClick={() => onViewTeam(project)}
                      className="text-green-600 hover:text-green-900 inline-flex items-center"
                      title="Manage Team"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};