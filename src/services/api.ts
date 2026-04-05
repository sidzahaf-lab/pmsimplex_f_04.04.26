// frontend/src/services/api.ts
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any = null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Environment-based API configuration
const getApiBaseUrl = (): string => {
  // Use environment variable first, then fallback
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback based on environment
  if (import.meta.env.MODE === 'production') {
return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';  }
  
  // Development default
  return 'http://localhost:3001/api';
};

const API_BASE: string = getApiBaseUrl();

console.log(`🌍 API Base URL: ${API_BASE}`);
console.log(`🚀 Environment: ${import.meta.env.MODE}`);

// Axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased timeout for Render
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Get token from localStorage
    const token = localStorage.getItem('authToken') || 
                   localStorage.getItem('token') ||
                   sessionStorage.getItem('authToken');
    
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add custom headers if needed
    config.headers = config.headers || {};
    config.headers['X-Application'] = 'PM-Simplexe-Frontend';
    config.headers['X-Environment'] = import.meta.env.MODE;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    // You can transform response data here
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle errors globally
    if (error.response) {
      // Server responded with error
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });
      
      // Handle specific status codes
      if (error.response.status === 401 && !originalRequest._retry) {
        // Check if it's a token expired error
        const isTokenExpired = error.response?.data?.code === 'TOKEN_EXPIRED';
        
        if (isTokenExpired) {
          originalRequest._retry = true;
          
          if (isRefreshing) {
            // If already refreshing, add to queue
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then(token => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return apiClient(originalRequest);
              })
              .catch(err => Promise.reject(err));
          }
          
          isRefreshing = true;
          
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }
            
            const response = await axios.post(`${API_BASE}/auth/refresh-token`, {
              refreshToken
            });
            
            const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            
            // Store new tokens
            localStorage.setItem('authToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            
            // Update authorization header
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            // Process queued requests
            processQueue(null, accessToken);
            
            return apiClient(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            processQueue(refreshError, null);
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            
            // Redirect to login page
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        } else {
          // Other 401 errors - clear tokens and redirect
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
      
      if (error.response.status === 403) {
        // Forbidden
        console.error('Access forbidden');
      }
      
      if (error.response.status === 404) {
        // Not found
        console.error('Resource not found');
      }
      
      if (error.response.status >= 500) {
        // Server error
        console.error('Server error occurred');
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received:', error.request);
      
      // Check if it's a network error
      if (!navigator.onLine) {
        console.error('Network is offline');
      }
    } else {
      // Something happened in setting up the request
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper function for API calls
export const apiHelper = {
  // Generic CRUD operations
  get: (url: string, params: any = {}): Promise<AxiosResponse> => 
    apiClient.get(url, { params }),
  post: (url: string, data: any = {}): Promise<AxiosResponse> => 
    apiClient.post(url, data),
  put: (url: string, data: any = {}): Promise<AxiosResponse> => 
    apiClient.put(url, data),
  patch: (url: string, data: any = {}): Promise<AxiosResponse> => 
    apiClient.patch(url, data),
  delete: (url: string): Promise<AxiosResponse> => 
    apiClient.delete(url),
  
  // Upload files
  upload: (url: string, formData: FormData, onUploadProgress?: (progressEvent: any) => void): Promise<AxiosResponse> => {
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },
  
  // Download files
  download: (url: string, params: any = {}): Promise<AxiosResponse> => {
    return apiClient.get(url, {
      params,
      responseType: 'blob',
    });
  },
};

// Auth API
export const AuthAPI = {
  login: (email: string, password: string): Promise<AxiosResponse> => 
    apiClient.post('/auth/login', { email, password }),
  
  refreshToken: (refreshToken: string): Promise<AxiosResponse> =>
    apiClient.post('/auth/refresh-token', { refreshToken }),
  
  logout: (refreshToken: string): Promise<AxiosResponse> =>
    apiClient.post('/auth/logout', { refreshToken }),
  
  logoutAll: (): Promise<AxiosResponse> =>
    apiClient.post('/auth/logout-all'),
  
  getMe: (): Promise<AxiosResponse> => 
    apiClient.get('/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string): Promise<AxiosResponse> =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};

// Clients API
export const ClientAPI = {
  getAll: (): Promise<AxiosResponse> => apiClient.get('/clients'),
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/clients/${id}`),
  getBySlug: (slug: string): Promise<AxiosResponse> => 
    apiClient.get(`/clients/slug/${slug}`),
  getMonorepoClient: (): Promise<AxiosResponse> => 
    apiClient.get('/clients/monorepo'),
  getWithBusinessUnits: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/clients/${id}/with-business-units`),
  getBusinessUnitsCount: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/clients/${id}/business-units-count`),
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/clients', data),
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/clients/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/clients/${id}`),
  checkSlug: (slug: string): Promise<AxiosResponse> => 
    apiClient.get('/clients/check-slug', { params: { slug } }),
  checkName: (name: string): Promise<AxiosResponse> => 
    apiClient.get('/clients/check-name', { params: { name } }),
};

// Users API - EXTENDED
export const UserAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/users', { params }),
  
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/users/${id}`),
  
  getByBusinessUnit: (businessUnitId: string | number, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/users/business-unit/${businessUnitId}`, { params }),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/users', data),
  
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/users/${id}`, data),
  
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/users/${id}`),
  
  login: (credentials: any): Promise<AxiosResponse> => 
    apiClient.post('/users/login', credentials),
  
  register: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/users/register', data),
  
  logout: (): Promise<AxiosResponse> => 
    apiClient.post('/users/logout'),
  
  profile: (): Promise<AxiosResponse> => 
    apiClient.get('/users/profile'),
  
  updateProfile: (data: any): Promise<AxiosResponse> => 
    apiClient.put('/users/profile', data),
  
  // Additional methods
  checkUsername: (username: string): Promise<AxiosResponse> => 
    apiClient.get(`/users/check-username/${username}`),
  
  checkEmail: (email: string): Promise<AxiosResponse> => 
    apiClient.get(`/users/check-email/${email}`),
  
  toggleStatus: (id: string | number): Promise<AxiosResponse> => 
    apiClient.patch(`/users/${id}/toggle-status`),
  
  deactivate: (id: string | number): Promise<AxiosResponse> => 
    apiClient.patch(`/users/${id}/deactivate`),
  
  activate: (id: string | number): Promise<AxiosResponse> => 
    apiClient.patch(`/users/${id}/activate`),
};

