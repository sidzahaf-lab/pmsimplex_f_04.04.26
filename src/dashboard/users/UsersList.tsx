// frontend/src/dashboard/users/UsersList.tsx
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
  User,
  Edit,
  Mail,
  Phone,
  Building,
  BadgeCheck,
  BadgeX,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  ShieldAlert,
  Crown,
  Clock,
  Briefcase,
  Users,
  Calendar,
  Hourglass,
} from 'lucide-react';
import { UserAPI, BusinessUnitAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Types with full role hierarchy
interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  family_name: string;
  job_title: string;
  department: string;
  phone_number?: string;
  business_unit_id: string;
  is_active: boolean;
  is_super_admin: boolean;
  is_guest: boolean;
  guest_first_access?: string;
  guest_expires_at?: string;
  corporate_role_id?: string;
  corporate_role?: {
    id: string;
    name: string;
    scope: string;
  };
  default_role_id?: string;
  default_role?: {
    id: string;
    name: string;
    scope: string;
  };
  created_at: string;
  last_modified_at: string;
  business_unit?: {
    id: string;
    name: string;
    type: string;
    client_id: number;
  };
}

interface BusinessUnit {
  id: string;
  name: string;
  type: string;
  client_id: number;
  description?: string;
}

interface Client {
  id: number;
  name: string;
  slug: string;
  url?: string;
}

