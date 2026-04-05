// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthAPI } from '@/services/api';
import { ROLE_PERMISSIONS, PERMISSIONS } from '@/constants/permissions';

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  family_name: string;
  job_title: string;
  department?: string;
  phone_number?: string;
  business_unit_id?: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  is_guest: boolean;
  // ✅ NOUVEAUX CHAMPS POUR LES RÔLES
  corporate_role?: string | null;      // Ex: "Executive", "Corporate PMO Officer"
  default_role?: string | null;        // Ex: "BU Manager", "Project Manager" (suggestion)
  bu_role?: string | null;             // Ex: "BU Manager" (rôle réel via teams)
  business_unit?: {
    id: string;
    name: string;
    type: string;
  } | null;
  created_at?: string;
  last_modified_at?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isGuest: boolean;
  // ✅ NOUVELLES PROPRIÉTÉS
  corporateRole: string | null;
  defaultRole: string | null;
  buRole: string | null;
  // ✅ FONCTION DE VÉRIFICATION DES PERMISSIONS
  can: (permission: string) => boolean;
  hasRole: (roleName: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('authToken');
    
    console.log('AuthProvider mount - storedUser:', storedUser);
    console.log('AuthProvider mount - token:', token);
    
    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('AuthProvider - parsed user:', parsedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse stored user', e);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // ✅ FONCTION DE VÉRIFICATION DES PERMISSIONS
  const can = (permission: string): boolean => {
    if (!user) return false;
    
    // 1. Super admin a toutes les permissions
    if (user.is_super_admin) return true;
    
    // 2. Vérifier le rôle corporate (cross-BU governance)
    if (user.corporate_role) {
      const permissions = ROLE_PERMISSIONS[user.corporate_role];
      if (permissions?.includes('*') || permissions?.includes(permission)) {
        console.log(`✅ Permission granted via corporate role "${user.corporate_role}": ${permission}`);
        return true;
      }
    }
    
    // 3. Vérifier le rôle BU (via team_assignments)
    if (user.bu_role) {
      const permissions = ROLE_PERMISSIONS[user.bu_role];
      if (permissions?.includes('*') || permissions?.includes(permission)) {
        console.log(`✅ Permission granted via BU role "${user.bu_role}": ${permission}`);
        return true;
      }
    }
    
    // 4. Vérifier le rôle default (suggestion, peut avoir des permissions de base)
    if (user.default_role && user.default_role !== user.bu_role) {
      const permissions = ROLE_PERMISSIONS[user.default_role];
      if (permissions?.includes('*') || permissions?.includes(permission)) {
        console.log(`✅ Permission granted via default role "${user.default_role}": ${permission}`);
        return true;
      }
    }
    
    console.log(`❌ Permission denied: ${permission}`);
    return false;
  };

  // ✅ FONCTION DE VÉRIFICATION DES RÔLES
  const hasRole = (roleName: string): boolean => {
    if (!user) return false;
    
    // Vérifier super admin
    if (user.is_super_admin && roleName === 'Super Admin') return true;
    
    // Vérifier corporate role
    if (user.corporate_role === roleName) return true;
    
    // Vérifier BU role
    if (user.bu_role === roleName) return true;
    
    // Vérifier default role
    if (user.default_role === roleName) return true;
    
    return false;
  };

  const login = async (email: string, password: string) => {
    console.log('AuthProvider login called');
    const response = await AuthAPI.login(email, password);
    const { accessToken, refreshToken, user } = response.data.data;
    
    console.log('AuthProvider - user from API:', user);
    console.log('AuthProvider - roles:', {
      corporate_role: user.corporate_role,
      default_role: user.default_role,
      bu_role: user.bu_role,
      is_super_admin: user.is_super_admin,
      is_guest: user.is_guest
    });
    
    localStorage.setItem('authToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    console.log('AuthProvider logout called');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSuperAdmin: user?.is_super_admin || false,
        isGuest: user?.is_guest || false,
        // ✅ NOUVELLES PROPRIÉTÉS
        corporateRole: user?.corporate_role || null,
        defaultRole: user?.default_role || null,
        buRole: user?.bu_role || null,
        // ✅ FONCTIONS
        can,
        hasRole,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}