// Business Units API - EXTENDED
export const BusinessUnitAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/business-units', { params }),
  
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/business-units/${id}`),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/business-units', data),
  
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/business-units/${id}`, data),
  
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/business-units/${id}`),
  
  getByClient: (clientId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/business-units/client/${clientId}`),
  
  checkName: (name: string): Promise<AxiosResponse> => 
    apiClient.get('/business-units/check-name', { params: { name } }),
  
  // Additional methods
  toggleStatus: (id: string | number): Promise<AxiosResponse> => 
    apiClient.patch(`/business-units/${id}/toggle-status`),
  
  getWithProjects: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/business-units/${id}/with-projects`),
  
  getUsers: (id: string | number, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/business-units/${id}/users`, { params }),
};

// Projects API
export const ProjectAPI = {
  // Basic CRUD operations
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/projects', { params }),
  
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/projects/${id}`),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/projects', data),
  
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/projects/${id}`, data),
  
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/projects/${id}`),
  
  getByBusinessUnit: (businessUnitId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/projects/business-unit/${businessUnitId}`),
  
  // Additional endpoints from your TSX files
  getWithBusinessUnit: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/projects/with-business-unit', { params }),
  
  updateStatus: (id: string | number, status: string): Promise<AxiosResponse> => 
    apiClient.patch(`/projects/${id}/status`, { status }),
  
  checkCode: (code: string): Promise<AxiosResponse> => 
    apiClient.get('/projects/check-code', { params: { code } }),
  
  getMetricsSummary: (): Promise<AxiosResponse> => 
    apiClient.get('/projects/metrics/summary'),
  
  // Additional methods
  updateHealthStatus: (id: string | number, healthStatus: string): Promise<AxiosResponse> => 
    apiClient.patch(`/projects/${id}/health-status`, { health_status: healthStatus }),
  
  updatePhase: (id: string | number, phase: string): Promise<AxiosResponse> => 
    apiClient.patch(`/projects/${id}/phase`, { current_phase: phase }),
  
  getUpcoming: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/projects/upcoming', { params }),
  
  getNearingCompletion: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/projects/nearing-completion', { params }),
  
  getDelayed: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/projects/delayed', { params }),
};

