// src/types/docTypes.ts
export interface DocCategory {
  id: string;
  label: string;
  description?: string;
  order_index?: number;
  created_at: string;
}

export interface DocSubcategory {
  id: string;
  category_id: string;
  label: string;
  description?: string;
  order_index?: number;
  created_at: string;
}

export interface DocType {
  id: string;
  subcategory_id: string;
  label: string;
  is_periodic: boolean;
  only_one_per_project: boolean;
  entity_type: string;
  native_format: string;
  description?: string;
  order_index?: number;
  created_at: string;
}

export interface DocTypeWithSubcategory extends DocType {
  subcategory: DocSubcategory;
}

export interface EmissionPolicy {
  id: string;
  project_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  anchor_date: string;
  anchor_day?: number;
  description?: string;
  created_at: string;
}

export interface EmissionPeriod {
  id: string;
  emission_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
  status: 'pending' | 'received' | 'late';
  created_at: string;
}

export interface ProjDoc {
  id: string;
  project_id: string;
  doc_type_id: string;
  doc_number: string;
  title?: string;
  emission_id?: string;
  status: 'active' | 'superseded' | 'cancelled';
  created_at: string;
  doc_type?: DocType;
  emission_policy?: EmissionPolicy;
  latest_revision?: DocRevision;
}

export interface DocRevision {
  id: string;
  projdoc_id: string;
  period_id?: string;
  revision: number;
  revision_code?: string;
  revision_notes?: string;
  source_filename: string;
  source_file_hash: string;
  source_file_size?: number;
  source_file_path?: string;
  uploaded_at: string;
  uploaded_by?: string;
  superseded_by?: string;
  uploader?: {
    id: string;
    name: string;
    family_name: string;
    email: string;
  };
}
// frontend/src/types/docTypes.ts (ajouter à la fin)
// ============================================
// Re-export from index.ts for backward compatibility
// ============================================
export type {
  BusinessUnit,
  User,
  Role,
  Project,
  TeamAssignment,
  Schedule,
  ScheduleRevision,
  PaginatedResponse,
  ApiResponse,
} from './index';