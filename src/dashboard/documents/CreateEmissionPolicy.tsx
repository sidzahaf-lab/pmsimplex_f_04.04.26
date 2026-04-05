import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Calendar,
  Repeat,
  Info,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  Tag,
  FolderTree,
  HelpCircle,
  Building2,
  Eye,
  ArrowLeft,
  CheckCheck
} from 'lucide-react';
import axios from 'axios';
import { generatePeriodsFromPolicy } from '@/utils/periodGenerator';
import { BusinessUnitAPI } from '@/services/api';

const API_BASE_URL = 'http://localhost:3001/api';

// Helper function to format date for input fields
const formatDateForInput = (dateString: string): string => {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
};

// Helper function to format native_format for display (add dots)
const formatNativeFormat = (format: string): string => {
  if (!format) return '';
  return format.split(',').map(f => `.${f.trim()}`).join(', ');
};

// Format date for display
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Types
interface BusinessUnit {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Project {
  id: string;
  name: string;
  code: string;
  start_date: string;
  planned_end_date: string;
  status?: string;
  business_unit?: {
    id: string;
    name: string;
  };
}

interface DocCategory {
  id: string;
  name: string;
  description?: string;
  subcategories?: DocSubcategory[];
}

interface DocSubcategory {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  doc_types?: DocType[];
}

interface DocType {
  id: string;
  subcategory_id: string;
  label: string;
  is_periodic: boolean;
  only_one_per_project: boolean;
  entity_type: string;
  native_format: string;
}

interface EmissionPolicy {
  id: string;
  project_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  anchor_date: string;
  anchor_day?: number | null;
  description?: string;
  created_at: string;
  project?: {
    id: string;
    name: string;
    code: string;
    planned_end_date: string;
  };
  doc_types?: Array<{
    id: string;
    label: string;
    is_periodic: boolean;
    entity_type: string;
  }>;
}

interface EmissionPeriod {
  period_number: number;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

// Fetch all business units using BusinessUnitAPI
const fetchBusinessUnits = async (): Promise<BusinessUnit[]> => {
  try {
    console.log('🔍 Fetching business units...');
    const response = await BusinessUnitAPI.getAll();
    const responseData = response.data;
    
    let businessUnitsData: BusinessUnit[] = [];
    
    if (responseData?.data?.business_units) {
      businessUnitsData = responseData.data.business_units;
    } else if (responseData?.business_units) {
      businessUnitsData = responseData.business_units;
    } else if (Array.isArray(responseData)) {
      businessUnitsData = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      businessUnitsData = responseData.data;
    }
    
    console.log('✅ Business units loaded:', businessUnitsData.length);
    return businessUnitsData.filter(bu => bu.is_active !== false);
  } catch (error) {
    console.error('Error fetching business units:', error);
    return [];
  }
};

// Fetch all projects
const fetchProjects = async (businessUnitId?: string): Promise<Project[]> => {
  try {
    let url = `${API_BASE_URL}/projects?is_active=true&limit=100`;
    if (businessUnitId) {
      url += `&business_unit_id=${businessUnitId}`;
    }
    const response = await axios.get(url);
    const responseData = response.data;
    
    let projectsData: Project[] = [];
    
    if (responseData?.data?.projects) {
      projectsData = responseData.data.projects;
    } else if (responseData?.projects) {
      projectsData = responseData.projects;
    } else if (Array.isArray(responseData)) {
      projectsData = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      projectsData = responseData.data;
    }
    
    return projectsData;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

// Fetch project details by ID
const fetchProjectDetails = async (projectId: string): Promise<Project> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
    const responseData = response.data;
    
    let project = responseData?.data?.project || responseData?.project;
    
    if (project) {
      project.start_date = formatDateForInput(project.start_date);
      project.planned_end_date = formatDateForInput(project.planned_end_date);
    }
    
    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
};

// Fetch all periodic document types with their categories
const fetchPeriodicDocTypes = async (): Promise<{
  categories: DocCategory[];
  docTypes: DocType[];
}> => {
  try {
    console.log('📡 Fetching periodic document types...');
    
    const response = await axios.get(`${API_BASE_URL}/doc-types?is_periodic=true`);
    const responseData = response.data;
    
    let docTypes: DocType[] = [];
    if (responseData?.data?.docTypes) {
      docTypes = responseData.data.docTypes;
    } else if (responseData?.docTypes) {
      docTypes = responseData.docTypes;
    } else if (Array.isArray(responseData)) {
      docTypes = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      docTypes = responseData.data;
    }
    
    console.log('📡 Periodic doc types loaded:', docTypes.length);
    
    const transformedDocTypes = docTypes.map((dt: any) => ({
      ...dt,
      native_format: formatNativeFormat(dt.native_format)
    }));
    
    console.log('📡 Fetching all subcategories...');
    const subcategoriesResponse = await axios.get(`${API_BASE_URL}/doc-subcategories`);
    const subcategoriesResponseData = subcategoriesResponse.data;
    
    let allSubcategories: any[] = [];
    if (subcategoriesResponseData?.data?.subcategories) {
      allSubcategories = subcategoriesResponseData.data.subcategories;
    } else if (subcategoriesResponseData?.subcategories) {
      allSubcategories = subcategoriesResponseData.subcategories;
    } else if (Array.isArray(subcategoriesResponseData)) {
      allSubcategories = subcategoriesResponseData;
    } else if (subcategoriesResponseData?.data && Array.isArray(subcategoriesResponseData.data)) {
      allSubcategories = subcategoriesResponseData.data;
    }
    
    console.log('📡 All subcategories loaded:', allSubcategories.length);
    
    const categoriesResponse = await axios.get(`${API_BASE_URL}/doc-categories`);
    const categoriesResponseData = categoriesResponse.data;
    
    let rawCategories: any[] = [];
    if (categoriesResponseData?.data?.categories) {
      rawCategories = categoriesResponseData.data.categories;
    } else if (categoriesResponseData?.categories) {
      rawCategories = categoriesResponseData.categories;
    } else if (Array.isArray(categoriesResponseData)) {
      rawCategories = categoriesResponseData;
    } else if (categoriesResponseData?.data && Array.isArray(categoriesResponseData.data)) {
      rawCategories = categoriesResponseData.data;
    }
    
    console.log('📡 Raw categories loaded:', rawCategories.length);
    
    const categoryMap = new Map();
    rawCategories.forEach((cat: any) => {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        description: cat.description
      });
    });
    
    const subcategoriesWithDocTypes = allSubcategories.map((sub: any) => ({
      id: sub.id,
      name: sub.name,
      description: sub.description,
      category_id: sub.category_id,
      category_name: categoryMap.get(sub.category_id)?.name || 'Unknown',
      doc_types: transformedDocTypes.filter((dt: DocType) => dt.subcategory_id === sub.id)
    }));
    
    const subcategoriesByCategory = new Map();
    subcategoriesWithDocTypes.forEach(sub => {
      if (!subcategoriesByCategory.has(sub.category_id)) {
        subcategoriesByCategory.set(sub.category_id, []);
      }
      if (sub.doc_types.length > 0) {
        subcategoriesByCategory.get(sub.category_id).push(sub);
      }
    });
    
    const categoriesWithDocTypes = rawCategories
      .map((category: any) => {
        const categorySubcategories = subcategoriesByCategory.get(category.id) || [];
        return {
          id: category.id,
          name: category.name,
          description: category.description,
          subcategories: categorySubcategories
        };
      })
      .filter((category: any) => category.subcategories && category.subcategories.length > 0);
    
    console.log('📡 Categories with embedded doc types:', categoriesWithDocTypes.length);
    
    return {
      categories: categoriesWithDocTypes,
      docTypes: transformedDocTypes
    };
  } catch (error) {
    console.error('Error fetching document types:', error);
    return { categories: [], docTypes: [] };
  }
};

// Fetch existing policies for a project
const fetchExistingPolicies = async (projectId: string): Promise<EmissionPolicy[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/emission-policies/project/${projectId}`);
    const responseData = response.data;
    
    if (responseData?.data?.policies) {
      return responseData.data.policies;
    } else if (responseData?.policies) {
      return responseData.policies;
    } else if (Array.isArray(responseData)) {
      return responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      return responseData.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching existing policies:', error);
    return [];
  }
};

// Fetch policy by ID for edit mode
const fetchPolicyById = async (policyId: string): Promise<EmissionPolicy> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/emission-policies/${policyId}`);
    const responseData = response.data;
    
