// API Configuration based on environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Use environment variable or fallback
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001'  // Local backend
  : import.meta.env.VITE_API_URL || 'https://pmsimplex-b-04-04-26.onrender.com';  // Render backend

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',  // Note: This should match your backend route
  REGISTER: '/api/users/register',
  
  // Clients
  CLIENTS: '/api/clients',
  MONOREPO_CLIENT: '/api/clients/monorepo',
  
  // Business Units
  BUSINESS_UNITS: '/api/business-units',
  
  // Users
  USERS: '/api/users',
  
  // Companies
  COMPANIES: '/api/companies',
  
  // Projects & Deliverables
  PROJECTS: '/api/projects',
  DELIVERABLES: '/api/deliverables',
  CONTRACTS: '/api/contracts',
  
  // Categories
  CATEGORIES: '/api/categories',
  
  // Schedules
  SCHEDULES: '/api/schedules',
  SCHEDULE_REVISIONS: '/api/schedule-revisions',
  EXCEL_TEMPLATES: '/api/excel-templates',
  
  // Work Packages & Activities
  WORK_PACKAGES: '/api/workpackages',
  ACTIVITIES: '/api/activities',
  ACTIVITY_PROGRESS: '/api/activity-progress',
  
  // WBS & SRA
  WBS: '/api/wbs',
  SRA: '/api/sra',
  
  // System
  HEALTH: '/api/health',
  TEST_DB: '/api/test-db',
};