// ============================================
// TEAM API - COMPLETE
// ============================================
export const TeamAPI = {
  // Get all team assignments
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/teams', { params }),
  
  // Get team by ID
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/teams/${id}`),
  
  // Create team assignment
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/teams', data),
  
  // Update team assignment
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/teams/${id}`, data),
  
  // Delete team assignment (hard delete)
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/teams/${id}`),
  
  // Deactivate team assignment
  deactivate: (id: string): Promise<AxiosResponse> => 
    apiClient.patch(`/teams/${id}/deactivate`),
  
  // Activate team assignment
  activate: (id: string): Promise<AxiosResponse> => 
    apiClient.patch(`/teams/${id}/activate`),
  
  // Get teams by user
  getByUser: (userId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/teams/user/${userId}`, { params }),
  
  // Get teams by business unit
  getByBusinessUnit: (businessUnitId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/teams/business-unit/${businessUnitId}`, { params }),
  
  // Get teams by project
  getByProject: (projectId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/teams/project/${projectId}`, { params }),
  
  // Get teams by role
  getByRole: (roleId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/teams/role/${roleId}`, { params }),
  
  // Get active teams by user
  getActiveByUser: (userId: string): Promise<AxiosResponse> => 
    apiClient.get(`/teams/user/${userId}/active`),
  
  // ✅ Get user role summary for consistency check
  getUserRoleSummary: (userId: string, businessUnitId: string): Promise<AxiosResponse> => 
    apiClient.get(`/teams/user/${userId}/role-summary/${businessUnitId}`),
  
  // ✅ Get team statistics
  getStatistics: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/teams/statistics', { params }),
  
  // ✅ Get users role consistency
  getUsersConsistency: (businessUnitId: string): Promise<AxiosResponse> => 
    apiClient.get(`/teams/users/consistency/${businessUnitId}`),
  
  // ✅ Bulk create team assignments
  bulkCreate: (teams: any[]): Promise<AxiosResponse> => 
    apiClient.post('/teams/bulk', { teams }),
};

// ============================================
// ROLE API - COMPLETE WITH SCOPE FILTER
// ============================================
export const RoleAPI = {
  // Get all roles (with optional scope filter)
  getAll: (params?: { limit?: number; scope?: string; page?: number }): Promise<AxiosResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.scope) queryParams.append('scope', params.scope);
    
    const url = `/roles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get(url);
  },
  
  // Get role by ID
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/roles/${id}`),
  
  // Get roles by scope (project, bu, corporate)
  getByScope: (scope: string, params?: { limit?: number; page?: number }): Promise<AxiosResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const url = `/roles/scope/${scope}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get(url);
  },
  
  // Get project roles only (convenience method)
  getProjectRoles: (params?: { limit?: number; page?: number }): Promise<AxiosResponse> => {
    return RoleAPI.getByScope('project', params);
  },
  
  // Get BU roles only (convenience method)
  getBusinessUnitRoles: (params?: { limit?: number; page?: number }): Promise<AxiosResponse> => {
    return RoleAPI.getByScope('bu', params);
  },
  
  // Get corporate roles only (convenience method)
  getCorporateRoles: (params?: { limit?: number; page?: number }): Promise<AxiosResponse> => {
    return RoleAPI.getByScope('corporate', params);
  },
  
  // Create role
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/roles', data),
  
  // Update role
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/roles/${id}`, data),
  
  // Delete role
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/roles/${id}`),
  
  // Check role name availability
  checkName: (name: string): Promise<AxiosResponse> => 
    apiClient.get(`/roles/check-name/${name}`),
  
  // Get role permissions
  getPermissions: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/roles/${id}/permissions`),
  
  // Update role permissions
  updatePermissions: (id: string, permissions: string[]): Promise<AxiosResponse> => 
    apiClient.put(`/roles/${id}/permissions`, { permissions }),
};

// Deliverables API
export const DeliverableAPI = {
  getAll: (): Promise<AxiosResponse> => apiClient.get('/deliverables'),
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/deliverables/${id}`),
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/deliverables', data),
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/deliverables/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/deliverables/${id}`),
  getByProject: (projectId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/deliverables/project/${projectId}`),
};

