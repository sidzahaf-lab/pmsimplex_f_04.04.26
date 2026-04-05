import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Repeat, 
  Info,
  Upload,
  X,
  File,
  Image,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  User,
  Clock,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { DocType } from '@/types/docTypes';
import { 
  debounce, 
  formatFileSize,
  isAllowedFileType,
  getFileExtension
} from '@/lib/utils';
import { saveAs } from 'file-saver';
import { generatePeriodsFromPolicy } from '@/utils/periodGenerator';

const API_BASE_URL = 'http://localhost:3001/api';

// Types pour les utilisateurs
interface User {
  id: string;
  name: string;
  family_name: string;
  email: string;
  job_title?: string;
}

// Types pour les projets
interface Project {
  id: string;
  name: string;
  code: string;
  start_date: string;
  planned_end_date: string;
}

// Types pour les politiques d'émission
interface EmissionPolicy {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  anchor_date: string;
  anchor_day?: number;
  description?: string;
  created_at: string;
}

// Types pour les révisions/périodes
interface DocRevision {
  id: string;
  projdoc_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
  status: 'pending' | 'received' | 'late';
  
  // File fields - null until uploaded
  revision?: number;
  revision_code?: string;
  revision_notes?: string;
  source_filename?: string;
  source_file_size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
}

// Types pour les documents existants
interface ExistingProjDoc {
  id: string;
  doc_number: string;
  title?: string;
  status: string;
  emission_policy?: EmissionPolicy;
  revisions?: DocRevision[];
}

// Fetch project details
const fetchProjectDetails = async (projectId: string): Promise<Project> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
    return response.data.data.project;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
};

// Fetch users
const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users?limit=100`);
    return response.data.data.users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Fetch default policy for a doc type
const fetchDefaultPolicy = async (projectId: string, docTypeId: string): Promise<EmissionPolicy | null> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/doc-types/${docTypeId}/default-policy`
    );
    return response.data.data.policy || null;
  } catch (error) {
    console.error('Error fetching default policy:', error);
    return null;
  }
};

// Check if periodic document already exists
const fetchExistingDoc = async (projectId: string, docTypeId: string): Promise<ExistingProjDoc | null> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/projdocs/project/${projectId}?doc_type_id=${docTypeId}&limit=1&include_revisions=true`
    );
    
    const docs = response.data?.data?.docs || [];
    return docs.length > 0 ? docs[0] : null;
  } catch (error) {
    console.error('Error fetching existing doc:', error);
    return null;
  }
};

// Fetch revisions for a document
const fetchRevisions = async (projdocId: string): Promise<DocRevision[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/doc-revisions/document/${projdocId}`);
    return response.data.data.revisions || [];
  } catch (error) {
    console.error('Error fetching revisions:', error);
    return [];
  }
};

// Download revision
const downloadRevision = async (revisionId: string, filename: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/doc-revisions/${revisionId}/download`,
      { responseType: 'blob' }
    );
    const blob = new Blob([response.data]);
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error downloading file:', error);
  }
};

// Check document number availability
const checkDocNumberAvailability = async (projectId: string, docNumber: string): Promise<{ available: boolean; message?: string }> => {
  if (!docNumber || docNumber.length < 1) return { available: true };
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/projdocs/project/${projectId}/check-number/${encodeURIComponent(docNumber)}`
    );
    return { 
      available: response.data.data.available,
      message: response.data.data.message
    };
  } catch (error: any) {
    console.error('Error checking document number:', error);
    return { available: true, message: 'Error checking document number availability' };
  }
};