    return responseData?.data?.policy || responseData?.policy;
  } catch (error) {
    console.error('Error fetching policy:', error);
    throw error;
  }
};

// Create new policy
const createPolicy = async (
  projectId: string, 
  data: any, 
  selectedDocTypeIds: string[],
  periods: any[]
): Promise<EmissionPolicy> => {
  const requestData = {
    frequency: data.frequency,
    anchor_date: data.anchor_date,
    anchor_day: data.anchor_day,
    description: data.description || null,
    doc_type_ids: selectedDocTypeIds,
    periods: periods
  };
  
  console.log('📡 POST to:', `${API_BASE_URL}/emission-policies/project/${projectId}`);
  console.log('📦 Request data:', JSON.stringify(requestData, null, 2));
  
  const response = await axios.post(
    `${API_BASE_URL}/emission-policies/project/${projectId}`,
    requestData
  );
  
  return response.data.data.policy;
};

// Update existing policy
const updatePolicy = async (
  policyId: string,
  data: any,
  selectedDocTypeIds: string[],
  periods: any[]
): Promise<EmissionPolicy> => {
  const policyData: any = {
    frequency: data.frequency,
    anchor_date: data.anchor_date,
    description: data.description || null,
    doc_type_ids: selectedDocTypeIds,
    periods: periods
  };
  
  if (data.frequency === 'weekly') {
    if (data.anchor_day && !isNaN(parseInt(data.anchor_day.toString()))) {
      policyData.anchor_day = parseInt(data.anchor_day.toString());
    } else {
      policyData.anchor_day = null;
    }
  } else {
    policyData.anchor_day = null;
  }
  
  console.log('📡 PUT to:', `${API_BASE_URL}/emission-policies/${policyId}`);
  console.log('📦 Request data:', JSON.stringify(policyData, null, 2));
  
  const response = await axios.put(
    `${API_BASE_URL}/emission-policies/${policyId}`,
    policyData
  );
  
  return response.data.data.policy;
};

