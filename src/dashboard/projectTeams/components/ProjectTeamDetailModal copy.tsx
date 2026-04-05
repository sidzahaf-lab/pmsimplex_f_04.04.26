// frontend/src/pages/ProjectTeams/components/ProjectTeamDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, User, Mail, Calendar, UserCheck, UserX, RefreshCw, History } from 'lucide-react';
import { Project, TeamAssignment, User as UserType } from '../../../types';
import { TeamAPI, UserAPI, RoleAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { TeamAssignmentModal } from './TeamAssignmentModal';

interface ProjectTeamDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project & { teamAssignments?: TeamAssignment[] };
  canManage: boolean;
  onAssignmentChange: () => void;
}

const CORE_ROLES = ['PM', 'Deputy PM', 'Planning Engineer', 'Cost Engineer', 'Document Controller'];
const SUPPORT_ROLES = ['QA/QC', 'HSE', 'Engineer', 'Viewer'];

export const ProjectTeamDetailModal: React.FC<ProjectTeamDetailModalProps> = ({
  isOpen,
  onClose,
  project,
  canManage,
  onAssignmentChange,
}) => {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch all team assignments for this project
  const { data: teamsData, isLoading, refetch } = useQuery({
    queryKey: ['teams', 'project', project.id],
    queryFn: () => TeamAPI.getByProject(project.id as string, { is_active: true, limit: 100 }),
    enabled: isOpen && !!project.id,
  });

  // Fetch all roles
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => RoleAPI.getAll({ limit: 100 }),
  });

  // Remove assignment mutation
  const { mutate: removeAssignment, isPending: isRemoving } = useMutation({
    mutationFn: (teamId: string) => TeamAPI.deactivate(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      refetch();
      onAssignmentChange();
      toast.success('Team member removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove team member');
    },
  });

  // Get role name by ID
  const getRoleName = (roleId: string) => {
    return rolesData?.data?.roles?.find((r: any) => r.id === roleId)?.name || 'Unknown';
  };

  // Group assignments by role
  const assignmentsByRole: Record<string, TeamAssignment> = {};
  teamsData?.data?.teams?.forEach((team: TeamAssignment) => {
    if (team.role?.name) {
      assignmentsByRole[team.role.name] = team;
    }
  });

  // Get all roles (core + support) with assignments
  const allRoles = [...CORE_ROLES, ...SUPPORT_ROLES];
  const filledRoles = Object.keys(assignmentsByRole);
  const unfilledRoles = allRoles.filter(role => !filledRoles.includes(role));

  const handleRemove = (team: TeamAssignment) => {
    if (confirm(`Remove ${team.user?.name} ${team.user?.family_name} from ${team.role?.name} role?`)) {
      removeAssignment(team.id);
    }
  };

  const handleAssign = (roleName: string) => {
    setSelectedRole(roleName);
    setShowAssignmentModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900">
                      {project.name}
                    </h3>
                    <span className="text-sm font-mono text-gray-500">{project.code}</span>
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <span>{project.business_unit?.name}</span>
                    <span>•</span>
                    <span>Phase: {project.current_phase || 'N/A'}</span>
                    <span>•</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      project.health_status === 'good' ? 'bg-green-100 text-green-800' :
                      project.health_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      project.health_status === 'critical' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      Health: {project.health_status || 'Not Set'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-gray-400 hover:text-gray-500"
                    title="Show assignment history"
                  >
                    <History className="w-5 h-5" />
                  </button>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Core PMT Roles */}
                  <div className="mb-8">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Core PMT Roles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {CORE_ROLES.map(roleName => {
                        const assignment = assignmentsByRole[roleName];
                        return (
                          <RoleCard
                            key={roleName}
                            roleName={roleName}
                            assignment={assignment}
                            canManage={canManage}
                            onAssign={() => handleAssign(roleName)}
                            onRemove={() => assignment && handleRemove(assignment)}
                            isRemoving={isRemoving}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Technical & Support Roles */}
                  <div className="mb-8">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Technical & Support Roles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SUPPORT_ROLES.map(roleName => {
                        const assignment = assignmentsByRole[roleName];
                        return (
                          <RoleCard
                            key={roleName}
                            roleName={roleName}
                            assignment={assignment}
                            canManage={canManage}
                            onAssign={() => handleAssign(roleName)}
                            onRemove={() => assignment && handleRemove(assignment)}
                            isRemoving={isRemoving}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Assignment History */}
                  {showHistory && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Assignment History</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {teamsData?.data?.teams?.map((team: TeamAssignment) => (
                          <div key={team.id} className="p-3 bg-gray-50 rounded-md text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">
                                  {team.user?.name} {team.user?.family_name}
                                </span>
                                <span className="text-gray-500 mx-2">→</span>
                                <span className="text-blue-600">{team.role?.name}</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {team.is_active ? (
                                  <span className="text-green-600">Active</span>
                                ) : (
                                  <span className="text-red-600">Removed</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                              <span>Assigned: {new Date(team.assigned_at).toLocaleDateString()}</span>
                              {team.removed_at && (
                                <span>Removed: {new Date(team.removed_at).toLocaleDateString()}</span>
                              )}
                              {team.assigner && (
                                <span>By: {team.assigner.name}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && selectedRole && (
        <TeamAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedRole(null);
          }}
          project={project}
          roleName={selectedRole}
          onSuccess={() => {
            refetch();
            onAssignmentChange();
          }}
        />
      )}
    </>
  );
};

interface RoleCardProps {
  roleName: string;
  assignment?: TeamAssignment;
  canManage: boolean;
  onAssign: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}

const RoleCard: React.FC<RoleCardProps> = ({
  roleName,
  assignment,
  canManage,
  onAssign,
  onRemove,
  isRemoving,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-medium text-gray-900">{roleName}</h5>
        {!assignment && canManage && (
          <button
            onClick={onAssign}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + Assign
          </button>
        )}
      </div>

      {assignment ? (
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {assignment.user?.name} {assignment.user?.family_name}
            </p>
            <p className="text-xs text-gray-500">{assignment.user?.job_title}</p>
            <div className="flex items-center mt-1 text-xs text-gray-400">
              <Mail className="w-3 h-3 mr-1" />
              <span className="truncate">{assignment.user?.email}</span>
            </div>
            <div className="flex items-center mt-1 text-xs text-gray-400">
              <Calendar className="w-3 h-3 mr-1" />
              <span>Since {new Date(assignment.assigned_at).toLocaleDateString()}</span>
            </div>
            {assignment.assigner && (
              <p className="text-xs text-gray-400 mt-1">
                Assigned by: {assignment.assigner.name}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex flex-col space-y-1">
              <button
                onClick={onAssign}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Change Role
              </button>
              <button
                onClick={onRemove}
                disabled={isRemoving}
                className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 italic">Unassigned</p>
          {canManage && (
            <button
              onClick={onAssign}
              className="mt-2 inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <UserCheck className="w-3 h-3 mr-1" />
              Assign Member
            </button>
          )}
        </div>
      )}
    </div>
  );
};