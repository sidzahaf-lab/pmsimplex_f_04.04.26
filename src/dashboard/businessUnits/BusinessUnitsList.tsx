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
  Users,
  Calendar,
  Database,
  AlertCircle,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Trash2,
  FileText,
  Clock,
} from 'lucide-react';
import { BusinessUnitAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Types
interface BusinessUnit {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  user_count?: number;
}

interface DatabaseInfo {
  connected: boolean;
  type: string;
  database: string;
  host: string;
  environment: string;
}

export function BusinessUnitList() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [showRawData, setShowRawData] = useState(false);

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Helper function to extract business units from API response
  const extractBusinessUnits = (response: any): BusinessUnit[] => {
    console.log('🔍 extractBusinessUnits called with response:', response);
    
    if (!response) {
      console.log('ℹ️ Response is null or undefined - returning empty array');
      return [];
    }
    
    // CASE 1: Your specific API response format - { business_units: [...], total: X, page: Y, totalPages: Z }
    if (response.business_units !== undefined) {
      console.log('✅ Found business_units property in response');
      
      if (Array.isArray(response.business_units)) {
        console.log(`✅ business_units is an array with length: ${response.business_units.length}`);
        const result = response.business_units.map((item: any) => ({
          id: item.id?.toString() || '',
          name: item.name || '',
          description: item.description || null,
          is_active: item.is_active !== undefined ? item.is_active : true,
          created_at: item.created_at || new Date().toISOString()
        }));
        console.log(`✅ Extracted ${result.length} business units from response.business_units`);
        return result;
      }
    }
    
    // CASE 2: If response is already an array
    if (Array.isArray(response)) {
      console.log('✅ Response is direct array, length:', response.length);
      const result = response.map((item: any) => ({
        id: item.id?.toString() || '',
        name: item.name || '',
        description: item.description || null,
        is_active: item.is_active !== undefined ? item.is_active : true,
        created_at: item.created_at || new Date().toISOString()
      }));
      return result;
    }
    
    // CASE 3: Check if it's a single business unit object
    if (response.id && response.name) {
      console.log('✅ Found single business unit object');
      const businessUnit: BusinessUnit = {
        id: response.id?.toString() || '',
        name: response.name || '',
        description: response.description || null,
        is_active: response.is_active !== undefined ? response.is_active : true,
        created_at: response.created_at || new Date().toISOString()
      };
      return [businessUnit];
    }
    
    // CASE 4: Check if response has data property
    if (response.data) {
      console.log('📊 Found data property in response');
      
      if (response.data.business_units && Array.isArray(response.data.business_units)) {
        console.log(`✅ Found data.business_units array with length: ${response.data.business_units.length}`);
        const result = response.data.business_units.map((item: any) => ({
          id: item.id?.toString() || '',
          name: item.name || '',
          description: item.description || null,
          is_active: item.is_active !== undefined ? item.is_active : true,
          created_at: item.created_at || new Date().toISOString()
        }));
        return result;
      }
      
      if (Array.isArray(response.data)) {
        console.log(`✅ response.data is an array with length: ${response.data.length}`);
        const result = response.data.map((item: any) => ({
          id: item.id?.toString() || '',
          name: item.name || '',
          description: item.description || null,
          is_active: item.is_active !== undefined ? item.is_active : true,
          created_at: item.created_at || new Date().toISOString()
        }));
        return result;
      }
    }
    
    // If we get here, no business units found - this is NORMAL when database is empty
    console.log('ℹ️ No business units found in response. This is normal if database is empty.');
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

  // Toggle business unit status (activate/deactivate)
  const handleToggleStatus = async (businessUnit: BusinessUnit) => {
    const newStatus = !businessUnit.is_active;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${action} "${businessUnit.name}"?`)) {
      return;
    }
    
    setActionLoading(businessUnit.id);
    setSuccessMessage(null);
    setError(null);
    
    try {
      await BusinessUnitAPI.update(businessUnit.id, {
        is_active: newStatus
      });
      
      // Update local state
      setBusinessUnits(prev => prev.map(bu => 
        bu.id === businessUnit.id 
          ? { ...bu, is_active: newStatus }
          : bu
      ));
      
      setSuccessMessage(`Business unit ${action}d successfully.`);
      
    } catch (error: any) {
      console.error(`Failed to ${action} business unit:`, error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || `Failed to ${action} business unit.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete business unit
  const handleDelete = async (businessUnit: BusinessUnit) => {
    if (!window.confirm(`Are you sure you want to delete "${businessUnit.name}"? This action cannot be undone.`)) {
      return;
    }
    
    setActionLoading(businessUnit.id);
    setSuccessMessage(null);
    setError(null);
    
    try {
      await BusinessUnitAPI.delete(businessUnit.id);
      
      // Update local state
      setBusinessUnits(prev => prev.filter(bu => bu.id !== businessUnit.id));
      
      setSuccessMessage("Business unit deleted successfully.");
      
    } catch (error: any) {
      console.error('Failed to delete business unit:', error);
      const formattedError = ApiUtils.handleApiError(error);
      setError(formattedError.message || "Failed to delete business unit.");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle edit business unit
  const handleEdit = (businessUnit: BusinessUnit) => {
    console.log('Edit business unit:', businessUnit);
    window.location.href = `/business-units/edit/${businessUnit.id}`;
  };

  // Fetch business units from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null); // IMPORTANT: Clear any previous errors
      setSuccessMessage(null);
      
      console.log('🚀 Starting data fetch...');
      
      // First check database connection
      const dbInfo = await checkDatabaseConnection();
      console.log('📡 Database connection status:', dbInfo?.connected);
      
      if (!dbInfo?.connected) {
        throw new Error('Cannot connect to database. Please check if backend server is running.');
      }
      
      console.log(`✅ Database connected: ${dbInfo.type} (${dbInfo.database})`);
      
      // Fetch business units
      console.log('🏢 Fetching business units from API...');
      let businessUnitsData: BusinessUnit[] = [];
      
      try {
        const response = await BusinessUnitAPI.getAll();
        console.log('📦 Raw API response:', response);
        
        // The response might be in response.data or directly in response
        const rawData = response.data || response;
        businessUnitsData = extractBusinessUnits(rawData);
        console.log(`✅ Extracted ${businessUnitsData.length} business units`);
        
        // IMPORTANT: Empty array is NOT an error
        // Only set error if there's a real problem
        if (businessUnitsData.length === 0) {
          console.log('ℹ️ No business units found - this is normal when database is empty');
          // DO NOT set error here - empty is normal
        }
        
      } catch (error: any) {
        console.error('❌ Error fetching business units:', error);
        const formattedError = ApiUtils.handleApiError(error);
        
        // Only throw for real connection/server errors
        if (formattedError.status === 0 || formattedError.status === 404 || formattedError.status === 500) {
          throw new Error(`Failed to fetch business units: ${formattedError.message}`);
        }
        
        // For other errors, just log and continue with empty array
        console.log('⚠️ Non-critical error, continuing with empty array');
        businessUnitsData = [];
      }
      
      console.log(`🎯 Setting ${businessUnitsData.length} business units to state`);
      setBusinessUnits(businessUnitsData);
      
    } catch (error: any) {
      console.error('❌ Critical error in fetchData:', error);
      setError(error.message || 'Failed to load business units');
      setBusinessUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 BusinessUnitList mounted, fetching data...');
    fetchData();
  }, [refreshTrigger]);

  // Manual refresh function
  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  // Filter business units based on search term
  const filteredBusinessUnits = useMemo(() => {
    if (!searchTerm) return businessUnits;
    
    return businessUnits.filter(businessUnit => 
      businessUnit.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      businessUnit.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (businessUnit.is_active ? 'active' : 'inactive').includes(searchTerm.toLowerCase())
    );
  }, [businessUnits, searchTerm]);

  // Define table columns
  const columns: ColumnDef<BusinessUnit>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="font-medium flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {row.getValue('name') || <span className="text-gray-400 italic">No name</span>}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[300px]">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            {row.getValue('description') || <span className="text-gray-400 italic">No description</span>}
          </span>
        </div>
      ),
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
              <Power className="h-4 w-4" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'user_count',
      header: 'Users',
      cell: ({ row }) => {
        const userCount = row.getValue('user_count') as number || 0;
        return (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className={`font-medium ${userCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {userCount}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => {
        const date = row.getValue('created_at') as string;
        return (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {date ? new Date(date).toLocaleDateString() : 'N/A'}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const businessUnit = row.original;
        const isLoading = actionLoading === businessUnit.id;
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(businessUnit)}
              disabled={isLoading}
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleStatus(businessUnit)}
              className={businessUnit.is_active ? 'text-orange-600' : 'text-green-600'}
              disabled={isLoading}
            >
              {businessUnit.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(businessUnit)}>
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleStatus(businessUnit)}>
                  {businessUnit.is_active ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleDelete(businessUnit)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Business Unit
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
    data: filteredBusinessUnits,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="flex-1">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto py-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Business Units</h1>
              <p className="text-muted-foreground">
                Manage organizational business units and departments
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => window.location.href = '/business-units/create'}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Business Unit
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
                placeholder="Search business units by name, description, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[400px]"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              Showing {filteredBusinessUnits.length} of {businessUnits.length} business units
              {table.getPageCount() > 1 && ` • Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-1">
                  <div className="text-green-800 font-medium">{successMessage}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message - Only shown for REAL errors, NOT for empty data */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-red-800 font-medium mb-2">Unable to load business units</div>
                  <div className="text-red-700 text-sm whitespace-pre-line">{error}</div>
                  <div className="mt-3 space-x-2">
                    <Button onClick={handleRefresh} variant="outline" size="sm">
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto py-6">
        {/* Business Units Table */}
        <Card>
          <CardHeader>
            <CardTitle>Business Units List</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : 
               businessUnits.length === 0 && !error ? 'No business units found in database' :
               businessUnits.length === 0 && error ? 'Error loading data' :
               `Showing ${filteredBusinessUnits.length} of ${businessUnits.length} business units`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                <span>Loading business units...</span>
                <div className="text-sm text-gray-500">
                  Database: {databaseInfo?.type} ({databaseInfo?.database})
                </div>
              </div>
            ) : businessUnits.length === 0 && !error ? (
              <div className="text-center py-8">
                <Building className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No Business Units Found
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Your database is connected but no business units were found. 
                  Click the "Create Business Unit" button to add your first business unit.
                </p>
                <div className="mt-4 space-x-2">
                  <Button 
                    onClick={() => window.location.href = '/business-units/create'}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Business Unit
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            ) : filteredBusinessUnits.length === 0 && searchTerm ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  No matching business units
                </h3>
                <p className="text-muted-foreground mt-2">
                  No business units match your search for "{searchTerm}"
                </p>
                <Button 
                  variant="outline"
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </div>
            ) : businessUnits.length > 0 ? (
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
            ) : null}

            {/* Pagination Controls */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {table.getRowModel().rows.length} of {filteredBusinessUnits.length} business units
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

        {/* Raw Data Debug Card */}
        {showRawData && (
          <div className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm">
                    {JSON.stringify(databaseInfo, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Business Units Data
                </CardTitle>
                <CardDescription>
                  Current state: {businessUnits.length} business units loaded
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-sm">
                    {JSON.stringify(businessUnits, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default BusinessUnitList;