// Check if document type is already assigned to another policy
const checkDocTypeAssignment = async (
  projectId: string,
  docTypeId: string,
  excludePolicyId?: string
): Promise<{ assigned: boolean; policyName?: string }> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/doc-types/${docTypeId}/policy-check`,
      { params: { exclude_policy_id: excludePolicyId } }
    );
    return response.data.data;
  } catch (error) {
    console.error('Error checking doc type assignment:', error);
    return { assigned: false };
  }
};

// Schema for emission policy
const emissionPolicySchema = z.object({
  business_unit_id: z.string().optional(),
  project_id: z.string().min(1, 'Please select a project'),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    required_error: 'Please select a frequency',
  }),
  anchor_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .min(1, 'Start date is required'),
  anchor_day: z.string()
    .optional()
    .transform(val => val ? parseInt(val) : undefined),
  description: z.string()
    .max(250, 'Description must be less than 250 characters')
    .optional()
    .or(z.literal('')),
  project_end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
}).superRefine((data, ctx) => {
  if (data.frequency === 'weekly' && !data.anchor_day) {
    ctx.addIssue({
      path: ['anchor_day'],
      message: 'Day of week is required for weekly frequency',
      code: z.ZodIssueCode.custom,
    });
  }
  
  if (data.project_end_date && data.anchor_date > data.project_end_date) {
    ctx.addIssue({
      path: ['anchor_date'],
      message: 'Start date cannot be after project end date',
      code: z.ZodIssueCode.custom,
    });
  }
});

type EmissionPolicyFormValues = z.infer<typeof emissionPolicySchema>;

interface CreateEmissionPolicyProps {
  initialProjectId?: string;
  policyId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateEmissionPolicy: React.FC<CreateEmissionPolicyProps> = ({
  initialProjectId,
  policyId,
  onSuccess = () => {
    console.log('Default onSuccess - no function provided');
    window.location.reload();
  },
  onCancel = () => {
    console.log('Default onCancel - no function provided');
    window.location.reload();
  }
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Preview mode state
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<{
    policy: {
      frequency: string;
      anchor_date: string;
      anchor_day?: number | null;
      description?: string;
      project_name: string;
      project_code: string;
      project_start: string;
      project_end: string;
    };
    docTypes: Array<{
      id: string;
      label: string;
      entity_type: string;
      native_format: string;
      category: string;
      subcategory: string;
    }>;
    periods: EmissionPeriod[];
  } | null>(null);
  
  // Business Units
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(true);
  
  // Projects list
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  // Selected project data
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  
  // Document types data
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loadingDocTypes, setLoadingDocTypes] = useState(true);
  
  // Existing policies (for checking conflicts)
  const [existingPolicies, setExistingPolicies] = useState<EmissionPolicy[]>([]);
  
  // Selected document types
  const [selectedDocTypeIds, setSelectedDocTypeIds] = useState<string[]>([]);
  const [docTypeConflicts, setDocTypeConflicts] = useState<Map<string, string>>(new Map());
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  
  // Edit mode
  const isEditMode = !!policyId;
  const [originalPolicy, setOriginalPolicy] = useState<EmissionPolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const form = useForm<EmissionPolicyFormValues>({
    resolver: zodResolver(emissionPolicySchema),
    defaultValues: {
      business_unit_id: '',
      project_id: initialProjectId || '',
      frequency: 'weekly',
      anchor_date: '',
      anchor_day: '1',
      description: '',
      project_end_date: '',
    },
    mode: 'onChange',
  });

  // Watch form values
  const selectedBusinessUnitId = form.watch('business_unit_id');
  const selectedProjectId = form.watch('project_id');
  const selectedFrequency = form.watch('frequency');
  const anchorDate = form.watch('anchor_date');
  const projectEndDate = form.watch('project_end_date');
  const selectedAnchorDay = form.watch('anchor_day');

  // Load business units on mount
  useEffect(() => {
    const loadBusinessUnits = async () => {
      try {
        setLoadingBusinessUnits(true);
        const units = await fetchBusinessUnits();
        setBusinessUnits(units);
        console.log('✅ Business units set:', units.length);
      } catch (error) {
        console.error('Error loading business units:', error);
      } finally {
        setLoadingBusinessUnits(false);
      }
    };
    
    loadBusinessUnits();
  }, []);

  // Load projects when business unit changes
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const projectsList = await fetchProjects(
          selectedBusinessUnitId && selectedBusinessUnitId !== 'all' 
            ? selectedBusinessUnitId 
            : undefined
        );
        setProjects(projectsList);
        console.log('✅ Projects loaded:', projectsList.length);
        
        // Reset project selection if current project is not in the new list
        if (selectedProjectId && !projectsList.some(p => p.id === selectedProjectId)) {
          form.setValue('project_id', '');
          setSelectedProject(null);
        }
        
        if (initialProjectId && projectsList.some(p => p.id === initialProjectId) && !selectedProjectId) {
          form.setValue('project_id', initialProjectId);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
        setError('Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    };
    
    loadProjects();
  }, [selectedBusinessUnitId, initialProjectId, form, selectedProjectId]);

  // Load selected project details when project changes
  useEffect(() => {
    const loadProjectDetails = async () => {
      if (!selectedProjectId) {
        setSelectedProject(null);
        form.setValue('anchor_date', '');
        form.setValue('project_end_date', '');
        return;
      }

      try {
        setLoadingProject(true);
        const project = await fetchProjectDetails(selectedProjectId);
        setSelectedProject(project);
        
        form.setValue('anchor_date', project.start_date);
        form.setValue('project_end_date', project.planned_end_date);
        
        const policies = await fetchExistingPolicies(selectedProjectId);
        setExistingPolicies(policies);
      } catch (error) {
        console.error('Error loading project details:', error);
        setError('Failed to load project details');
      } finally {
        setLoadingProject(false);
      }
    };
    
    loadProjectDetails();
  }, [selectedProjectId, form]);

  // Load periodic document types
  useEffect(() => {
    const loadDocTypes = async () => {
      try {
        setLoadingDocTypes(true);
        const { categories, docTypes } = await fetchPeriodicDocTypes();
        
        setDocTypes(docTypes);
        setCategories(categories);
        
        setExpandedCategories(new Set(categories.map(c => c.id)));
        
      } catch (error) {
        console.error('Error loading document types:', error);
      } finally {
        setLoadingDocTypes(false);
      }
    };
    
    loadDocTypes();
  }, []);

  // Load policy data for edit mode
  useEffect(() => {
    const loadPolicy = async () => {
      if (!policyId) return;
      
      try {
        setLoadingPolicy(true);
        const policy = await fetchPolicyById(policyId);
        setOriginalPolicy(policy);
        
        form.setValue('project_id', policy.project_id);
        form.setValue('frequency', policy.frequency);
        form.setValue('anchor_date', formatDateForInput(policy.anchor_date));
        if (policy.anchor_day) {
          form.setValue('anchor_day', policy.anchor_day.toString());
        }
        form.setValue('description', policy.description || '');
        
        if (policy.doc_types) {
          setSelectedDocTypeIds(policy.doc_types.map(dt => dt.id));
        }
      } catch (error) {
        console.error('Error loading policy:', error);
        setError('Failed to load policy details');
      } finally {
        setLoadingPolicy(false);
      }
    };
    
    loadPolicy();
  }, [policyId, form]);

  // Check for conflicts when selection changes
  useEffect(() => {
    const checkConflicts = async () => {
      if (!selectedProjectId || selectedDocTypeIds.length === 0) {
        setDocTypeConflicts(new Map());
        return;
      }
      
      setCheckingConflicts(true);
      const conflicts = new Map<string, string>();
      
      for (const docTypeId of selectedDocTypeIds) {
        const result = await checkDocTypeAssignment(
          selectedProjectId, 
          docTypeId, 
          isEditMode ? policyId : undefined
        );
        
        if (result.assigned && result.policyName) {
          conflicts.set(docTypeId, result.policyName);
        }
      }
      
      setDocTypeConflicts(conflicts);
      setCheckingConflicts(false);
    };
    
    checkConflicts();
  }, [selectedDocTypeIds, selectedProjectId, isEditMode, policyId]);

  // Generate period count preview
  const getPeriodCount = (): number | null => {
    if (!anchorDate || !projectEndDate) return null;
    
    try {
      const start = new Date(anchorDate);
      const end = new Date(projectEndDate);
      
      if (start > end) return null;
      
      let count = 0;
      let current = new Date(start);
      
      while (current <= end) {
        count++;
        if (selectedFrequency === 'daily') {
          current.setDate(current.getDate() + 1);
        } else if (selectedFrequency === 'weekly') {
          current.setDate(current.getDate() + 7);
        } else {
          current.setMonth(current.getMonth() + 1);
        }
      }
      return count;
    } catch (e) {
      return null;
    }
  };

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Toggle document type selection
  const toggleDocType = (docTypeId: string) => {
    setSelectedDocTypeIds(prev => {
      if (prev.includes(docTypeId)) {
        return prev.filter(id => id !== docTypeId);
      } else {
        if (docTypeConflicts.has(docTypeId)) {
          return prev;
        }
        return [...prev, docTypeId];
      }
    });
  };

  // Select all doc types in a subcategory
  const selectSubcategory = (subcategoryId: string, select: boolean) => {
    const subcategoryDocTypes = docTypes.filter(dt => dt.subcategory_id === subcategoryId);
    const docTypeIds = subcategoryDocTypes.map(dt => dt.id);
    
    setSelectedDocTypeIds(prev => {
      if (select) {
        const newIds = docTypeIds.filter(id => 
          !prev.includes(id) && !docTypeConflicts.has(id)
        );
        return [...prev, ...newIds];
      } else {
        return prev.filter(id => !docTypeIds.includes(id));
      }
    });
  };

  // Check if all doc types in a subcategory are selected
  const isSubcategoryFullySelected = (subcategoryId: string): boolean => {
    const subcategoryDocTypes = docTypes.filter(dt => dt.subcategory_id === subcategoryId);
    if (subcategoryDocTypes.length === 0) return false;
    
    return subcategoryDocTypes.every(dt => 
      selectedDocTypeIds.includes(dt.id) || docTypeConflicts.has(dt.id)
    );
  };

  // Check if some doc types in a subcategory are selected
  const isSubcategoryPartiallySelected = (subcategoryId: string): boolean => {
    const subcategoryDocTypes = docTypes.filter(dt => dt.subcategory_id === subcategoryId);
    if (subcategoryDocTypes.length === 0) return false;
    
    const selected = subcategoryDocTypes.some(dt => selectedDocTypeIds.includes(dt.id));
    const notAll = !isSubcategoryFullySelected(subcategoryId);
    return selected && notAll;
  };

  const periodCount = getPeriodCount();

  // Generate preview data
  const generatePreview = () => {
    if (!selectedProject || selectedDocTypeIds.length === 0) {
      setError('Please complete all required fields before preview');
      return;
    }

    // Get selected document types with their full details
    const selectedDocTypesDetails = docTypes
      .filter(dt => selectedDocTypeIds.includes(dt.id))
      .map(dt => {
        // Find category and subcategory
        for (const category of categories) {
          for (const sub of category.subcategories || []) {
            if (sub.doc_types?.some(d => d.id === dt.id)) {
              return {
                id: dt.id,
                label: dt.label,
                entity_type: dt.entity_type,
                native_format: dt.native_format,
                category: category.name,
                subcategory: sub.name
              };
            }
          }
        }
        return {
          id: dt.id,
          label: dt.label,
          entity_type: dt.entity_type,
          native_format: dt.native_format,
          category: 'Unknown',
          subcategory: 'Unknown'
        };
      });

    // Generate periods - only include anchor_day for weekly
    const policyForGeneration: any = {
      frequency: selectedFrequency as 'daily' | 'weekly' | 'monthly',
      anchor_date: anchorDate
    };
    
    // Only add anchor_day for weekly frequency
    if (selectedFrequency === 'weekly' && selectedAnchorDay) {
      const anchorDayNum = parseInt(selectedAnchorDay.toString());
      if (!isNaN(anchorDayNum)) {
        policyForGeneration.anchor_day = anchorDayNum;
      }
    }
    
    const periods = generatePeriodsFromPolicy(
      policyForGeneration, 
      selectedProject.planned_end_date
    ).map(period => ({
      ...period,
      status: 'pending' as const
    }));

    // Set preview data with proper anchor_day
    let anchorDayValue = null;
    if (selectedFrequency === 'weekly' && selectedAnchorDay) {
      const anchorDayNum = parseInt(selectedAnchorDay.toString());
      if (!isNaN(anchorDayNum)) {
        anchorDayValue = anchorDayNum;
      }
    }

    setPreviewData({
      policy: {
        frequency: selectedFrequency,
        anchor_date: anchorDate,
        anchor_day: anchorDayValue,
        description: form.getValues('description'),
        project_name: selectedProject.name,
        project_code: selectedProject.code,
        project_start: selectedProject.start_date,
        project_end: selectedProject.planned_end_date
      },
      docTypes: selectedDocTypesDetails,
      periods: periods
    });

    setPreviewMode(true);
    setError(null);
  };

  // Submit from preview
  const handleSubmitFromPreview = async () => {
    if (!previewData) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const formData = form.getValues();
      
      const submissionData: any = {
        frequency: formData.frequency,
        anchor_date: formData.anchor_date,
        description: formData.description || null
      };
      
      if (formData.frequency === 'weekly') {
        if (formData.anchor_day && !isNaN(parseInt(formData.anchor_day.toString()))) {
          submissionData.anchor_day = parseInt(formData.anchor_day.toString());
        } else {
          submissionData.anchor_day = null;
        }
      } else {
        submissionData.anchor_day = null;
      }
      
      console.log('📤 Submitting policy data (from preview):', JSON.stringify(submissionData, null, 2));
      console.log('📤 With periods:', previewData.periods.length);
      
      let response;
      if (isEditMode && policyId) {
        response = await updatePolicy(policyId, submissionData, selectedDocTypeIds, previewData.periods);
      } else {
        response = await createPolicy(selectedProjectId, submissionData, selectedDocTypeIds, previewData.periods);
      }
      
      console.log('✅ API Response:', response);
      
      setSuccess(true);
      
      setTimeout(() => {
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 1500);
    } catch (error: any) {
      console.error('Error saving policy:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        setError(error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
        console.error('Error request:', error.request);
        setError('No response from server. Please check your connection.');
      } else {
        setError(error.message || 'Failed to save policy');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to edit mode
  const handleBackToEdit = () => {
    setPreviewMode(false);
    setPreviewData(null);
    setError(null);
  };

  if (loadingBusinessUnits || loadingProjects || loadingDocTypes || loadingPolicy) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="pt-6 flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span>
            {loadingBusinessUnits ? 'Loading business units...' : 
             loadingProjects ? 'Loading projects...' : 
             loadingDocTypes ? 'Loading document types...' : 
             'Loading policy...'}
          </span>
        </CardContent>
      </Card>
    );
  }

  // Preview Mode
  if (previewMode && previewData) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            Preview Emission Policy
          </CardTitle>
          <CardDescription>
            Review all details before {isEditMode ? 'updating' : 'creating'} the policy
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Policy {isEditMode ? 'updated' : 'created'} successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {!success && (
            <>
              {/* Project Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold flex items-center gap-2 text-blue-800 mb-3">
                  <Building2 className="h-4 w-4" />
                  Project Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-600 font-medium">Project</p>
                    <p className="text-blue-800">{previewData.policy.project_name} ({previewData.policy.project_code})</p>
                  </div>
                  <div>
                    <p className="text-blue-600 font-medium">Project Duration</p>
                    <p className="text-blue-800">
                      {formatDateForDisplay(previewData.policy.project_start)} → {formatDateForDisplay(previewData.policy.project_end)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Policy Settings */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Repeat className="h-4 w-4" />
                  Policy Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Frequency</p>
                    <p className="font-medium capitalize">{previewData.policy.frequency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium">{formatDateForDisplay(previewData.policy.anchor_date)}</p>
                  </div>
                  {previewData.policy.anchor_day && previewData.policy.frequency === 'weekly' && (
                    <div>
                      <p className="text-sm text-gray-500">Anchor Day</p>
                      <p className="font-medium">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][previewData.policy.anchor_day - 1]}
                      </p>
                    </div>
                  )}
                  {previewData.policy.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Description</p>
                      <p className="font-medium">{previewData.policy.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Document Types */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4" />
                  Document Types ({previewData.docTypes.length})
                </h3>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {previewData.docTypes.map((dt) => (
                      <div key={dt.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{dt.label}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {dt.category}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {dt.subcategory}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {dt.entity_type}
                            </Badge>
                            <span className="text-gray-400">{dt.native_format}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Emission Periods Preview */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4" />
                  Generated Emission Periods ({previewData.periods.length})
                </h3>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {previewData.periods.map((period, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded bg-gray-50">
                        <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              Period {period.period_number}: {period.period_label}
                            </p>
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              {period.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {formatDateForDisplay(period.period_start)} → {formatDateForDisplay(period.period_end)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Expected by: {formatDateForDisplay(period.expected_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Summary */}
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Summary:</strong> This policy will create {previewData.docTypes.length} document type(s) 
                  and generate <strong>{previewData.periods.length} emission period(s)</strong> 
                  from {formatDateForDisplay(previewData.policy.anchor_date)} to {formatDateForDisplay(previewData.policy.project_end)}.
                </p>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleBackToEdit}
            disabled={isSubmitting || success}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Edit
          </Button>
          
          {!success ? (
            <Button 
              type="button"
              onClick={handleSubmitFromPreview}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Confirm & {isEditMode ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={() => {
                if (onSuccess && typeof onSuccess === 'function') {
                  onSuccess();
                } else {
                  window.location.reload();
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Edit/Create Mode
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" />
          {isEditMode ? 'Edit Emission Policy' : 'Create Emission Policy'}
        </CardTitle>
        <CardDescription>
          Define how periodic documents should be submitted for a project
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <CardContent className="space-y-6">
            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Project Selection with Business Unit Filter */}
            <div className="mb-6 space-y-4">
              {/* Business Unit Selector */}
              <FormField
                control={form.control}
                name="business_unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Business Unit
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "all"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by business unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Business Units</SelectItem>
                        {businessUnits.map((bu) => (
                          <SelectItem key={bu.id} value={bu.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{bu.name}</span>
                              {bu.description && (
                                <span className="text-xs text-gray-500">
                                  {bu.description.substring(0, 50)}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Filter projects by business unit (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Project Selector */}
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Project *
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger className={isEditMode ? 'bg-gray-100' : ''}>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{project.name}</span>
                              <span className="text-xs text-gray-500">
                                {project.code} • {project.business_unit?.name || 'No BU'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        {projects.length === 0 && selectedBusinessUnitId && selectedBusinessUnitId !== "all" && (
                          <div className="p-2 text-sm text-gray-500 text-center">
                            No projects found for this business unit
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the project for this emission policy
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Project Details Summary */}
            {selectedProject && (
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-blue-700">{selectedProject.name}</span>
                    <span className="text-blue-600 ml-2">({selectedProject.code})</span>
                  </div>
                  <div className="text-blue-600">
                    Start: {formatDateForDisplay(selectedProject.start_date)} | End: {formatDateForDisplay(selectedProject.planned_end_date)}
                  </div>
                </div>
              </div>
            )}
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="basic" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <Calendar className="h-4 w-4" />
                  Basic Settings
                </TabsTrigger>
                <TabsTrigger 
                  value="documents" 
                  className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  disabled={!selectedProjectId}
                >
                  <FileText className="h-4 w-4" />
                  Document Types
                  {selectedDocTypeIds.length > 0 && (
                    <Badge className="ml-2 bg-blue-100 text-blue-800 data-[state=active]:bg-white data-[state=active]:text-blue-600">
                      {selectedDocTypeIds.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 pt-4">
                {/* Frequency */}
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How often documents should be submitted
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Anchor Date */}
                <FormField
                  control={form.control}
                  name="anchor_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        First period start date (aligned with project start)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Anchor Day (for weekly only) */}
                {selectedFrequency === 'weekly' && (
                  <FormField
                    control={form.control}
                    name="anchor_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                            <SelectItem value="7">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Day of the week when periods start
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Project End Date (read-only) */}
                <FormField
                  control={form.control}
                  name="project_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project End Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          readOnly 
                          className="bg-gray-100 cursor-not-allowed"
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription className="text-blue-600">
                        Fixed to project planned end date
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., Weekly HSE Reports - Every Monday"
                          className="resize-none"
                          rows={2}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional description of this emission procedure
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Preview */}
                {periodCount !== null && selectedProject && (
                  <div className="bg-blue-50 p-4 rounded-lg mt-4">
                    <h4 className="font-semibold flex items-center gap-2 text-blue-700 mb-2">
                      <Info className="h-4 w-4" />
                      Preview
                    </h4>
                    <p className="text-sm text-blue-700">
                      This policy will generate <strong>{periodCount}</strong> reporting 
                      period{periodCount > 1 ? 's' : ''} from{' '}
                      <strong>{formatDateForDisplay(anchorDate)}</strong> to <strong>{formatDateForDisplay(projectEndDate)}</strong>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedFrequency === 'weekly' && selectedAnchorDay && (
                        <>Periods will start every {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][parseInt(selectedAnchorDay.toString()) - 1]}</>
                      )}
                      {selectedFrequency === 'monthly' && (
                        <>Periods will start on the same day each month</>
                      )}
                      {selectedFrequency === 'daily' && (
                        <>Periods will start every day</>
                      )}
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="documents" className="pt-4">
                {!selectedProjectId ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Please select a project first to view available document types.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Input
                        placeholder="Search document types..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                      <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    
                    {/* Conflict Warning */}
                    {docTypeConflicts.size > 0 && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-700">
                          {docTypeConflicts.size} document type(s) are already assigned to other policies.
                          They have been disabled.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Selection Summary */}
                    {selectedDocTypeIds.length > 0 && (
                      <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-sm text-green-700">
                            <strong>{selectedDocTypeIds.length}</strong> document type(s) selected
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDocTypeIds([])}
                          className="text-green-700 hover:text-green-800 hover:bg-green-100"
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                    
                    {/* Document Types by Category */}
                    <ScrollArea className="h-[400px] pr-4">
                      {searchTerm ? (
                        // Search results view
                        <div className="space-y-4">
                          <h3 className="font-medium text-sm text-gray-500">Search Results</h3>
                          {categories.map(category => (
                            <div key={category.id}>
                              {category.subcategories?.map(sub => 
                                sub.doc_types?.filter(dt => 
                                  dt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  dt.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
                                ).map(dt => (
                                  <div
                                    key={dt.id}
                                    className={`flex items-start space-x-3 p-3 rounded-lg border mb-2 ${
                                      selectedDocTypeIds.includes(dt.id)
                                        ? 'border-blue-200 bg-blue-50'
                                        : docTypeConflicts.has(dt.id)
                                          ? 'border-gray-200 bg-gray-50 opacity-50'
                                          : 'border-gray-200 hover:border-blue-200'
                                    }`}
                                  >
                                    <Checkbox
                                      id={dt.id}
                                      checked={selectedDocTypeIds.includes(dt.id)}
                                      onCheckedChange={() => toggleDocType(dt.id)}
                                      disabled={docTypeConflicts.has(dt.id)}
                                    />
                                    <div className="flex-1">
                                      <label
                                        htmlFor={dt.id}
                                        className="text-sm font-medium leading-none cursor-pointer"
                                      >
                                        {dt.label}
                                      </label>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {category.name} / {sub.name} • {dt.entity_type} • {dt.native_format}
                                      </p>
                                      {docTypeConflicts.has(dt.id) && (
                                        <p className="text-xs text-yellow-600 mt-1">
                                          Already used in: {docTypeConflicts.get(dt.id)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ))}
                          
                          {categories.length === 0 && (
                            <p className="text-center text-gray-500 py-8">
                              No document types match your search
                            </p>
                          )}
                        </div>
                      ) : (
                        // Categorized view
                        <div className="space-y-6">
                          {categories.map(category => (
                            <div key={category.id} className="space-y-2">
                              <div
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                onClick={() => toggleCategory(category.id)}
                              >
                                <ChevronRight
                                  className={`h-4 w-4 transition-transform ${
                                    expandedCategories.has(category.id) ? 'rotate-90' : ''
                                  }`}
                                />
                                <FolderTree className="h-4 w-4 text-gray-500" />
                                <h3 className="font-medium">{category.name}</h3>
                                {category.description && (
                                  <span className="text-xs text-gray-400">• {category.description}</span>
                                )}
                              </div>
                              
                              {expandedCategories.has(category.id) && category.subcategories?.map(sub => {
                                const subDocTypes = docTypes.filter(dt => dt.subcategory_id === sub.id);
                                if (subDocTypes.length === 0) return null;
                                
                                const fullySelected = isSubcategoryFullySelected(sub.id);
                                const partiallySelected = isSubcategoryPartiallySelected(sub.id);
                                
                                return (
                                  <div key={sub.id} className="ml-6 space-y-2 mt-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Tag className="h-3 w-3 text-gray-400" />
                                        <h4 className="text-sm font-medium">{sub.name}</h4>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => selectSubcategory(sub.id, !fullySelected)}
                                      >
                                        {fullySelected ? 'Deselect all' : 'Select all'}
                                      </Button>
                                    </div>
                                    
                                    <div className="space-y-2 pl-4">
                                      {subDocTypes.map(dt => (
                                        <div
                                          key={dt.id}
                                          className={`flex items-start space-x-3 p-2 rounded ${
                                            selectedDocTypeIds.includes(dt.id)
                                              ? 'bg-blue-50'
                                              : docTypeConflicts.has(dt.id)
                                                ? 'bg-gray-50 opacity-50'
                                                : 'hover:bg-gray-50'
                                          }`}
                                        >
                                          <Checkbox
                                            id={dt.id}
                                            checked={selectedDocTypeIds.includes(dt.id)}
                                            onCheckedChange={() => toggleDocType(dt.id)}
                                            disabled={docTypeConflicts.has(dt.id)}
                                          />
                                          <div className="flex-1">
                                            <label
                                              htmlFor={dt.id}
                                              className="text-xs font-medium leading-none cursor-pointer"
                                            >
                                              {dt.label}
                                            </label>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {dt.is_periodic && (
                                                <Badge variant="secondary" className="text-[10px] h-4">
                                                  Periodic
                                                </Badge>
                                              )}
                                              {dt.only_one_per_project && (
                                                <Badge variant="secondary" className="text-[10px] h-4 bg-purple-50">
                                                  Unique
                                                </Badge>
                                              )}
                                              <Badge variant="outline" className="text-[10px] h-4">
                                                {dt.entity_type}
                                              </Badge>
                                            </div>
                                            {docTypeConflicts.has(dt.id) && (
                                              <p className="text-xs text-yellow-600 mt-1">
                                                Used in: {docTypeConflicts.get(dt.id)}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              
                              <Separator className="my-4" />
                            </div>
                          ))}
                          
                          {categories.length === 0 && (
                            <p className="text-center text-gray-500 py-8">
                              No periodic document types found. 
                              Please create periodic document types first.
                            </p>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                    
                    {/* Help Text */}
                    <div className="bg-gray-50 p-3 rounded-lg flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600">
                        Select which document types this emission policy applies to.
                        Each document type can only be assigned to one policy per project.
                        Only periodic document types (is_periodic = true) are shown.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={generatePreview}
              disabled={
                !selectedProjectId ||
                !form.formState.isValid ||
                selectedDocTypeIds.length === 0 ||
                docTypeConflicts.size > 0 ||
                checkingConflicts ||
                loadingProject
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Policy
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export { CreateEmissionPolicy };