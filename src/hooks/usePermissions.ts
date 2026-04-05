// frontend/src/hooks/usePermissions.ts
import { useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { PERMISSIONS, hasPermission } from '../constants/permissions';

export interface UsePermissionsReturn {
  can: (permission: string) => boolean;
  hasAny: (permissions: string[]) => boolean;
  hasAll: (permissions: string[]) => boolean;
  
  canManageTeam: boolean;
  canManageProject: boolean;
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canViewProject: boolean;
  canManageUsers: boolean;
  canCreateUser: boolean;
  canManageBusinessUnit: boolean;
  canViewBusinessUnit: boolean;
  canManageRoles: boolean;
  canExportData: boolean;
  
  isSuperAdmin: boolean;
  isGuest: boolean;
  hasCorporateRole: boolean;
  corporateRoleName: string | null;
  
  canManageInBU: (businessUnitId?: string) => boolean;
  canManageInProject: (projectId?: string) => boolean;
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user } = useAuth();
  
  console.log('🔐 usePermissions - user:', user?.email, 'is_super_admin:', user?.is_super_admin);
  
  const isSuperAdmin = useMemo(() => {
    return user?.is_super_admin === true;
  }, [user]);

  // Utiliser useCallback au lieu de useMemo pour les fonctions
  const can = useCallback((permission: string): boolean => {
    if (isSuperAdmin) {
      console.log('🔐 Super Admin - granting permission:', permission);
      return true;
    }
    const result = hasPermission(user, permission);
    console.log('🔐 can:', permission, result);
    return result;
  }, [user, isSuperAdmin]);

  const hasAny = useCallback((permissions: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissions.some(permission => hasPermission(user, permission));
  }, [user, isSuperAdmin]);

  const hasAll = useCallback((permissions: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissions.every(permission => hasPermission(user, permission));
  }, [user, isSuperAdmin]);

  const canManageTeam = useMemo(() => {
    if (isSuperAdmin) return true;
    const result = hasPermission(user, PERMISSIONS.TEAM_CREATE) || 
           hasPermission(user, PERMISSIONS.PROJECT_MEMBERS_MANAGE);
    console.log('🔐 canManageTeam:', result);
    return result;
  }, [user, isSuperAdmin]);

  const canManageProject = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.PROJECT_EDIT) ||
           hasPermission(user, PERMISSIONS.PROJECT_DELETE);
  }, [user, isSuperAdmin]);

  const canCreateProject = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.PROJECT_CREATE);
  }, [user, isSuperAdmin]);

  const canEditProject = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.PROJECT_EDIT);
  }, [user, isSuperAdmin]);

  const canDeleteProject = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.PROJECT_DELETE);
  }, [user, isSuperAdmin]);

  const canViewProject = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.PROJECT_VIEW);
  }, [user, isSuperAdmin]);

  const canManageUsers = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.USER_CREATE) ||
           hasPermission(user, PERMISSIONS.USER_UPDATE) ||
           hasPermission(user, PERMISSIONS.USER_DELETE);
  }, [user, isSuperAdmin]);

  const canCreateUser = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.USER_CREATE);
  }, [user, isSuperAdmin]);

  const canManageBusinessUnit = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.BU_UPDATE) ||
           hasPermission(user, PERMISSIONS.BU_DELETE);
  }, [user, isSuperAdmin]);

  const canViewBusinessUnit = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.BU_READ);
  }, [user, isSuperAdmin]);

  const canManageRoles = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.ROLE_CREATE) ||
           hasPermission(user, PERMISSIONS.ROLE_UPDATE) ||
           hasPermission(user, PERMISSIONS.ROLE_DELETE);
  }, [user, isSuperAdmin]);

  const canExportData = useMemo(() => {
    if (isSuperAdmin) return true;
    return hasPermission(user, PERMISSIONS.CORPORATE_REPORTS_VIEW);
  }, [user, isSuperAdmin]);

  const isGuest = useMemo(() => user?.is_guest === true, [user]);
  const hasCorporateRole = useMemo(() => !!user?.corporate_role, [user]);
  const corporateRoleName = useMemo(() => user?.corporate_role?.name || null, [user]);

  const canManageInBU = useCallback((businessUnitId?: string): boolean => {
    if (isSuperAdmin) {
      console.log('🔐 canManageInBU - Super Admin: true');
      return true;
    }
    if (!businessUnitId) {
      return hasPermission(user, PERMISSIONS.BU_UPDATE);
    }
    const hasBUAssignment = user?.team_assignments?.some(
      assignment => 
        assignment.business_unit_id === businessUnitId && 
        assignment.is_active &&
        assignment.role?.scope === 'bu'
    );
    const result = hasBUAssignment || hasPermission(user, PERMISSIONS.BU_UPDATE);
    console.log('🔐 canManageInBU:', businessUnitId, result);
    return result;
  }, [user, isSuperAdmin]);

  const canManageInProject = useCallback((projectId?: string): boolean => {
    if (isSuperAdmin) {
      console.log('🔐 canManageInProject - Super Admin: true');
      return true;
    }
    if (hasPermission(user, PERMISSIONS.PROJECT_MEMBERS_MANAGE)) {
      console.log('🔐 canManageInProject - has PROJECT_MEMBERS_MANAGE: true');
      return true;
    }
    if (projectId) {
      const hasProjectAssignment = user?.team_assignments?.some(
        assignment => 
          assignment.project_id === projectId && 
          assignment.is_active &&
          assignment.role?.scope === 'project'
      );
      if (hasProjectAssignment) {
        console.log('🔐 canManageInProject - has project assignment: true');
        return true;
      }
    }
    console.log('🔐 canManageInProject:', projectId, false);
    return false;
  }, [user, isSuperAdmin]);

  return {
    can,
    hasAny,
    hasAll,
    
    canManageTeam,
    canManageProject,
    canCreateProject,
    canEditProject,
    canDeleteProject,
    canViewProject,
    canManageUsers,
    canCreateUser,
    canManageBusinessUnit,
    canViewBusinessUnit,
    canManageRoles,
    canExportData,
    
    isSuperAdmin,
    isGuest,
    hasCorporateRole,
    corporateRoleName,
    
    canManageInBU,
    canManageInProject,
  };
};