// Categories API
export const CategoryAPI = {
  getAll: (): Promise<AxiosResponse> => apiClient.get('/categories'),
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/categories/${id}`),
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/categories', data),
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/categories/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/categories/${id}`),
  checkName: (name: string): Promise<AxiosResponse> => 
    apiClient.get('/categories/check-name', { params: { name } }),
  getWithWorkPackages: (): Promise<AxiosResponse> => 
    apiClient.get('/categories/with-work-packages'),
  getByBusinessUnit: (businessUnitId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/categories/business-unit/${businessUnitId}`),
  getWithCounts: (): Promise<AxiosResponse> => 
    apiClient.get('/categories/with-counts'),
};

// Work Packages API
export const WorkPackageAPI = {
  getAll: (): Promise<AxiosResponse> => apiClient.get('/workpackages'),
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/workpackages/${id}`),
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/workpackages', data),
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/workpackages/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/workpackages/${id}`),
  getByCategory: (categoryId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/workpackages/category/${categoryId}`),
  getByDeliverable: (deliverableId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/workpackages/deliverable/${deliverableId}`),
  checkCode: (code: string): Promise<AxiosResponse> => 
    apiClient.get('/workpackages/check-code', { params: { code } }),
  validateDates: (deliverableId: string, dates: any): Promise<AxiosResponse> => 
    apiClient.post(`/workpackages/validate-dates/${deliverableId}`, dates),
  getWithDeliverable: (): Promise<AxiosResponse> => 
    apiClient.get('/workpackages/with-deliverable'),
  getWithCategory: (): Promise<AxiosResponse> => 
    apiClient.get('/workpackages/with-category'),
  getByProject: (projectId: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/workpackages/project/${projectId}`),
};

// Companies API
export const CompanyAPI = {
  getAll: (): Promise<AxiosResponse> => apiClient.get('/companies'),
  getById: (id: string | number): Promise<AxiosResponse> => 
    apiClient.get(`/companies/${id}`),
  getBySlug: (slug: string): Promise<AxiosResponse> => 
    apiClient.get(`/companies/slug/${slug}`),
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/companies', data),
  update: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/companies/${id}`, data),
  patch: (id: string | number, data: any): Promise<AxiosResponse> => 
    apiClient.patch(`/companies/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse> => 
    apiClient.delete(`/companies/${id}`),
  toggleStatus: (id: string | number): Promise<AxiosResponse> => 
    apiClient.patch(`/companies/${id}/toggle-status`),
  checkSlug: (slug: string): Promise<AxiosResponse> => 
    apiClient.get('/companies/check-slug', { params: { slug } }),
  checkName: (name: string): Promise<AxiosResponse> => 
    apiClient.get('/companies/check-name', { params: { name } }),
  getWithStats: (): Promise<AxiosResponse> => 
    apiClient.get('/companies/with-stats'),
  getActive: (): Promise<AxiosResponse> => 
    apiClient.get('/companies/active'),
  search: (query: string): Promise<AxiosResponse> => 
    apiClient.get('/companies/search', { params: { q: query } }),
};

// Schedules API
export const ScheduleAPI = {
  // Basic CRUD operations
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/schedules', { params }),
  
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/${id}`),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/schedules', data),
  
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/schedules/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/schedules/${id}`),
  
  // Check endpoints
  checkCode: (code: string): Promise<AxiosResponse> => 
    apiClient.get('/schedules/check-code', { params: { code } }),
  
  checkBaseline: (workpackage_id: string): Promise<AxiosResponse> => 
    apiClient.get('/schedules/baseline-check', { params: { workpackage_id } }),
  
  checkTypeAvailability: (workpackage_id: string, type: string): Promise<AxiosResponse> => 
    apiClient.get('/schedules/type-check', { params: { workpackage_id, type } }),
  
  // Get by various criteria
  getByCode: (code: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/code/${code}`, { params }),
  
  getByWorkpackage: (workpackageId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/workpackage/${workpackageId}`, { params }),
  
  getBaselineForWorkPackage: (workpackageId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/workpackage/${workpackageId}/baseline`),
  
  getActualForWorkPackage: (workpackageId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/workpackage/${workpackageId}/actual`),
  
  getScheduleByWorkpackageAndType: (workpackageId: string, type: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/workpackage/${workpackageId}/type/${type}`, { params }),
  
  // Statistics and counts
  getTypesCount: (): Promise<AxiosResponse> => 
    apiClient.get('/schedules/types/count'),
  
  getStatistics: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/schedules/statistics', { params }),
  
  // Get schedules by type
  getSchedulesByType: (type: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedules/type/${type}`, { params }),
  
  // Recent schedules
  getRecentSchedules: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/schedules/recent', { params }),
  
  // Create schedule by type for work package
  createBaselineSchedule: (workpackageId: string, data: any): Promise<AxiosResponse> => 
    apiClient.post(`/schedules/workpackage/${workpackageId}/baseline`, data),
  
  createActualSchedule: (workpackageId: string, data: any): Promise<AxiosResponse> => 
    apiClient.post(`/schedules/workpackage/${workpackageId}/actual`, data),
};