export function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [databaseInfo, setDatabaseInfo] = useState<{
    connected: boolean;
    type: string;
    database: string;
    host: string;
    environment: string;
  } | null>(null);
  const [showRawData, setShowRawData] = useState(false);

  // Helper function to get role display info
  const getRoleDisplay = (user: User) => {
    // Level 1: Super Admin
    if (user.is_super_admin) {
      return {
        icon: <Crown className="h-4 w-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        label: 'Super Admin',
        description: 'Full system access',
        level: 1
      };
    }
    
    // Level 2: Guest
    if (user.is_guest) {
      const expiresAt = user.guest_expires_at ? new Date(user.guest_expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();
      const now = new Date();
      const firstAccess = user.guest_first_access ? new Date(user.guest_first_access) : null;
      
      let timeRemaining = '';
      if (expiresAt && !isExpired) {
        const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
        if (hoursLeft < 24) {
          timeRemaining = `${hoursLeft}h remaining`;
        } else {
          const daysLeft = Math.floor(hoursLeft / 24);
          timeRemaining = `${daysLeft}d remaining`;
        }
      }
      
      return {
        icon: <Clock className="h-4 w-4" />,
        color: isExpired ? 'text-red-500' : 'text-orange-500',
        bgColor: isExpired ? 'bg-red-50' : 'bg-orange-50',
        label: 'Guest',
        description: isExpired ? 'Expired' : (timeRemaining || '24h access'),
        level: 2
      };
    }
    
    // Level 3: Corporate Role
    if (user.corporate_role) {
      return {
        icon: <Briefcase className="h-4 w-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        label: user.corporate_role.name,
        description: 'Corporate Level',
        level: 3
      };
    }
    
    // Level 4 & 5: BU or Project roles (from default_role suggestion)
    if (user.default_role) {
      const scopeLabel = user.default_role.scope === 'bu' ? 'BU Level' : 'Project Level';
      return {
        icon: user.default_role.scope === 'bu' ? <Building className="h-4 w-4" /> : <Users className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        label: user.default_role.name,
        description: scopeLabel,
        level: user.default_role.scope === 'bu' ? 4 : 5
      };
    }
    
    // Default user
    return {
      icon: <Shield className="h-4 w-4" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      label: 'Standard User',
      description: 'No role assigned',
      level: 5
    };
  };

  // Helper function to extract users from different response formats
  const extractUsers = (response: any): User[] => {
    console.log('🔍 extractUsers called with response:', response);
    
    if (!response) {
      console.log('❌ Response is null or undefined');
      return [];
    }
    
    // Check if it's a single user object
    if (response.id && response.username) {
      console.log('✅ Found single user object');
      const user: User = {
        id: response.id?.toString() || '',
        username: response.username || '',
        email: response.email || '',
        name: response.name || '',
        family_name: response.family_name || '',
        job_title: response.job_title || response.title || '',
        department: response.department || response.specialty || '',
        phone_number: response.phone_number || response.phonenumber || '',
        business_unit_id: response.business_unit_id?.toString() || '',
        is_active: response.is_active || false,
        is_super_admin: response.is_super_admin || false,
        is_guest: response.is_guest || false,
        guest_first_access: response.guest_first_access,
        guest_expires_at: response.guest_expires_at,
        corporate_role_id: response.corporate_role_id,
        corporate_role: response.corporate_role,
        default_role_id: response.default_role_id,
        default_role: response.default_role,
        created_at: response.created_at || new Date().toISOString(),
        last_modified_at: response.last_modified_at || response.created_at || new Date().toISOString(),
        business_unit: response.business_unit || undefined
      };
      return [user];
    }
    
    // If response is already an array, return it
    if (Array.isArray(response)) {
      console.log('✅ Response is direct array, length:', response.length);
      const result = response.map((item: any) => ({
        id: item.id?.toString() || '',
        username: item.username || '',
        email: item.email || '',
        name: item.name || '',
        family_name: item.family_name || '',
        job_title: item.job_title || item.title || '',
        department: item.department || item.specialty || '',
        phone_number: item.phone_number || item.phonenumber || '',
        business_unit_id: item.business_unit_id?.toString() || '',
        is_active: item.is_active || false,
        is_super_admin: item.is_super_admin || false,
        is_guest: item.is_guest || false,
        guest_first_access: item.guest_first_access,
        guest_expires_at: item.guest_expires_at,
        corporate_role_id: item.corporate_role_id,
        corporate_role: item.corporate_role,
        default_role_id: item.default_role_id,
        default_role: item.default_role,
        created_at: item.created_at || new Date().toISOString(),
        last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
        business_unit: item.business_unit || undefined
      }));
      console.log('✅ Mapped users:', result);
      return result;
    }
    
    // Try to find users data in common locations
    const possiblePaths = [
      'users',
      'data',
      'data.users',
      'data.data',
      'result',
      'items',
      'records'
    ];
    
    for (const path of possiblePaths) {
      const parts = path.split('.');
      let current = response;
      
      for (const part of parts) {
        if (current && current[part]) {
          current = current[part];
        } else {
          current = null;
          break;
        }
      }
      
      if (Array.isArray(current)) {
        console.log(`✅ Found users at path "${path}", length:`, current.length);
        const result = current.map((item: any) => ({
          id: item.id?.toString() || '',
          username: item.username || '',
          email: item.email || '',
          name: item.name || '',
          family_name: item.family_name || '',
          job_title: item.job_title || item.title || '',
          department: item.department || item.specialty || '',
          phone_number: item.phone_number || item.phonenumber || '',
          business_unit_id: item.business_unit_id?.toString() || '',
          is_active: item.is_active || false,
          is_super_admin: item.is_super_admin || false,
          is_guest: item.is_guest || false,
          guest_first_access: item.guest_first_access,
          guest_expires_at: item.guest_expires_at,
          corporate_role_id: item.corporate_role_id,
          corporate_role: item.corporate_role,
          default_role_id: item.default_role_id,
          default_role: item.default_role,
          created_at: item.created_at || new Date().toISOString(),
          last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
          business_unit: item.business_unit || undefined
        }));
        return result;
      }
    }
    
    // Check if response is a single user wrapped in data object
    if (response.data && response.data.id && response.data.username) {
      console.log('✅ Found single user in data object');
      const user: User = {
        id: response.data.id?.toString() || '',
        username: response.data.username || '',
        email: response.data.email || '',
        name: response.data.name || '',
        family_name: response.data.family_name || '',
        job_title: response.data.job_title || response.data.title || '',
        department: response.data.department || response.data.specialty || '',
        phone_number: response.data.phone_number || response.data.phonenumber || '',
        business_unit_id: response.data.business_unit_id?.toString() || '',
        is_active: response.data.is_active || false,
        is_super_admin: response.data.is_super_admin || false,
        is_guest: response.data.is_guest || false,
        guest_first_access: response.data.guest_first_access,
        guest_expires_at: response.data.guest_expires_at,
        corporate_role_id: response.data.corporate_role_id,
        corporate_role: response.data.corporate_role,
        default_role_id: response.data.default_role_id,
        default_role: response.data.default_role,
        created_at: response.data.created_at || new Date().toISOString(),
        last_modified_at: response.data.last_modified_at || response.data.created_at || new Date().toISOString(),
        business_unit: response.data.business_unit || undefined
      };
      return [user];
    }
    
    console.log('❌ Could not extract users from response. Trying to find any array...');
    
    // Last resort: look for any array in the response
    const findAnyArray = (obj: any): any[] | null => {
      if (Array.isArray(obj)) {
        return obj;
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          const result = findAnyArray(obj[key]);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    const foundArray = findAnyArray(response);
    if (foundArray) {
      console.log('✅ Found array in response, length:', foundArray.length);
      const result = foundArray.map((item: any) => ({
        id: item.id?.toString() || '',
        username: item.username || '',
        email: item.email || '',
        name: item.name || '',
        family_name: item.family_name || '',
        job_title: item.job_title || item.title || '',
        department: item.department || item.specialty || '',
        phone_number: item.phone_number || item.phonenumber || '',
        business_unit_id: item.business_unit_id?.toString() || '',
        is_active: item.is_active || false,
        is_super_admin: item.is_super_admin || false,
        is_guest: item.is_guest || false,
        guest_first_access: item.guest_first_access,
        guest_expires_at: item.guest_expires_at,
        corporate_role_id: item.corporate_role_id,
        corporate_role: item.corporate_role,
        default_role_id: item.default_role_id,
        default_role: item.default_role,
        created_at: item.created_at || new Date().toISOString(),
        last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
        business_unit: item.business_unit || undefined
      }));
      return result;
    }
    
    console.log('❌ No array found in response. Response structure:');
    console.dir(response, { depth: 5 });
    
    return [];
  };

  // Check database connection
  const checkDatabaseConnection = async () => {
    try {
      console.log('🌐 Checking database connection...');
      const response = await SystemAPI.health();
      console.log('✅ Database health response:', response);
      
      const dbInfo = {
        connected: true,
        type: response.data?.environment === 'production' ? 'TiDB Cloud' : 'Local MySQL',
        database: response.data?.database?.name || 'unknown',
        host: response.data?.database?.host || 'unknown',
        environment: response.data?.environment || 'development'
      };
      
      console.log(`📊 Database info: ${dbInfo.type} (${dbInfo.database})`);
      setDatabaseInfo(dbInfo);
      return dbInfo;
    } catch (error) {
      console.error('❌ Database connection check failed:', error);
      const formattedError = ApiUtils.handleApiError(error);
      console.error('Formatted error:', formattedError);
      
      setDatabaseInfo({
        connected: false,
        type: 'Unknown',
        database: 'unknown',
        host: 'unknown',
        environment: 'unknown'
      });
      return null;
    }
  };

  // Fetch users, business units, and clients from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Starting data fetch...');
      
      // First check database connection
      const dbInfo = await checkDatabaseConnection();
      console.log('📡 Database connection status:', dbInfo?.connected);
      
      if (!dbInfo?.connected) {
        throw new Error('Cannot connect to database. Please check if backend server is running.');
      }
      
      console.log(`✅ Database connected: ${dbInfo.type} (${dbInfo.database})`);
      
      // Fetch users
      console.log('👥 Fetching users from API...');
      let usersData: User[] = [];
      
      try {
        const response = await UserAPI.getAll();
        console.log('📦 Raw API response:', response);
        
        usersData = extractUsers(response);
        console.log(`✅ Extracted ${usersData.length} users`);
        
      } catch (error: any) {
        console.error('❌ Error fetching users:', error);
        const formattedError = ApiUtils.handleApiError(error);
        console.error('Formatted error:', formattedError);
        throw new Error(`Failed to fetch users: ${formattedError.message}`);
      }
      
      // Fetch business units
      console.log('🏢 Fetching business units...');
      let businessUnitsData: BusinessUnit[] = [];
      try {
        const response = await BusinessUnitAPI.getAll();
        console.log('📦 Business Units API response:', response);
        
        // Extract business units from response
        if (Array.isArray(response)) {
          businessUnitsData = response.map((item: any) => ({
            id: item.id?.toString() || '',
            name: item.name || '',
            type: item.type || '',
            client_id: item.client_id || 0,
            description: item.description || ''
          }));
        } else if (response.data && Array.isArray(response.data)) {
          businessUnitsData = response.data.map((item: any) => ({
            id: item.id?.toString() || '',
            name: item.name || '',
            type: item.type || '',
            client_id: item.client_id || 0,
            description: item.description || ''
          }));
        } else if (response.data?.business_units && Array.isArray(response.data.business_units)) {
          businessUnitsData = response.data.business_units.map((item: any) => ({
            id: item.id?.toString() || '',
            name: item.name || '',
            type: item.type || '',
            client_id: item.client_id || 0,
            description: item.description || ''
          }));
        }
        
        setBusinessUnits(businessUnitsData);
        console.log(`✅ Extracted ${businessUnitsData.length} business units`);
        
      } catch (error: any) {
        console.warn('⚠️ Could not fetch business units:', error);
        businessUnitsData = [];
      }
      
      // Fetch clients separately
      console.log('🏢 Fetching clients...');
      let clientsData: Client[] = [];
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/clients`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          clientsData = data;
        } else if (data.data && Array.isArray(data.data)) {
          clientsData = data.data;
        } else if (data.clients && Array.isArray(data.clients)) {
          clientsData = data.clients;
        }
        
        setClients(clientsData);
        console.log(`✅ Extracted ${clientsData.length} clients`);
        
      } catch (error: any) {
        console.warn('⚠️ Could not fetch clients:', error);
        clientsData = [];
      }
      
      console.log(`🎯 Setting ${usersData.length} users to state`);
      setUsers(usersData);
      
    } catch (error: any) {
      console.error('❌ Error in fetchData:', error);
      const formattedError = ApiUtils.handleApiError(error);
      
      let errorMessage = formattedError.message || 'Failed to load data';
      
      if (formattedError.status === 0) {
        errorMessage = 'Network error: Cannot connect to server. Please ensure backend server is running.';
      } else if (formattedError.status === 404) {
        errorMessage = 'API endpoint not found. Please check if backend routes are properly configured.';
      } else if (formattedError.status === 500) {
        errorMessage = 'Server error. Please check backend logs for details.';
      }
      
      setError(errorMessage);
      setUsers([]);
      setBusinessUnits([]);
      setClients([]);
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 UsersList mounted, fetching data...');
    console.log('🌍 Environment:', import.meta.env.MODE);
    console.log('📡 API Base URL:', import.meta.env.VITE_API_BASE_URL);
    fetchData();
  }, [refreshTrigger]);

  // Manual refresh function
  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  // Handle delete user
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await UserAPI.delete(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || 'Failed to delete user');
    }
  };

  // Handle toggle user active status
  const handleToggleActive = async (user: User) => {
    try {
      await UserAPI.update(user.id, {
        is_active: !user.is_active
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating user:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || 'Failed to update user');
    }
  };

  // Handle toggle super admin status
  const handleToggleSuperAdmin = async (user: User) => {
    if (!window.confirm(`Are you sure you want to ${user.is_super_admin ? 'remove super admin status from' : 'make'} ${user.name} ${user.family_name} a super admin?`)) {
      return;
    }

    try {
      await UserAPI.update(user.id, {
        is_super_admin: !user.is_super_admin
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating super admin status:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || 'Failed to update super admin status');
    }
  };

  // Handle edit user
  const handleEdit = (user: User) => {
    console.log('Edit user:', user);
    navigate(`/users/edit/${user.id}`);
  };

  // Get business unit name by ID
  const getBusinessUnitName = (businessUnitId: string) => {
    const businessUnit = businessUnits.find(bu => bu.id === businessUnitId);
    return businessUnit ? businessUnit.name : 'Unknown';
  };

  // Get business unit details by ID
  const getBusinessUnitDetails = (businessUnitId: string) => {
    return businessUnits.find(bu => bu.id === businessUnitId);
  };

  // Get client name by client ID
  const getClientName = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    
    return users.filter(user => {
      const businessUnit = getBusinessUnitDetails(user.business_unit_id);
      const clientName = businessUnit ? getClientName(businessUnit.client_id) : '';
      const role = getRoleDisplay(user);
      
      return (
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.family_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (businessUnit?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [users, searchTerm, businessUnits, clients]);

  // Define table columns
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('username')}
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span title={row.getValue('email')} className="truncate max-w-[200px]">
            {row.getValue('email')}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'First Name',
      cell: ({ row }) => (
        <div>
          {row.getValue('name')}
        </div>
      ),
    },
    {
      accessorKey: 'family_name',
      header: 'Last Name',
      cell: ({ row }) => (
        <div>
          {row.getValue('family_name')}
        </div>
      ),
    },
    {
      accessorKey: 'job_title',
      header: 'Job Title',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.getValue('job_title')}
        </div>
      ),
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.getValue('department')}
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const user = row.original;
        const role = getRoleDisplay(user);
        return (
          <div className={`flex items-center gap-2 ${role.color}`}>
            {role.icon}
            <div className="flex flex-col">
              <span className="text-sm font-medium">{role.label}</span>
              {role.description && (
                <span className="text-xs text-muted-foreground">{role.description}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'business_unit_id',
      header: 'Business Unit',
      cell: ({ row }) => {
        const businessUnitId = row.getValue('business_unit_id') as string;
        const businessUnit = row.original.business_unit;
        
        if (businessUnit) {
          return (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{businessUnit.name}</span>
                {businessUnit.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {businessUnit.description}
                  </span>
                )}
              </div>
            </div>
          );
        }
        
        const localBusinessUnit = businessUnits.find(bu => bu.id === businessUnitId);
        if (localBusinessUnit) {
          return (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{localBusinessUnit.name}</span>
                {localBusinessUnit.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {localBusinessUnit.description}
                  </span>
                )}
              </div>
            </div>
          );
        }
        
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Unknown</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'phone_number',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.getValue('phone_number') as string;
        return (
          <div className="flex items-center gap-2">
            {phone && <Phone className="h-4 w-4 text-muted-foreground" />}
            <span>{phone || 'Not provided'}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean;
        return (
          <div className={`flex items-center gap-2 ${
            isActive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isActive ? <BadgeCheck className="h-4 w-4" /> : <BadgeX className="h-4 w-4" />}
            <span className="text-sm font-medium">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => (
        <div className="text-sm flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {new Date(row.getValue('created_at')).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        const role = getRoleDisplay(user);
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(user)}
              title="Edit user"
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleActive(user)}
              className={user.is_active ? 'text-orange-600' : 'text-green-600'}
              title={user.is_active ? 'Deactivate user' : 'Activate user'}
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleEdit(user)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                  {user.is_active ? (
                    <>
                      <BadgeX className="h-4 w-4 mr-2" />
                      Deactivate User
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      Activate User
                    </>
                  )}
                </DropdownMenuItem>
                
                {/* Super Admin toggle - only show for non-super-admin users to promote, or super admin to demote */}
                {!user.is_super_admin && role.level > 1 && (
                  <DropdownMenuItem 
                    onClick={() => handleToggleSuperAdmin(user)}
                    className="text-purple-600"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Make Super Admin
                  </DropdownMenuItem>
                )}
                {user.is_super_admin && (
                  <DropdownMenuItem 
                    onClick={() => handleToggleSuperAdmin(user)}
                    className="text-orange-600"
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    Remove Super Admin
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleDelete(user.id)}
                >
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Initialize table with pagination
  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Calculate role statistics
  const roleStats = useMemo(() => {
    const stats = {
      superAdmin: users.filter(u => u.is_super_admin).length,
      guest: users.filter(u => u.is_guest).length,
      corporate: users.filter(u => u.corporate_role).length,
      regular: users.filter(u => !u.is_super_admin && !u.is_guest && !u.corporate_role).length,
      total: users.length,
      active: users.filter(u => u.is_active).length
    };
    return stats;
  }, [users]);

  return (
    <div className="flex-1">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Users</h1>
              <p className="text-muted-foreground">
                Manage system users and their role-based permissions
              </p>
            </div>
            
            {/* Statistics Summary */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full">
                <Crown className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-600">{roleStats.superAdmin}</span>
                <span className="text-purple-500">Super Admins</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-600">{roleStats.guest}</span>
                <span className="text-orange-500">Guests</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-600">{roleStats.corporate}</span>
                <span className="text-blue-500">Corporate</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                <Users className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-600">{roleStats.regular}</span>
                <span className="text-green-500">Regular</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                <BadgeCheck className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-600">{roleStats.active}</span>
                <span className="text-gray-500">Active</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => navigate('/users/create')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create User
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowRawData(!showRawData)}
                className="flex items-center gap-2"
              >
                {showRawData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
              </Button>
            </div>
          </div>

          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users by name, email, username, title, department, role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[400px]"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              Showing {filteredUsers.length} of {users.length} users
              {table.getPageCount() > 1 && ` • Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-5 w-5 text-red-600 inline mr-2" />
              <span className="text-red-800 font-medium">{error}</span>
              <div className="mt-2 space-y-2">
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto py-6">
        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users List</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : 
               users.length === 0 ? 'No users found in database' :
               `Showing ${filteredUsers.length} of ${users.length} users`}
              {roleStats.superAdmin > 0 && ` • ${roleStats.superAdmin} Super Admin${roleStats.superAdmin > 1 ? 's' : ''}`}
              {roleStats.guest > 0 && ` • ${roleStats.guest} Guest${roleStats.guest > 1 ? 's' : ''}`}
              {roleStats.corporate > 0 && ` • ${roleStats.corporate} Corporate`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                <span>Loading users...</span>
                <div className="text-sm text-gray-500">
                  Database: {databaseInfo?.type} ({databaseInfo?.database})
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <User className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No Users Found in Database
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {databaseInfo?.connected 
                    ? 'Your database is connected but no users were found. Click "Create User" to add the first user.'
                    : 'Database connection issue. Please check your backend server.'}
                </p>
                {databaseInfo?.connected && (
                  <div className="mt-4 space-x-2">
                    <Button 
                      onClick={() => navigate('/users/create')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First User
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleRefresh}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowRawData(!showRawData)}
                    >
                      {showRawData ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
                    </Button>
                  </div>
                )}
              </div>
            ) : filteredUsers.length === 0 && searchTerm ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No matching users
                </h3>
                <p className="text-muted-foreground mt-2">
                  No users match your search for "{searchTerm}"
                </p>
                <Button 
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                >
                  Clear Search
                </Button>
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
                  Showing {table.getRowModel().rows.length} of {filteredUsers.length} users
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
                    {[10, 20, 30, 50].map(pageSize => (
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

export default UsersList;