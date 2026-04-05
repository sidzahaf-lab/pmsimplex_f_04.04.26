// frontend/src/types/index.ts
// ============================================
// CORE TYPES (Business Units, Users, Roles, Projects, Teams)
// ============================================

export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  family_name: string;
  job_title: string;
  department?: string;
  business_unit_id?: string;
  business_unit?: BusinessUnit;
  is_active: boolean;
  is_super_admin: boolean;
  is_guest: boolean;
  corporate_role_id?: string;
  corporate_role?: Role;
  default_role_id?: string;
  default_role?: Role;
  team_assignments?: TeamAssignment[];
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  scope: 'bu' | 'project' | 'corporate' | 'guest';
  created_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client_name?: string;
  start_date: string;
  planned_end_date: string;
  baseline_finish_date?: string;
  current_finish_date?: string;
  description?: string;
  health_status?: 'good' | 'warning' | 'critical';
  business_unit_id?: string;
  business_unit?: BusinessUnit;
  contract_type?: string;
  current_phase?: string;
  contract_value?: number;
  currency?: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  creator?: User;
  last_modified_at?: string;
}

export interface TeamAssignment {
  id: string;
  business_unit_id: string;
  business_unit?: BusinessUnit;
  project_id?: string;
  project?: Project;
  user_id: string;
  user?: User;
  role_id: string;
  role?: Role;
  assigned_at: string;
  assigned_by?: string;
  assigner?: User;
  is_active: boolean;
  removed_at?: string;
}

// ============================================
// SCHEDULE TYPES
// ============================================

export interface Schedule {
  id: string;
  code: string;
  workpackage_id: string;
  type: 'baseline' | 'actual';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRevision {
  id: string;
  schedule_id: string;
  revision_number: number;
  revision_status: 'under_review' | 'current' | 'superseded';
  revision_notes?: string;
  data_date?: string;
  actual_data_date?: string;
  planned_start?: string;
  planned_finish?: string;
  file_hash: string;
  file_name: string;
  file_size: number;
  file_path: string;
  uploaded_by?: string;
  uploader?: User;
  created_at: string;
  supersedes_revision_id?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

// ============================================
// DOCUMENT TYPES (Re-exported from docTypes.ts)
// ============================================
// Ces types sont importés depuis docTypes.ts pour maintenir la compatibilité
// avec les modules existants qui utilisent ce fichier.
// À terme, on pourra fusionner complètement les types dans ce fichier.

export type {
  DocCategory,
  DocSubcategory,
  DocType,
  DocTypeWithSubcategory,
  EmissionPolicy,
  EmissionPeriod,
  ProjDoc,
  DocRevision,
} from './docTypes';