// Schedule Revisions API
export const ScheduleRevisionsAPI = {
  // Validation methods
  validateProjectCodePattern: (scheduleId: string, formData: FormData): Promise<AxiosResponse> =>
    apiClient.post(`/schedule-revisions/${scheduleId}/validate-code-pattern`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  extractProjectCodePattern: (formData: FormData): Promise<AxiosResponse> =>
    apiClient.post('/schedule-revisions/extract-code-pattern', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  compareProjectCodePatterns: (scheduleCode: string, xerProjectCode: string): Promise<AxiosResponse> =>
    apiClient.get('/schedule-revisions/compare-code-patterns', {
      params: { schedule_code: scheduleCode, xer_code: xerProjectCode }
    }),

  validateRevisionUpload: (scheduleId: string, file: File): Promise<AxiosResponse> => {
    const formData = new FormData();
    formData.append('schedule_file', file);
    return apiClient.post(`/schedule-revisions/${scheduleId}/validate-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Basic CRUD operations
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/schedule-revisions', { params }),
  
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${id}`),
  
  getByNumber: (scheduleId: string, revisionNumber: number): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}/${revisionNumber}`),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/schedule-revisions', data),
  
  upload: (formData: FormData): Promise<AxiosResponse> => 
    apiClient.post('/schedule-revisions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  uploadWithProgress: (formData: FormData, onUploadProgress?: (progressEvent: any) => void): Promise<AxiosResponse> => 
    apiClient.post('/schedule-revisions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/schedule-revisions/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/schedule-revisions/${id}`),
  
  // Status management
  updateStatus: (id: string, data: { revision_status: 'under_review' | 'current' | 'superseded', revision_notes?: string }): Promise<AxiosResponse> => 
    apiClient.patch(`/schedule-revisions/${id}/status`, data),
  
  markCurrent: (id: string): Promise<AxiosResponse> => 
    apiClient.patch(`/schedule-revisions/${id}/mark-current`),
  
  createAndSupersede: (data: {
    schedule_id: string;
    schedule_file: File;
    revision_notes: string;
    data_date?: string;
    actual_data_date?: string;
    planned_start?: string;
    planned_finish?: string;
    supersedes_revision_id?: string;
  }): Promise<AxiosResponse> => {
    const formData = new FormData();
    formData.append('schedule_id', data.schedule_id);
    formData.append('schedule_file', data.schedule_file);
    formData.append('revision_notes', data.revision_notes);
    
    if (data.data_date) formData.append('data_date', data.data_date);
    if (data.actual_data_date) formData.append('actual_data_date', data.actual_data_date);
    if (data.planned_start) formData.append('planned_start', data.planned_start);
    if (data.planned_finish) formData.append('planned_finish', data.planned_finish);
    if (data.supersedes_revision_id) formData.append('supersedes_revision_id', data.supersedes_revision_id);
    
    return apiClient.post('/schedule-revisions/create-and-supersede', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  uploadNewRevision: (formData: FormData, onUploadProgress?: (progressEvent: any) => void): Promise<AxiosResponse> => 
    apiClient.post('/schedule-revisions/upload-new', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  
  downloadFile: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${id}/download`, { responseType: 'blob' }),
  
  checkDuplicate: (formData: FormData): Promise<AxiosResponse> => 
    apiClient.post('/schedule-revisions/check-duplicate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getBySchedule: (scheduleId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}`, { params }),
  
  getCurrentBySchedule: (scheduleId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}/current`, { params }),
  
  getLatestBySchedule: (scheduleId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}/latest`, { params }),
  
  getByFileHash: (hash: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/hash/${hash}`, { params }),
  
  getByRevisionStatus: (status: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/status/${status}`, { params }),
  
  getStatistics: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/schedule-revisions/statistics', { params }),
  
  getRevisionCount: (scheduleId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}/count`),
  
  getNextRevisionNumber: (scheduleId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/schedule/${scheduleId}/next-revision-number`),
  
  compareRevisions: (revisionId1: string, revisionId2: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/compare/${revisionId1}/${revisionId2}`, { params }),
  
  exportRevision: (id: string, format: string = 'json'): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${id}/export`, { 
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),
  
  bulkDelete: (revisionIds: string[]): Promise<AxiosResponse> => 
    apiClient.delete('/schedule-revisions/bulk/delete', { data: { revisionIds } }),
  
  bulkUpdateStatus: (revisionIds: string[], status: string, revision_notes?: string): Promise<AxiosResponse> => 
    apiClient.patch('/schedule-revisions/bulk/status', { revisionIds, revision_status: status, revision_notes }),
  
  getRevisionLineage: (revisionId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${revisionId}/lineage`),
  
  getSupersedingRevisions: (revisionId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${revisionId}/superseding`),
  
  getSupersededRevisions: (revisionId: string): Promise<AxiosResponse> => 
    apiClient.get(`/schedule-revisions/${revisionId}/superseded`),
  
  validateFile: (file: File): Promise<AxiosResponse> => {
    const formData = new FormData();
    formData.append('schedule_file', file);
    return apiClient.post('/schedule-revisions/validate-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// System API
export const SystemAPI = {
  health: (): Promise<AxiosResponse> => apiClient.get('/health'),
  testDb: (): Promise<AxiosResponse> => apiClient.get('/test-db'),
  corsTest: (): Promise<AxiosResponse> => apiClient.get('/cors-test'),
  version: (): Promise<AxiosResponse> => apiClient.get('/version'),
  config: (): Promise<AxiosResponse> => apiClient.get('/config'),
};

// Excel Templates API
export const ExcelTemplateAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/excel-templates', { params }),
  
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/excel-templates/${id}`),
  
  getByCode: (code: string): Promise<AxiosResponse> => 
    apiClient.get(`/excel-templates/code/${code}`),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/excel-templates', data),
  
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/excel-templates/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/excel-templates/${id}`),
  
  uploadTemplate: (formData: FormData, onUploadProgress?: (progressEvent: any) => void): Promise<AxiosResponse> => 
    apiClient.post('/excel-templates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  
  downloadTemplate: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/excel-templates/${id}/download`, { responseType: 'blob' }),
  
  getByScheduleType: (scheduleType: string): Promise<AxiosResponse> => 
    apiClient.get('/excel-templates/by-schedule-type', { params: { schedule_type: scheduleType } }),
  
  getLatestVersion: (code: string): Promise<AxiosResponse> => 
    apiClient.get(`/excel-templates/code/${code}/latest`),
  
  validateTemplate: (id: string, fileData: any): Promise<AxiosResponse> => 
    apiClient.post(`/excel-templates/${id}/validate`, fileData),
};

// Activity API
export const ActivityAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/activities', { params }),
  
  getById: (id: string): Promise<AxiosResponse> => 
    apiClient.get(`/activities/${id}`),
  
  getByRevision: (revisionId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/activities/revision/${revisionId}`, { params }),
  
  create: (data: any): Promise<AxiosResponse> => 
    apiClient.post('/activities', data),
  
  update: (id: string, data: any): Promise<AxiosResponse> => 
    apiClient.put(`/activities/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/activities/${id}`),
  
  bulkCreate: (activities: any[]): Promise<AxiosResponse> => 
    apiClient.post('/activities/bulk', { activities }),
  
  importFromRevision: (revisionId: string, options?: any): Promise<AxiosResponse> => 
    apiClient.post(`/activities/import/revision/${revisionId}`, options),
  
  getStatistics: (revisionId: string): Promise<AxiosResponse> => 
    apiClient.get(`/activities/revision/${revisionId}/statistics`),
  
  compareRevisions: (revisionId1: string, revisionId2: string): Promise<AxiosResponse> => 
    apiClient.get(`/activities/compare/${revisionId1}/${revisionId2}`),
};

// Analytics and Reports API
export const AnalyticsAPI = {
  getScheduleMetrics: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/analytics/schedule-metrics', { params }),
  
  getRevisionTrends: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/analytics/revision-trends', { params }),
  
  getFileTypeDistribution: (): Promise<AxiosResponse> => 
    apiClient.get('/analytics/file-type-distribution'),
  
  getRevisionStatusSummary: (): Promise<AxiosResponse> => 
    apiClient.get('/analytics/revision-status-summary'),
  
  exportRevisionsReport: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/analytics/export/revisions-report', { 
      params,
      responseType: 'blob' 
    }),
  
  exportScheduleHistory: (scheduleId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/analytics/export/schedule-history/${scheduleId}`, { 
      params,
      responseType: 'blob' 
    }),
  
  getDashboardStats: (): Promise<AxiosResponse> => 
    apiClient.get('/analytics/dashboard-stats'),
  
  getRecentActivities: (limit?: number): Promise<AxiosResponse> => 
    apiClient.get('/analytics/recent-activities', { params: { limit } }),
  
  getTopSchedules: (limit?: number): Promise<AxiosResponse> => 
    apiClient.get('/analytics/top-schedules', { params: { limit } }),
};

// Notifications API
export const NotificationAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/notifications', { params }),
  
  getUnread: (): Promise<AxiosResponse> => 
    apiClient.get('/notifications/unread'),
  
  markAsRead: (id: string): Promise<AxiosResponse> => 
    apiClient.patch(`/notifications/${id}/read`),
  
  markAllAsRead: (): Promise<AxiosResponse> => 
    apiClient.patch('/notifications/mark-all-read'),
  
  delete: (id: string): Promise<AxiosResponse> => 
    apiClient.delete(`/notifications/${id}`),
  
  getRevisionNotifications: (): Promise<AxiosResponse> => 
    apiClient.get('/notifications/type/revision'),
  
  getApprovalNotifications: (): Promise<AxiosResponse> => 
    apiClient.get('/notifications/type/approval'),
  
  subscribe: (userId: string): Promise<AxiosResponse> => 
    apiClient.post('/notifications/subscribe', { user_id: userId }),
};

// Audit Log API
export const AuditLogAPI = {
  getAll: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/audit-logs', { params }),
  
  getByEntity: (entityType: string, entityId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/audit-logs/entity/${entityType}/${entityId}`, { params }),
  
  getByUser: (userId: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/audit-logs/user/${userId}`, { params }),
  
  getByAction: (action: string, params?: any): Promise<AxiosResponse> => 
    apiClient.get(`/audit-logs/action/${action}`, { params }),
  
  getRevisionAuditLogs: (revisionId: string): Promise<AxiosResponse> => 
    apiClient.get(`/audit-logs/revision/${revisionId}`),
  
  getScheduleAuditLogs: (scheduleId: string): Promise<AxiosResponse> => 
    apiClient.get(`/audit-logs/schedule/${scheduleId}`),
  
  exportAuditLogs: (params?: any): Promise<AxiosResponse> => 
    apiClient.get('/audit-logs/export', { 
      params,
      responseType: 'blob' 
    }),
};

// Dashboard API
export const DashboardAPI = {
  getOverview: (): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/overview'),
  
  getScheduleOverview: (): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/schedule-overview'),
  
  getRevisionOverview: (): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/revision-overview'),
  
  getRecentRevisions: (limit?: number): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/recent-revisions', { params: { limit } }),
  
  getPendingApprovals: (): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/pending-approvals'),
  
  getScheduleStats: (scheduleId: string): Promise<AxiosResponse> => 
    apiClient.get(`/dashboard/schedule-stats/${scheduleId}`),
  
  getUserActivity: (userId?: string): Promise<AxiosResponse> => 
    apiClient.get('/dashboard/user-activity', { params: { user_id: userId } }),
};

// Export API constants
export { apiClient, API_BASE };

// Default export for backward compatibility
export default {
  apiClient,
  apiHelper,
  AuthAPI,
  ClientAPI,
  UserAPI,
  BusinessUnitAPI,
  ProjectAPI,
  TeamAPI,
  RoleAPI,
  DeliverableAPI,
  CategoryAPI,
  WorkPackageAPI,
  CompanyAPI,
  ScheduleAPI,
  ScheduleRevisionsAPI,
  SystemAPI,
  ExcelTemplateAPI,
  ActivityAPI,
  AnalyticsAPI,
  NotificationAPI,
  AuditLogAPI,
  DashboardAPI,
};