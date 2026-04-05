import { useState, useEffect, useMemo } from 'react';
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
  Building,
  Edit,
  Globe,
  Phone,
  MapPin,
  BadgeCheck,
  BadgeX,
  Briefcase,
  Users,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
} from 'lucide-react';
import { CompanyAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Types
interface Company {
  id: string;
  slug: string;
  name: string;
  address?: string;
  phone?: string;
  url?: string;
  industry_sector: string;
  business_domain?: string;
  is_active: boolean;
  created_at: string;
  last_modified_at: string;
  description?: string;
  client_count?: number;
  project_count?: number;
}

interface DatabaseInfo {
  connected: boolean;
  type: 'local' | 'tidb' | 'unknown';
  environment: 'development' | 'production' | 'unknown';
  database: string;
  host: string;
  latency?: number;
  lastChecked?: string;
}

interface SystemHealthResponse {
  status: string;
  environment?: string;
  timestamp: string;
  database?: {
    name: string;
    host: string;
  };
  [key: string]: any;
}

interface DebugInfo {
  testingConnection?: boolean;
  connectionTest?: 'success' | 'failed' | 'error';
  connectionDetails?: DatabaseInfo;
  testTime?: string;
  fetchStarted?: string;
  fetchStatus?: 'in_progress' | 'completed' | 'failed';
  companiesCount?: number;
  fetchCompleted?: string;
  companiesSample?: Company[];
  apiEndpoint?: string;
  rawCompaniesResponse?: any;
  fetchError?: any;
  errorTime?: string;
  lastFailedResponse?: any;
  failedAt?: string;
  responseStructure?: string[];
  extractionSource?: string;
  [key: string]: any;
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo>({
    connected: false,
    type: 'unknown',
    environment: 'unknown',
    database: 'unknown',
    host: 'unknown'
  });
  
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [showRawData, setShowRawData] = useState(false);
  const [, setApiEndpointUsed] = useState<string>('');

  const extractCompanies = (response: any, source: string): Company[] => {
    console.log(`🔍 extractCompanies called from ${source} with response:`, response);
    
    if (!response) {
      console.log('❌ Response is null or undefined');
      return [];
    }
    
    console.log('📊 Full response structure:', JSON.stringify(response, null, 2));
    
    if (response.id && response.name) {
      console.log('✅ Found single company object');
      const company: Company = {
        id: response.id?.toString() || '',
        slug: response.slug || '',
        name: response.name || '',
        address: response.address || '',
        phone: response.phone || '',
        url: response.url || '',
        industry_sector: response.industry_sector || '',
        business_domain: response.business_domain || '',
        is_active: response.is_active !== undefined ? response.is_active : true,
        created_at: response.created_at || new Date().toISOString(),
        last_modified_at: response.last_modified_at || response.created_at || new Date().toISOString(),
        description: response.description || '',
        client_count: response.client_count || 0,
        project_count: response.project_count || 0
      };
      return [company];
    }
    
    if (Array.isArray(response)) {
      console.log('✅ Response is direct array, length:', response.length);
      const result = response.map((item: any) => ({
        id: item.id?.toString() || '',
        slug: item.slug || '',
        name: item.name || '',
        address: item.address || '',
        phone: item.phone || '',
        url: item.url || '',
        industry_sector: item.industry_sector || '',
        business_domain: item.business_domain || '',
        is_active: item.is_active !== undefined ? item.is_active : true,
        created_at: item.created_at || new Date().toISOString(),
        last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
        description: item.description || '',
        client_count: item.client_count || 0,
        project_count: item.project_count || 0
      }));
      console.log('✅ Mapped companies:', result);
      return result;
    }
    
    console.log('📊 Response structure keys:', Object.keys(response));
    
    const possiblePaths = [
      'companies',
      'data',
      'data.companies',
      'data.data',
      'result',
      'items',
      'records',
      'companiesList'
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
        console.log(`✅ Found companies at path "${path}", length:`, current.length);
        const result = current.map((item: any) => ({
          id: item.id?.toString() || '',
          slug: item.slug || '',
          name: item.name || '',
          address: item.address || '',
          phone: item.phone || '',
          url: item.url || '',
          industry_sector: item.industry_sector || '',
          business_domain: item.business_domain || '',
          is_active: item.is_active !== undefined ? item.is_active : true,
          created_at: item.created_at || new Date().toISOString(),
          last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
          description: item.description || '',
          client_count: item.client_count || 0,
          project_count: item.project_count || 0
        }));
        return result;
      }
    }
    
    if (response.data && response.data.id && response.data.name) {
      console.log('✅ Found single company in data object');
      const company: Company = {
        id: response.data.id?.toString() || '',
        slug: response.data.slug || '',
        name: response.data.name || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        url: response.data.url || '',
        industry_sector: response.data.industry_sector || '',
        business_domain: response.data.business_domain || '',
        is_active: response.data.is_active !== undefined ? response.data.is_active : true,
        created_at: response.data.created_at || new Date().toISOString(),
        last_modified_at: response.data.last_modified_at || response.data.created_at || new Date().toISOString(),
        description: response.data.description || '',
        client_count: response.data.client_count || 0,
        project_count: response.data.project_count || 0
      };
      return [company];
    }
    
    console.log('❌ Could not extract companies from response. Trying to find any array...');
    
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
        slug: item.slug || '',
        name: item.name || '',
        address: item.address || '',
        phone: item.phone || '',
        url: item.url || '',
        industry_sector: item.industry_sector || '',
        business_domain: item.business_domain || '',
        is_active: item.is_active !== undefined ? item.is_active : true,
        created_at: item.created_at || new Date().toISOString(),
        last_modified_at: item.last_modified_at || item.created_at || new Date().toISOString(),
        description: item.description || '',
        client_count: item.client_count || 0,
        project_count: item.project_count || 0
      }));
      return result;
    }
    
    console.log('❌ No array found in response. Response structure:');
    console.dir(response, { depth: 5 });
    
    setDebugInfo((prev: DebugInfo) => ({
      ...prev,
      lastFailedResponse: response,
      failedAt: new Date().toISOString(),
      responseStructure: Object.keys(response),
      extractionSource: source
    }));
    
    return [];
  };

  const checkDatabaseConnection = async (): Promise<DatabaseInfo> => {
    const startTime = Date.now();
    try {
      console.log('🌐 Checking database connection...');
      const response = await SystemAPI.health();
      const healthData = response.data as SystemHealthResponse;
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      console.log('✅ Database health response:', healthData);
      
      let dbType: 'local' | 'tidb' | 'unknown' = 'unknown';
      let environment: 'development' | 'production' | 'unknown' = 'unknown';
      
      if (healthData.environment === 'production') {
        environment = 'production';
        dbType = 'tidb';
      } else if (healthData.environment === 'development') {
        environment = 'development';
        dbType = 'local';
      } else if (import.meta.env.MODE === 'development') {
        environment = 'development';
        dbType = 'local';
      } else if (import.meta.env.MODE === 'production') {
        environment = 'production';
        dbType = 'tidb';
      }
      
      const dbName = healthData.database?.name || 'unknown';
      const dbHost = healthData.database?.host || 'unknown';
      
      const dbInfo: DatabaseInfo = {
        connected: true,
        type: dbType,
        environment,
        database: dbName,
        host: dbHost,
        latency,
        lastChecked: new Date().toISOString()
      };
      
      console.log(`📊 Database info: ${dbType} (${environment}) - ${dbName} @ ${dbHost}`);
      console.log(`⏱️  Connection latency: ${latency}ms`);
      
      setDatabaseInfo(dbInfo);
      return dbInfo;
    } catch (error) {
      console.error('❌ Database connection check failed:', error);
      
      let environment: 'development' | 'production' | 'unknown' = 'unknown';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        environment = 'development';
      } else {
        environment = 'production';
      }
      
      const dbInfo: DatabaseInfo = {
        connected: false,
        type: 'unknown',
        environment,
        database: 'unknown',
        host: 'unknown',
        lastChecked: new Date().toISOString()
      };
      
      setDatabaseInfo(dbInfo);
      return dbInfo;
    }
  };

  const testDatabaseConnection = async () => {
    console.log('🧪 Testing database connection...');
    setDebugInfo((prev: DebugInfo) => ({ ...prev, testingConnection: true }));
    
    try {
      const dbInfo = await checkDatabaseConnection();
      
      if (dbInfo.connected) {
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          connectionTest: 'success',
          connectionDetails: dbInfo,
          testTime: new Date().toISOString()
        }));
        
        alert(`✅ Database connection successful!\n\nType: ${dbInfo.type}\nEnvironment: ${dbInfo.environment}\nDatabase: ${dbInfo.database}\nHost: ${dbInfo.host}\nLatency: ${dbInfo.latency}ms`);
      } else {
        setDebugInfo((prev: DebugInfo) => ({
          ...prev,
          connectionTest: 'failed',
          connectionDetails: dbInfo,
          testTime: new Date().toISOString()
        }));
        
        alert(`❌ Database connection failed. Environment: ${dbInfo.environment}\nPlease check:\n1. Backend server is running\n2. Database service is started\n3. Network connection is available`);
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        connectionTest: 'error',
        testTime: new Date().toISOString()
      }));
      
      alert('❌ Connection test encountered an error. Check console for details.');
    } finally {
      setDebugInfo((prev: DebugInfo) => ({ ...prev, testingConnection: false }));
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo((prev: DebugInfo) => ({ 
        ...prev, 
        fetchStarted: new Date().toISOString(),
        fetchStatus: 'in_progress'
      }));
      
      console.log('🚀 Starting data fetch...');
      console.log('🌍 Current environment:', import.meta.env.MODE);
      console.log('📡 API Base URL:', import.meta.env.VITE_API_BASE_URL);
      
      const dbInfo = await checkDatabaseConnection();
      console.log('📡 Database connection status:', dbInfo.connected ? 'Connected' : 'Disconnected');
      
      if (!dbInfo.connected) {
        const errorMsg = `Cannot connect to ${dbInfo.environment === 'production' ? 'production TiDB' : 'local database'}. Please check if backend server is running.`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`✅ Database connected: ${dbInfo.type} (${dbInfo.environment}) - ${dbInfo.database}`);
      
      console.log('🔍 Fetching companies from API...');
      let companiesData: Company[] = [];
      let rawCompaniesResponse: any = null;
      let endpointUsed = '';
      
      try {
        const endpoints = [
          {
            name: 'CompanyAPI.getAll()',
            method: async () => await CompanyAPI.getAll(),
            description: 'Primary API method'
          },
          {
            name: '/api/companies',
            method: async () => {
              const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/companies`);
              return await response.json();
            },
            description: 'Direct REST endpoint'
          },
          {
            name: '/api/companies?limit=100',
            method: async () => {
              const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/companies?limit=100`);
              return await response.json();
            },
            description: 'With limit parameter'
          },
          {
            name: '/api/companies/all',
            method: async () => {
              const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/companies/all`);
              return await response.json();
            },
            description: 'All endpoint'
          }
        ];
        
        for (const endpoint of endpoints) {
          try {
            console.log(`🔄 Trying endpoint: ${endpoint.name} (${endpoint.description})`);
            rawCompaniesResponse = await endpoint.method();
            endpointUsed = endpoint.name;
            console.log(`✅ ${endpoint.name} response received`);
            
            companiesData = extractCompanies(rawCompaniesResponse, endpoint.name);
            console.log(`✅ Extracted ${companiesData.length} companies from ${endpoint.name}`);
            
            if (companiesData.length > 0) {
              console.log(`🎯 Successfully fetched ${companiesData.length} companies using ${endpoint.name}`);
              break;
            } else {
              console.log(`⚠️ No companies extracted from ${endpoint.name}, trying next endpoint...`);
            }
          } catch (endpointError) {
            console.log(`⚠️ ${endpoint.name} failed:`, endpointError);
            continue;
          }
        }
        
        if (companiesData.length === 0) {
          console.log('❌ All endpoints failed to return companies');
          throw new Error('No companies found from any API endpoint');
        }
        
      } catch (error: any) {
        console.error('❌ Error fetching companies:', error);
        const formattedError = ApiUtils.handleApiError(error);
        throw new Error(`Failed to fetch companies: ${formattedError.message}`);
      }
      
      console.log(`🎯 Setting ${companiesData.length} companies to state`);
      setCompanies(companiesData);
      setApiEndpointUsed(endpointUsed);
      
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        companiesCount: companiesData.length,
        fetchCompleted: new Date().toISOString(),
        fetchStatus: 'completed',
        companiesSample: companiesData.slice(0, 3),
        apiEndpoint: endpointUsed,
        rawCompaniesResponse: rawCompaniesResponse
      }));
      
    } catch (error: any) {
      console.error('❌ Error in fetchData:', error);
      
      let errorMessage = 'Failed to load data';
      
      if (error.status === 0) {
        errorMessage = 'Network error: Cannot connect to server. Please ensure backend server is running.';
      } else if (error.status === 404) {
        errorMessage = 'API endpoint not found. Please check if backend routes are properly configured.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please check backend logs for details.';
      }
      
      if (databaseInfo.environment === 'production') {
        errorMessage += '\n\nEnvironment: Production (TiDB Cloud)';
      } else if (databaseInfo.environment === 'development') {
        errorMessage += '\n\nEnvironment: Development (Local Database)';
      }
      
      setError(errorMessage);
      setCompanies([]);
      
      setDebugInfo((prev: DebugInfo) => ({
        ...prev,
        fetchError: error,
        errorTime: new Date().toISOString(),
        fetchStatus: 'failed'
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 CompaniesList mounted, fetching data...');
    console.log('🌍 Environment:', import.meta.env.MODE);
    console.log('📡 API Base URL:', import.meta.env.VITE_API_BASE_URL);
    fetchData();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return companies;
    
    return companies.filter(company => 
      company.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.industry_sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.business_domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.url?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [companies, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      return;
    }

    try {
      await CompanyAPI.delete(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error deleting company:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || 'Failed to delete company');
    }
  };

  const handleToggleActive = async (company: Company) => {
    try {
      await CompanyAPI.toggleStatus(company.id);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating company:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || 'Failed to update company');
    }
  };

  const handleEdit = (company: Company) => {
    console.log('Edit company:', company);
    window.location.href = `/companies/${company.id}/edit`;
  };

  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue('slug')}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Company Name',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('name')}
        </div>
      ),
    },
    {
      accessorKey: 'industry_sector',
      header: 'Industry',
      cell: ({ row }) => {
        const industry = row.getValue('industry_sector') as string;
        const getIndustryBadgeColor = (industry: string) => {
          switch (industry.toLowerCase()) {
            case 'technology':
              return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'finance':
              return 'bg-green-100 text-green-800 border-green-200';
            case 'manufacturing':
              return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'healthcare':
              return 'bg-red-100 text-red-800 border-red-200';
            default:
              return 'bg-gray-100 text-gray-800 border-gray-200';
          }
        };
        
        return (
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getIndustryBadgeColor(industry)}`}>
              {industry}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'business_domain',
      header: 'Business Domain',
      cell: ({ row }) => {
        const businessDomain = row.getValue('business_domain') as string;
        return (
          <div className="max-w-[200px] truncate" title={businessDomain}>
            {businessDomain || <span className="text-gray-400 italic">Not specified</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => {
        const address = row.getValue('address') as string;
        return (
          <div className="flex items-start gap-2 max-w-[200px] truncate" title={address}>
            {address && <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            <span>{address || <span className="text-gray-400 italic">Not provided</span>}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string;
        return (
          <div className="flex items-center gap-2">
            {phone && <Phone className="h-4 w-4 text-muted-foreground" />}
            <span>{phone || <span className="text-gray-400 italic">Not provided</span>}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'url',
      header: 'Website',
      cell: ({ row }) => {
        const url = row.getValue('url') as string;
        return (
          <div className="flex items-center gap-2 max-w-[150px] truncate" title={url}>
            {url && (
              <>
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={url.startsWith('http') ? url : `https://${url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {url.replace(/^https?:\/\//, '')}
                </a>
              </>
            )}
            {!url && <span className="text-gray-400 italic">Not provided</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'client_count',
      header: 'Clients',
      cell: ({ row }) => {
        const clientCount = row.getValue('client_count') as number;
        return (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className={`font-medium ${clientCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {clientCount || 0}
            </span>
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
            {isActive ? (
              <BadgeCheck className="h-4 w-4" />
            ) : (
              <BadgeX className="h-4 w-4" />
            )}
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
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {new Date(row.getValue('created_at')).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const company = row.original;
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(company)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(company)}>
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleActive(company)}>
                  {company.is_active ? 'Deactivate Company' : 'Activate Company'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleDelete(company.id)}
                >
                  Delete Company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredCompanies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  return (
    <div className="flex-1">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Companies</h1>
              <p className="text-muted-foreground">
                Manage all companies in the system
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => window.location.href = '/companies/create'}
                className="flex items-center gap-2"
                disabled={!databaseInfo.connected}
              >
                <Plus className="h-4 w-4" />
                Create Company
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

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-6">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search companies by name, slug, industry, domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[400px]"
                disabled={!databaseInfo.connected}
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              Showing {filteredCompanies.length} of {companies.length} companies
              {table.getPageCount() > 1 && ` • Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-red-800 font-medium mb-2">Unable to load companies</div>
                  <div className="text-red-700 text-sm whitespace-pre-line">{error}</div>
                  <div className="mt-3 space-x-2">
                    <Button onClick={handleRefresh} variant="outline" size="sm">
                      Try Again
                    </Button>
                    <Button onClick={testDatabaseConnection} variant="outline" size="sm">
                      Test Database
                    </Button>
                    <Button 
                      onClick={() => setShowRawData(!showRawData)} 
                      variant="outline" 
                      size="sm"
                    >
                      {showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Companies List</CardTitle>
            <CardDescription>
              {!databaseInfo.connected ? (
                <span className="text-red-600">Database disconnected - Cannot load companies</span>
              ) : loading ? 'Loading...' : 
               companies.length === 0 ? 'No companies found in database' :
               `Showing ${filteredCompanies.length} of ${companies.length} companies from ${databaseInfo.type === 'tidb' ? 'TiDB Cloud' : 'local database'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!databaseInfo.connected ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-16 w-16 text-red-300" />
                <h3 className="mt-4 text-lg font-semibold text-red-600">
                  Database Connection Required
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Cannot connect to the database. Please ensure your backend server is running.
                </p>
                <div className="mt-4 space-x-2">
                  <Button 
                    onClick={testDatabaseConnection}
                    variant="default"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Test Database Connection
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="flex flex-col justify-center items-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                <span>Loading companies from {databaseInfo.type === 'tidb' ? 'TiDB Cloud' : 'local database'}...</span>
                <div className="text-sm text-gray-500">
                  Database: {databaseInfo.type} ({databaseInfo.database})
                  {databaseInfo.latency && ` • Latency: ${databaseInfo.latency}ms`}
                </div>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <Building className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No Companies Found in Database
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Your {databaseInfo.type === 'tidb' ? 'TiDB Cloud' : 'local'} database is connected but no companies were found. 
                  This could mean: 1) The companies table is empty, 2) API response format is different than expected, or 3) There are permission issues.
                </p>
                <div className="mt-4 space-x-2">
                  <Button 
                    onClick={() => window.location.href = '/companies/create'}
                    disabled={!databaseInfo.connected}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Company
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
              </div>
            ) : filteredCompanies.length === 0 && searchTerm ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No matching companies
                </h3>
                <p className="text-muted-foreground mt-2">
                  No companies match your search for "{searchTerm}"
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

            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {table.getRowModel().rows.length} of {filteredCompanies.length} companies
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

        {showRawData && debugInfo.rawCompaniesResponse && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Raw Companies API Response
              </CardTitle>
              <CardDescription>
                Showing raw response from {debugInfo.apiEndpoint || 'unknown endpoint'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-sm">
                  {JSON.stringify(debugInfo.rawCompaniesResponse, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default CompaniesList;