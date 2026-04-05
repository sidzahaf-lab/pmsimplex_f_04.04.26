// frontend/src/pages/ProjectTeams/components/TeamAssignmentModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Project, User as UserType, Role, TeamAssignment } from '../../../types';
import { TeamAPI, UserAPI, RoleAPI } from '../../../services/api';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface TeamAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  roleName: string;
  onSuccess: () => void;
}

export const TeamAssignmentModal: React.FC<TeamAssignmentModalProps> = ({
  isOpen,
  onClose,
  project,
  roleName,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const { canManageTeam, canManageInProject, isSuperAdmin } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [existingAssignment, setExistingAssignment] = useState<TeamAssignment | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [userCurrentRole, setUserCurrentRole] = useState<{ roleName: string; hasOtherProjects: boolean } | null>(null);
  const [showRoleWarning, setShowRoleWarning] = useState(false);

  // Calcul de la permission
  const canAssign = useMemo(() => {
    if (authLoading) return null;
    if (!user) return false;
    const result = canManageTeam || canManageInProject(project?.id) || isSuperAdmin;
    return result;
  }, [canManageTeam, canManageInProject, project?.id, isSuperAdmin, user, authLoading]);

  // Fermeture si pas de permission
  useEffect(() => {
    if (!authLoading && canAssign === false && isOpen) {
      toast.error('You do not have permission to assign team members');
      onClose();
    }
  }, [canAssign, authLoading, isOpen, onClose]);

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', project?.business_unit_id, searchTerm, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) {
        const response = await UserAPI.getAll({ 
          is_active: true,
          limit: 100
        });
        return response;
      }
      
      if (project?.business_unit_id) {
        const response = await UserAPI.getByBusinessUnit(project.business_unit_id, {
          is_active: true,
          search: searchTerm,
          limit: 50,
        });
        return response;
      }
      
      return { data: { users: [] } };
    },
    enabled: isOpen && canAssign === true,
  });

  // Fetch roles - ONLY project scope roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', 'project', 'scope'],
    queryFn: async () => {
      // Fetch only project-scoped roles
      const response = await RoleAPI.getAll({ 
        limit: 100,
        scope: 'project' // Add filter for project scope only
      });
      return response;
    },
    enabled: isOpen && canAssign === true,
  });

  // Fetch user's existing roles across all projects (for consistency check)
  const { data: userRolesData, refetch: refetchUserRoles } = useQuery({
    queryKey: ['user-roles-consistency', selectedUser?.id, project?.business_unit_id],
    queryFn: async () => {
      if (!selectedUser?.id) return null;
      // API call to get user's role summary
      const response = await TeamAPI.getUserRoleSummary(selectedUser.id, project.business_unit_id);
      return response;
    },
    enabled: !!selectedUser?.id && isOpen,
  });

  // Extraire les utilisateurs
  const users = useMemo(() => {
    if (!usersData?.data) return [];
    
    const responseData = usersData.data;
    let usersList: UserType[] = [];
    
    if (responseData?.data?.users && Array.isArray(responseData.data.users)) {
      usersList = responseData.data.users;
    } else if (responseData?.users && Array.isArray(responseData.users)) {
      usersList = responseData.users;
    } else if (Array.isArray(responseData)) {
      usersList = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      usersList = responseData.data;
    }
    
    return usersList;
  }, [usersData]);

  // Extraire les rôles - ONLY project scope (exclude corporate and bu)
  const roles = useMemo(() => {
    if (!rolesData?.data) return [];
    
    const responseData = rolesData.data;
    let rolesList: Role[] = [];
    
    if (responseData?.data?.roles && Array.isArray(responseData.data.roles)) {
      rolesList = responseData.data.roles;
    } else if (responseData?.roles && Array.isArray(responseData.roles)) {
      rolesList = responseData.roles;
    } else if (Array.isArray(responseData)) {
      rolesList = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      rolesList = responseData.data;
    }
    
    // CRITICAL: Filter to ONLY project-scoped roles
    // Exclude 'corporate' and 'bu' scopes
    return rolesList.filter(role => role.scope === 'project');
  }, [rolesData]);

  // Check user's role consistency when user is selected
  useEffect(() => {
    if (selectedUser && userRolesData?.data) {
      const userRoleSummary = userRolesData.data;
      if (userRoleSummary.has_assignments && !userRoleSummary.is_consistent) {
        setUserCurrentRole({
          roleName: userRoleSummary.role?.name || 'unknown',
          hasOtherProjects: userRoleSummary.total_projects > 0
        });
        setShowRoleWarning(true);
      } else if (userRoleSummary.has_assignments && userRoleSummary.is_consistent) {
        setUserCurrentRole({
          roleName: userRoleSummary.role?.name || 'unknown',
          hasOtherProjects: userRoleSummary.total_projects > 1
        });
        setShowRoleWarning(false);
      } else {
        setUserCurrentRole(null);
        setShowRoleWarning(false);
      }
    }
  }, [selectedUser, userRolesData]);

  // Trouver le rôle correspondant au roleName
  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      const role = roles.find(r => r.name === roleName);
      if (role) {
        setSelectedRole(role);
      } else if (roles.length > 0) {
        setSelectedRole(roles[0]);
      }
    }
  }, [roles, roleName, selectedRole]);

  // Vérifier l'assignation existante dans CE projet
  useEffect(() => {
    if (project?.teamAssignments && selectedRole) {
      const existing = project.teamAssignments.find(
        (t: TeamAssignment) => t.role_id === selectedRole.id && t.is_active
      );
      setExistingAssignment(existing || null);
      setConfirmReplace(false);
    }
  }, [project, selectedRole]);

  // Reset quand le modal se ferme
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedUser(null);
      setConfirmReplace(false);
      setExistingAssignment(null);
      setStep('select');
      setShowRoleWarning(false);
      setUserCurrentRole(null);
    }
  }, [isOpen]);

  // Filtrer les utilisateurs suggérés
  const suggestedUsers = useMemo(() => {
    return users.filter(u => 
      u.default_role?.name === roleName || 
      u.job_title?.toLowerCase().includes(roleName.toLowerCase())
    );
  }, [users, roleName]);

  const regularUsers = useMemo(() => {
    return users.filter(u => 
      u.default_role?.name !== roleName && 
      !u.job_title?.toLowerCase().includes(roleName.toLowerCase())
    );
  }, [users, roleName]);

  // Mutation pour créer l'assignation
  const { mutate: createAssignment, isPending: isCreating } = useMutation({
    mutationFn: (data: any) => TeamAPI.create(data),
    onSuccess: () => {
      toast.success('Team member assigned successfully');
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to assign team member';
      toast.error(errorMessage);
      
      // If error is about role inconsistency, show warning
      if (errorMessage.includes('already working as')) {
        setShowRoleWarning(true);
      }
    },
  });

  // Mutation pour supprimer l'assignation existante
  const { mutate: removeAssignment, isPending: isRemoving } = useMutation({
    mutationFn: (teamId: string) => TeamAPI.deactivate(teamId),
    onSuccess: () => {
      createAssignment({
        business_unit_id: project.business_unit_id,
        project_id: project.id,
        user_id: selectedUser!.id,
        role_id: selectedRole!.id,
        is_active: true,
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove existing assignment');
    },
  });

  const handleAssign = () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Please select a user and role');
      return;
    }

    // Check role consistency warning
    if (userCurrentRole && userCurrentRole.roleName !== selectedRole.name) {
      toast.error(
        `User is already working as "${userCurrentRole.roleName}" on other projects. ` +
        `User cannot have different roles across projects.`
      );
      return;
    }

    if (existingAssignment && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    if (existingAssignment && confirmReplace) {
      removeAssignment(existingAssignment.id);
    } else {
      createAssignment({
        business_unit_id: project.business_unit_id,
        project_id: project.id,
        user_id: selectedUser.id,
        role_id: selectedRole.id,
        is_active: true,
      });
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedUser(null);
    setConfirmReplace(false);
    setExistingAssignment(null);
    setStep('select');
    setShowRoleWarning(false);
    setUserCurrentRole(null);
    onClose();
  };

  const currentAssignee = existingAssignment?.user 
    ? `${existingAssignment.user.name} ${existingAssignment.user.family_name}`
    : null;

  const isProcessing = isCreating || isRemoving;

  if (!isOpen) return null;

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!canAssign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Assign {roleName}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            Project: <span className="font-medium text-gray-700">{project.name}</span>
            <span className="mx-1">•</span>
            <span className="font-mono text-xs">{project.code}</span>
          </p>

          {/* Role consistency warning */}
          {showRoleWarning && userCurrentRole && selectedRole && userCurrentRole.roleName !== selectedRole.name && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-semibold">Role Inconsistency Detected</p>
                  <p>
                    This user is already working as <span className="font-semibold">"{userCurrentRole.roleName}"</span> on other projects.
                  </p>
                  <p className="mt-1">
                    Users cannot have different roles across different projects.
                    Please select the role <span className="font-semibold">"{userCurrentRole.roleName}"</span> or choose another user.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'select' ? (
            <>
              {/* Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search User
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or job title..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Users list */}
              <div className="mb-4 max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    {suggestedUsers.length > 0 && (
                      <div className="border-b">
                        <div className="px-3 py-2 bg-blue-50">
                          <p className="text-xs font-semibold text-blue-700">Suggested</p>
                        </div>
                        {suggestedUsers.map((user) => (
                          <UserItem
                            key={user.id}
                            user={user}
                            isSelected={selectedUser?.id === user.id}
                            onSelect={() => {
                              setSelectedUser(user);
                              refetchUserRoles();
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {regularUsers.length > 0 && (
                      <div>
                        {suggestedUsers.length > 0 && (
                          <div className="px-3 py-2 bg-gray-50">
                            <p className="text-xs font-medium text-gray-500">All Users</p>
                          </div>
                        )}
                        {regularUsers.map((user) => (
                          <UserItem
                            key={user.id}
                            user={user}
                            isSelected={selectedUser?.id === user.id}
                            onSelect={() => {
                              setSelectedUser(user);
                              refetchUserRoles();
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {users.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        {searchTerm ? `No users found matching "${searchTerm}"` : 'No users available'}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Role selection - ONLY project roles */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-xs text-gray-500">(Project roles only)</span>
                </label>
                {rolesLoading ? (
                  <div className="flex items-center py-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-2" />
                    <span className="text-sm text-gray-500">Loading roles...</span>
                  </div>
                ) : (
                  <select
                    value={selectedRole?.id || ''}
                    onChange={(e) => {
                      const role = roles.find(r => r.id === e.target.value);
                      setSelectedRole(role || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
                {roles.length === 0 && !rolesLoading && (
                  <p className="text-xs text-amber-600 mt-1">
                    No project roles available. Please create project roles first.
                  </p>
                )}
              </div>

              {/* Info about user's current role */}
              {selectedUser && userCurrentRole && userCurrentRole.hasOtherProjects && (
                <div className="mb-4 p-2 bg-blue-50 rounded-md">
                  <p className="text-xs text-blue-700">
                    <span className="font-semibold">ℹ️ User's current role:</span>{' '}
                    {userCurrentRole.roleName} on {userCurrentRole.hasOtherProjects ? 'multiple projects' : 'another project'}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedUser && selectedRole) {
                      // Check role consistency before proceeding
                      if (userCurrentRole && userCurrentRole.roleName !== selectedRole.name) {
                        toast.error(
                          `User is already working as "${userCurrentRole.roleName}". ` +
                          `Cannot assign as "${selectedRole.name}".`
                        );
                        return;
                      }
                      setStep('confirm');
                    } else {
                      toast.error('Please select both a user and a role');
                    }
                  }}
                  disabled={!selectedUser || !selectedRole || (showRoleWarning && userCurrentRole?.roleName !== selectedRole?.name)}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation step */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-2">Selected User</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">{selectedUser?.name} {selectedUser?.family_name}</p>
                      <p className="text-sm text-gray-500">{selectedUser?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-2">Selected Role</p>
                  <p className="font-medium">{selectedRole?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">Scope: Project</p>
                </div>

                {userCurrentRole && userCurrentRole.hasOtherProjects && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-green-700">
                        User is currently working as <span className="font-semibold">"{userCurrentRole.roleName}"</span> on other projects.
                        This is allowed as long as the role is the same.
                      </p>
                    </div>
                  </div>
                )}

                {existingAssignment && currentAssignee && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        This will replace <span className="font-semibold">{currentAssignee}</span> in this project
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isProcessing}
                >
                  Back
                </button>
                <button
                  onClick={handleAssign}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {existingAssignment && !confirmReplace ? 'Review Replacement' : 'Confirm'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Composant UserItem
const UserItem: React.FC<{
  user: UserType;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ user, isSelected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 border-b last:border-b-0 transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          <User className="w-4 h-4" />
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{user.name} {user.family_name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
          {user.default_role && (
            <p className="text-xs text-gray-400">Default: {user.default_role.name}</p>
          )}
        </div>
        {isSelected && <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />}
      </div>
    </button>
  );
};