// Get file icon based on type
const getFileIcon = (filename: string) => {
  const ext = getFileExtension(filename).toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return <Image className="h-5 w-5 text-blue-500" />;
  }
  if (['pdf'].includes(ext)) {
    return <File className="h-5 w-5 text-red-500" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (['doc', 'docx'].includes(ext)) {
    return <File className="h-5 w-5 text-blue-700" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-yellow-600" />;
  }
  if (['js', 'ts', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-purple-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
};

// Validate file
const validateFile = (
  file: File,
  allowedFormats: string
): { isValid: boolean; message: string } => {
  const allowedFormatsList = allowedFormats
    .split(',')
    .map((f) => f.trim().toLowerCase());
  
  const isValid = isAllowedFileType(file.name, allowedFormatsList);

  if (!isValid) {
    return {
      isValid: false,
      message: `File type not allowed. Allowed formats: ${allowedFormats}`,
    };
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      message: 'File size must not exceed 50MB',
    };
  }

  return { isValid: true, message: 'File is valid' };
};

// Check if upload is allowed for a revision
const isUploadAllowed = (revision: DocRevision): boolean => {
  const today = new Date().toISOString().slice(0, 10);
  return revision.expected_at <= today && revision.status !== 'received';
};

// Get status badge
const getStatusBadge = (status: string, expectedAt: string) => {
  const today = new Date().toISOString().slice(0, 10);
  
  switch (status) {
    case 'received':
      return <Badge className="bg-green-100 text-green-800">Received</Badge>;
    case 'late':
      return <Badge className="bg-red-100 text-red-800">Late</Badge>;
    case 'pending':
      if (expectedAt <= today) {
        return <Badge className="bg-yellow-100 text-yellow-800">Due Now</Badge>;
      }
      return <Badge variant="outline">Pending</Badge>;
    default:
      return null;
  }
};

// Schema for periodic documents
const periodicDocSchema = z.object({
  doc_number: z.string()
    .min(1, 'Document number is required')
    .max(150, 'Document number must be less than 150 characters')
    .regex(/^[A-Za-z0-9\-_./]+$/, 'Document number can only contain letters, numbers, hyphens, underscores, dots and slashes'),
  
  title: z.string()
    .max(250, 'Title must be less than 250 characters')
    .optional()
    .or(z.literal('')),
  
  // Revision fields
  revision_code: z.string()
    .max(50, 'Revision code must be less than 50 characters')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Revision code can only contain letters, numbers, hyphens and underscores')
    .optional()
    .or(z.literal('')),
  
  revision_notes: z.string()
    .optional()
    .or(z.literal('')),
  
  uploaded_by: z.string().uuid('Please select a valid user'),
  
  // Period selection
  period_id: z.string().uuid('Please select a period').optional(),
  period_label: z.string().optional(),
});

type PeriodicFormValues = z.infer<typeof periodicDocSchema>;

// Scénarios possibles
type Scenario = 
  | 'loading'
  | 'new_doc'           // Document n'existe pas, policy trouvée
  | 'no_policy'         // Document n'existe pas, mais pas de policy trouvée
  | 'new_version'       // Document ad-hoc existant
  | 'periodic_existing' // Document périodique existant avec révisions
  | 'period_due'        // Document périodique avec période due aujourd'hui
  | 'period_not_due';   // Document périodique sans période due

interface FormPeriodicProps {
  projectId: string;
  docType: DocType;
  onSuccess: () => void;
  onCancel: () => void;
}

const FormPeriodic: React.FC<FormPeriodicProps> = ({ 
  projectId, 
  docType, 
  onSuccess, 
  onCancel 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationState, setFileValidationState] = useState<{
    isValid: boolean | null;
    message: string;
  }>({ isValid: null, message: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Project
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  
  // Scenario detection
  const [scenario, setScenario] = useState<Scenario>('loading');
  const [detectedPolicy, setDetectedPolicy] = useState<EmissionPolicy | null>(null);
  const [existingDoc, setExistingDoc] = useState<ExistingProjDoc | null>(null);
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  
  // Selected period for upload
  const [selectedPeriod, setSelectedPeriod] = useState<DocRevision | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PeriodicFormValues>({
    resolver: zodResolver(periodicDocSchema),
    defaultValues: {
      doc_number: '',
      title: '',
      revision_code: '',
      revision_notes: '',
      uploaded_by: '',
    },
    mode: 'onChange',
  });

  // Load project and users on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingProject(true);
        setLoadingUsers(true);
        
        const [projectData, usersList] = await Promise.all([
          fetchProjectDetails(projectId),
          fetchUsers()
        ]);
        
        setProject(projectData);
        setUsers(usersList);
        
        if (usersList.length > 0) {
          form.setValue('uploaded_by', usersList[0].id);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load project details');
      } finally {
        setLoadingProject(false);
        setLoadingUsers(false);
      }
    };
    
    loadInitialData();
  }, [projectId, form]);

  // Detect scenario when docType changes
  useEffect(() => {
    const detectScenario = async () => {
      if (!docType || !projectId) return;
      
      setScenario('loading');
      
      try {
        // Check if document already exists
        const existing = await fetchExistingDoc(projectId, docType.id);
        setExistingDoc(existing);
        
        if (existing) {
          console.log('📋 Existing document found:', existing);
          
          if (docType.is_periodic) {
            // Periodic document exists - load its revisions
            setScenario('periodic_existing');
            
            if (existing.id) {
              setLoadingRevisions(true);
              const revs = await fetchRevisions(existing.id);
              setRevisions(revs);
              setLoadingRevisions(false);
              
              // Check for due periods
              const today = new Date().toISOString().slice(0, 10);
              const duePeriod = revs.find(r => 
                r.expected_at <= today && r.status !== 'received'
              );
              
              if (duePeriod) {
                setScenario('period_due');
                setSelectedPeriod(duePeriod);
              } else {
                setScenario('period_not_due');
              }
            }
          } else {
            // Ad-hoc document exists
            setScenario('new_version');
          }
        } else {
          // No existing document
          if (docType.is_periodic) {
            // Try to find default policy for periodic document
            const policy = await fetchDefaultPolicy(projectId, docType.id);
            setDetectedPolicy(policy);
            
            if (policy) {
              setScenario('new_doc');
            } else {
              setScenario('no_policy');
            }
          } else {
            // Ad-hoc document
            setScenario('new_doc');
          }
        }
      } catch (error) {
        console.error('Error detecting scenario:', error);
        setError('Failed to determine document status');
        setScenario('new_doc');
      }
    };
    
    detectScenario();
  }, [projectId, docType]);

  // Check document number availability
  const [docNumberState, setDocNumberState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const debouncedDocNumberCheck = useCallback(
    debounce(async (docNumber: string) => {
      if (!docNumber || docNumber.length < 1 || existingDoc) {
        setDocNumberState({ checking: false, available: null, message: '' });
        return;
      }

      setDocNumberState({
        checking: true,
        available: null,
        message: 'Checking document number availability...'
      });

      try {
        const result = await checkDocNumberAvailability(projectId, docNumber);
        setDocNumberState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Document number is available' : 'Document number already exists')
        });
        form.trigger('doc_number');
      } catch (error) {
        setDocNumberState({
          checking: false,
          available: null,
          message: 'Error checking document number availability'
        });
      }
    }, 800),
    [projectId, form, existingDoc]
  );

  // Watch for document number changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'doc_number' && type === 'change' && !existingDoc) {
        const docNumber = value.doc_number;
        setDocNumberState({ checking: false, available: null, message: '' });
        if (docNumber && docNumber.length >= 1) {
          debouncedDocNumberCheck(docNumber as string);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedDocNumberCheck, existingDoc]);

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file, docType.native_format);

    if (!validation.isValid) {
      setFileValidationState({ isValid: false, message: validation.message });
      return;
    }

    setSelectedFile(file);
    setFileValidationState({ isValid: true, message: 'File selected successfully' });
    setUploadProgress(0);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileValidationState({ isValid: null, message: '' });
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownloadRevision = async (revision: DocRevision) => {
    if (revision.id && revision.source_filename) {
      await downloadRevision(revision.id, revision.source_filename);
    }
  };

  const handleSelectPeriod = (revision: DocRevision) => {
    if (isUploadAllowed(revision)) {
      setSelectedPeriod(revision);
      form.setValue('period_id', revision.id);
      form.setValue('period_label', revision.period_label);
    }
  };

  // Get today's date for comparison
  const today = new Date().toISOString().slice(0, 10);

  // Determine if upload button should be enabled
  const canUpload = selectedPeriod && isUploadAllowed(selectedPeriod) && selectedFile && fileValidationState.isValid === true;

  // Generate document number suggestion (simplified)
  const generateDocNumber = () => {
    if (!project) return '';
    const projectCode = project.code || 'PRJ';
    const docTypeCode = docType.label.substring(0, 3).toUpperCase();
    return `${projectCode}-${docTypeCode}-001`;
  };

  // Auto-fill document number for new docs
  useEffect(() => {
    if (scenario === 'new_doc' && !existingDoc && !form.getValues('doc_number')) {
      form.setValue('doc_number', generateDocNumber());
    }
  }, [scenario, existingDoc, project, docType, form]);

  // ========== CORRECTED onSubmit function with frontend-generated periods ==========
  const onSubmit = async (values: PeriodicFormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // CAS 1: Nouveau document périodique avec périodes générées en frontend
// CAS 1: Nouveau document périodique
if (scenario === 'new_doc' && detectedPolicy && !existingDoc) {
  console.log('📤 Création d\'un nouveau document périodique...');
  console.log('Policy ID:', detectedPolicy.id);
  
  // Créer le document dans projdocs avec emission_id
  const requestBody = {
    doc_type_id: docType.id,
    doc_number: values.doc_number,
    title: values.title || null,
    emission_id: detectedPolicy.id // 🔥 Lier à la politique
  };
  
  console.log('Request body:', requestBody);
  
  const response = await axios.post(
    `${API_BASE_URL}/projdocs/project/${projectId}`, 
    requestBody
  );
  
  if (response.data.status === 'success') {
    const newDoc = response.data.data.doc;
    console.log('✅ Document créé dans projdocs:', newDoc.id);
    
    // Les périodes existent déjà dans la base de données
    // car elles ont été créées lors de la création de la politique
    
    onSuccess();
  }
}      
      // CAS 2: Upload d'une révision pour une période existante
      else if ((scenario === 'period_due' || (scenario === 'periodic_existing' && selectedPeriod)) && selectedPeriod && selectedFile) {
        console.log('📤 Upload d\'une révision pour la période:', selectedPeriod.period_label);
        console.log('Document ID:', existingDoc?.id);
        console.log('Period ID:', selectedPeriod.id);
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('period_id', selectedPeriod.id); // 🔥 Important: lier à la période
        formData.append('revision_code', values.revision_code || '');
        formData.append('revision_notes', values.revision_notes || '');
        formData.append('uploaded_by', values.uploaded_by);
        
        const response = await axios.post(
          `${API_BASE_URL}/projdocs/${existingDoc!.id}/revisions`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percentCompleted);
              }
            }
          }
        );
        
        if (response.data.status === 'success') {
          onSuccess();
        }
      }
      
      // CAS 3: Nouvelle version d'un document ad-hoc existant
      else if (scenario === 'new_version' && existingDoc && selectedFile) {
        console.log('📤 Upload d\'une nouvelle version du document ad-hoc');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('revision_code', values.revision_code || '');
        formData.append('revision_notes', values.revision_notes || '');
        formData.append('uploaded_by', values.uploaded_by);
        
        const response = await axios.post(
          `${API_BASE_URL}/projdocs/${existingDoc.id}/revisions`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percentCompleted);
              }
            }
          }
        );
        
        if (response.data.status === 'success') {
          onSuccess();
        }
      }
      
      // CAS 4: Nouveau document ad-hoc avec fichier
      else if (scenario === 'new_doc' && !docType.is_periodic && selectedFile) {
        console.log('📤 Création d\'un nouveau document ad-hoc avec fichier');
        
        // Créer le document ad-hoc
        const docResponse = await axios.post(`${API_BASE_URL}/projdocs/project/${projectId}`, {
          doc_type_id: docType.id,
          doc_number: values.doc_number,
          title: values.title || null
        });
        
        if (docResponse.data.status === 'success') {
          const newDocId = docResponse.data.data.doc.id;
          console.log('✅ Document ad-hoc créé:', newDocId);
          
          // Uploader le fichier comme première révision
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('revision_code', values.revision_code || '');
          formData.append('revision_notes', values.revision_notes || '');
          formData.append('uploaded_by', values.uploaded_by);
          
          await axios.post(
            `${API_BASE_URL}/projdocs/${newDocId}/revisions`,
            formData,
            {
              headers: { 'Content-Type': 'multipart/form-data' },
              onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                  const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                  setUploadProgress(percentCompleted);
                }
              }
            }
          );
          
          onSuccess();
        }
      }
      
      // CAS 5: Nouveau document périodique SANS fichier (création seulement)
      else if (scenario === 'new_doc' && detectedPolicy && !existingDoc && !selectedFile) {
        console.log('📤 Création d\'un nouveau document périodique sans fichier');
        
        // Générer les périodes
        const periods = generatePeriodsFromPolicy({
          frequency: detectedPolicy.frequency,
          anchor_date: detectedPolicy.anchor_date,
          anchor_day: detectedPolicy.anchor_day,
          project_end_date: project?.planned_end_date
        });
        
        // Créer seulement le document (sans upload)
        const response = await axios.post(`${API_BASE_URL}/projdocs/project/${projectId}/with-periods`, {
          doc_type_id: docType.id,
          doc_number: values.doc_number,
          title: values.title || null,
          emission_policy_id: detectedPolicy.id,
          periods: periods
        });
        
        if (response.data.status === 'success') {
          onSuccess();
        }
      }
      
      // CAS 6: Erreur - cas non géré
      else {
        console.error('Cas non géré:', { 
          scenario, 
          existingDoc: !!existingDoc, 
          selectedPeriod: !!selectedPeriod, 
          selectedFile: !!selectedFile,
          isPeriodic: docType.is_periodic
        });
        setError('Unable to process request. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Erreur lors de la soumission:', error);
      
      let errorMessage = 'Une erreur est survenue';
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        
        if (error.response.status === 404) {
          errorMessage = `Endpoint non trouvé: ${error.config?.method?.toUpperCase()} ${error.config?.url}`;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = `Erreur serveur: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = 'Pas de réponse du serveur. Vérifiez votre connexion.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Render loading state
  if (scenario === 'loading' || loadingProject || loadingUsers) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span>Analyzing document type...</span>
        </CardContent>
      </Card>
    );
  }

  // Render no policy scenario
  if (scenario === 'no_policy') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Emission Policy Configured</h3>
            <p className="text-gray-600 mb-4">
              This document type requires an emission policy, but none has been configured for this project.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please contact your project administrator to set up a policy for {docType.label}.
            </p>
            <Button onClick={onCancel}>Close</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render periodic existing document view
  if (scenario === 'periodic_existing' && existingDoc) {
    const duePeriods = revisions.filter(r => r.expected_at <= today && r.status !== 'received');
    const futurePeriods = revisions.filter(r => r.expected_at > today);
    const receivedPeriods = revisions.filter(r => r.status === 'received');
    
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Document Info */}
              <div className="p-4 bg-blue-50 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">{existingDoc.doc_number}</span>
                  <Badge className="bg-blue-100">{docType.label}</Badge>
                </div>
                {existingDoc.title && (
                  <p className="text-sm text-blue-600 mt-1">{existingDoc.title}</p>
                )}
              </div>

              {/* Periods Tabs */}
              <Tabs defaultValue="due" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="due" className="relative">
                    Due Now
                    {duePeriods.length > 0 && (
                      <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                        {duePeriods.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="future">
                    Upcoming
                    {futurePeriods.length > 0 && (
                      <Badge className="ml-2 bg-gray-100">{futurePeriods.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="received">
                    Received
                    {receivedPeriods.length > 0 && (
                      <Badge className="ml-2 bg-green-100">{receivedPeriods.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="due" className="space-y-2 mt-4">
                  {duePeriods.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No periods due at this time</p>
                  ) : (
                    duePeriods.map(period => (
                      <PeriodCard
                        key={period.id}
                        period={period}
                        isSelected={selectedPeriod?.id === period.id}
                        onSelect={() => handleSelectPeriod(period)}
                        onDownload={() => handleDownloadRevision(period)}
                        isUploadAllowed={isUploadAllowed(period)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="future" className="space-y-2 mt-4">
                  {futurePeriods.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No upcoming periods</p>
                  ) : (
                    futurePeriods.map(period => (
                      <PeriodCard
                        key={period.id}
                        period={period}
                        isSelected={false}
                        onSelect={() => {}}
                        onDownload={() => {}}
                        isUploadAllowed={false}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="received" className="space-y-2 mt-4">
                  {receivedPeriods.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No received periods</p>
                  ) : (
                    receivedPeriods.map(period => (
                      <PeriodCard
                        key={period.id}
                        period={period}
                        isSelected={false}
                        onSelect={() => {}}
                        onDownload={() => handleDownloadRevision(period)}
                        isUploadAllowed={false}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>

              {/* Revision Fields */}
              {selectedPeriod && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-4">Upload for {selectedPeriod.period_label}</h4>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="revision_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Revision Code</FormLabel>
                          <FormControl>
                            <Input placeholder="R0, B1, C2, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="revision_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Revision Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Notes about this revision"
                              className="resize-none"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uploaded_by"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <User className="h-4 w-4 mr-2 text-gray-500" />
                            Uploaded By *
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {user.name} {user.family_name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {user.email}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* File Upload */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : selectedFile
                          ? fileValidationState.isValid === true
                            ? 'border-green-500 bg-green-50'
                            : 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleTriggerFileInput}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept={docType.native_format
                          .split(',')
                          .map((f) => f.trim())
                          .join(',')}
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />

                      {selectedFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center">
                            {getFileIcon(selectedFile.name)}
                            <span className="ml-2 font-medium">{selectedFile.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile();
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            Drag & drop or click to select file
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Allowed: {docType.native_format}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!canUpload || isSubmitting || !form.getValues('uploaded_by')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                </>
              ) : (
                'Upload Document'
              )}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  // Render new document form (both periodic and ad-hoc)
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Document Type Info */}
            <div className={`p-4 rounded-lg mb-4 ${detectedPolicy ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 text-sm text-blue-700">
                {docType.is_periodic ? (
                  <Repeat className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span className="font-medium">{docType.label}</span>
                {docType.only_one_per_project && (
                  <Badge className="bg-purple-100 text-purple-800">Unique per project</Badge>
                )}
              </div>
              
              {detectedPolicy && docType.is_periodic && (
                <div className="mt-2 text-sm bg-green-50 p-2 rounded border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Policy detected:</span>
                    <span>{detectedPolicy.frequency} · {
                      detectedPolicy.frequency === 'weekly' 
                        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(detectedPolicy.anchor_day || 1) - 1]
                        : `Starts ${detectedPolicy.anchor_date}`
                    }</span>
                  </div>
                  {detectedPolicy.description && (
                    <p className="text-xs text-green-600 mt-1 ml-6">{detectedPolicy.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Document Number */}
            <FormField
              control={form.control}
              name="doc_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Number *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="PRJ-HSE-001" 
                        {...field}
                        readOnly={!!existingDoc}
                        onChange={(e) => {
                          if (!existingDoc) {
                            field.onChange(e);
                            setDocNumberState({ checking: false, available: null, message: '' });
                          }
                        }}
                        className={
                          existingDoc ? 'bg-gray-100' :
                          docNumberState.checking ? 'border-yellow-500 pr-10' :
                          form.formState.errors.doc_number ? 'border-red-500 pr-10' :
                          docNumberState.available === true ? 'border-green-500 pr-10' :
                          docNumberState.available === false ? 'border-red-500 pr-10' :
                          'pr-10'
                        }
                      />
                      {!existingDoc && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {docNumberState.checking && (
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                          )}
                          {!docNumberState.checking && docNumberState.available === true && !form.formState.errors.doc_number && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {!docNumberState.checking && (docNumberState.available === false || form.formState.errors.doc_number) && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  
                  {!existingDoc && docNumberState.checking && (
                    <div className="flex items-center text-yellow-600 text-sm mt-1">
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Checking availability...
                    </div>
                  )}
                  
                  {!existingDoc && !docNumberState.checking && docNumberState.message && (
                    <div className={`flex items-center text-sm mt-1 ${
                      docNumberState.available === true ? 'text-green-600' : 
                      docNumberState.available === false ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {docNumberState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                      {docNumberState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                      {docNumberState.message}
                    </div>
                  )}
                  
                  <FormDescription>
                    {existingDoc 
                      ? 'This document number is fixed'
                      : 'Unique document number for this project'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Weekly HSE Report"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional title or description
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Selection */}
            <FormField
              control={form.control}
              name="uploaded_by"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Uploaded By *
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {user.name} {user.family_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {user.email}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Policy Info - Read-only for new periodic docs */}
            {detectedPolicy && docType.is_periodic && (
              <div className="border-t pt-4 mt-2">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Emission Schedule
                </h3>
                
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frequency:</span>
                    <span className="font-medium capitalize">{detectedPolicy.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start date:</span>
                    <span className="font-medium">{detectedPolicy.anchor_date}</span>
                  </div>
                  {detectedPolicy.frequency === 'weekly' && detectedPolicy.anchor_day && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Day of week:</span>
                      <span className="font-medium">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][detectedPolicy.anchor_day - 1]}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project end:</span>
                    <span className="font-medium">{project?.planned_end_date}</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    All reporting periods will be automatically generated and sent to the server.
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={
              isSubmitting || 
              !form.formState.isValid || 
              (!existingDoc && docNumberState.available === false) ||
              !form.getValues('uploaded_by')
            }
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Document'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Helper component for period cards
const PeriodCard: React.FC<{
  period: DocRevision;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  isUploadAllowed: boolean;
}> = ({ period, isSelected, onSelect, onDownload, isUploadAllowed }) => {
  const today = new Date().toISOString().slice(0, 10);
  
  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
          : period.status === 'received'
            ? 'border-green-200 bg-green-50'
            : period.status === 'late'
              ? 'border-red-200 bg-red-50'
              : period.expected_at <= today
                ? 'border-yellow-200 bg-yellow-50 cursor-pointer hover:border-yellow-300'
                : 'border-gray-200 bg-gray-50'
      }`}
      onClick={isUploadAllowed ? onSelect : undefined}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold">{period.period_label}</span>
            {getStatusBadge(period.status, period.expected_at)}
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Period:</span>
              <span className="ml-1">{period.period_start} to {period.period_end}</span>
            </div>
            <div>
              <span className="text-gray-500">Due:</span>
              <span className={`ml-1 font-medium ${
                period.expected_at < today && period.status !== 'received' ? 'text-red-600' : ''
              }`}>
                {period.expected_at}
              </span>
            </div>
            {period.status === 'received' && period.revision && (
              <div>
                <span className="text-gray-500">Rev:</span>
                <span className="ml-1">{period.revision}</span>
              </div>
            )}
          </div>
          
          {period.status === 'received' && period.source_filename && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              {getFileIcon(period.source_filename)}
              <span className="text-gray-700">{period.source_filename}</span>
              {period.source_file_size && (
                <span className="text-xs text-gray-500">
                  ({formatFileSize(period.source_file_size)})
                </span>
              )}
            </div>
          )}
        </div>
        
        {period.status === 'received' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="ml-4 flex-shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        ) : isUploadAllowed ? (
          <Button
            type="button"
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            className="ml-4 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        ) : (
          <Badge variant="outline" className="ml-4 flex-shrink-0">
            Available from {period.expected_at}
          </Badge>
        )}
      </div>
      
      {period.revision_notes && (
        <p className="text-sm text-gray-600 mt-2 border-t pt-2">
          {period.revision_notes}
        </p>
      )}
    </div>
  );
};

export default FormPeriodic;