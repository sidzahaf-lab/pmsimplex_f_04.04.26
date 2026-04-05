// src/components/documents/FormAdHoc.tsx
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
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Upload,
  X,
  File,
  Image,
  HardDrive,
  Check,
  User,
  Download,
  History,
  Info,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Search
} from 'lucide-react';
import axios from 'axios';
import { DocType } from '@/types/docTypes';
import { debounce, formatFileSize, isAllowedFileType, getFileExtension, parseErrorMessage } from '@/lib/utils';
import { saveAs } from 'file-saver';

const API_BASE_URL = 'http://localhost:3001/api';

// Types pour les utilisateurs
interface User {
  id: string;
  name: string;
  family_name: string;
  email: string;
  job_title?: string;
}

// Types pour les révisions
interface DocRevision {
  id: string;
  revision: number;
  revision_code?: string;
  source_filename: string;
  source_file_path?: string;
  uploaded_at: string;
  uploaded_by?: string;
  uploader?: {
    name: string;
    family_name: string;
  };
}

interface ProjDoc {
  id: string;
  doc_number: string;
  title?: string;
  status: string;
  latest_revision?: DocRevision;
  revisions?: DocRevision[];
}

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

// Vérifier si un document unique existe déjà pour ce projet
const checkUniqueDocumentExists = async (
  projectId: string,
  docTypeId: string
): Promise<{ exists: boolean; document?: ProjDoc }> => {
  try {
    console.log(`🔍 Checking if unique document exists for project ${projectId}, docType ${docTypeId}`);
    
    const response = await axios.get(
      `${API_BASE_URL}/projdocs/project/${projectId}?doc_type_id=${docTypeId}&limit=1`
    );
    
    const docs = response.data?.data?.docs || [];
    
    if (docs.length > 0) {
      console.log('✅ Unique document found:', docs[0]);
      return { exists: true, document: docs[0] };
    }
    
    console.log('ℹ️ No existing document found for this type');
    return { exists: false };
  } catch (error) {
    console.error('Error checking unique document:', error);
    return { exists: false };
  }
};

// Fetch users from API
const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users?limit=100`);
    return response.data.data.users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Validate file type
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

// Schema for ad-hoc documents
const adHocDocSchema = z.object({
  doc_number: z
    .string()
    .min(1, 'Document number is required')
    .max(150, 'Document number must be less than 150 characters')
    .regex(
      /^[A-Za-z0-9\-_./]+$/,
      'Document number can only contain letters, numbers, hyphens, underscores, dots and slashes'
    )
    .optional(),
  title: z
    .string()
    .max(250, 'Title must be less than 250 characters')
    .optional()
    .or(z.literal('')),
  revision_code: z
    .string()
    .max(50, 'Revision code must be less than 50 characters')
    .regex(
      /^[A-Za-z0-9\-_]+$/,
      'Revision code can only contain letters, numbers, hyphens and underscores'
    )
    .optional()
    .or(z.literal('')),
  revision_notes: z.string().optional().or(z.literal('')),
  uploaded_by: z.string().uuid('Please select a valid user'),
});

type AdHocFormValues = z.infer<typeof adHocDocSchema>;

interface FormAdHocProps {
  projectId: string;
  docType: DocType;
  onSuccess: () => void;
  onCancel: () => void;
}

const FormAdHoc: React.FC<FormAdHocProps> = ({
  projectId,
  docType,
  onSuccess,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationState, setFileValidationState] = useState<{
    isValid: boolean | null;
    message: string;
  }>({ isValid: null, message: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [existingDocument, setExistingDocument] = useState<ProjDoc | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  const [docNumberState, setDocNumberState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AdHocFormValues>({
    resolver: zodResolver(adHocDocSchema),
    defaultValues: {
      doc_number: docType.only_one_per_project ? '' : '',
      title: '',
      revision_code: '',
      revision_notes: '',
      uploaded_by: '',
    },
    mode: 'onChange',
  });

  // Vérifier immédiatement si c'est un document unique et s'il existe déjà
  useEffect(() => {
    const checkExisting = async () => {
      if (docType.only_one_per_project) {
        setCheckingExisting(true);
        const result = await checkUniqueDocumentExists(projectId, docType.id);
        
        if (result.exists && result.document) {
          console.log('📋 Document unique existant trouvé:', result.document);
          setExistingDocument(result.document);
          form.setValue('doc_number', result.document.doc_number);
        } else {
          console.log('📝 Aucun document existant, création nouvelle');
          setExistingDocument(null);
        }
        
        setCheckingExisting(false);
      }
    };
    
    checkExisting();
  }, [projectId, docType.id, docType.only_one_per_project, form]);

  // Load users on component mount
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const usersList = await fetchUsers();
      setUsers(usersList);
      setLoadingUsers(false);
      
      if (usersList.length > 0 && !form.getValues('uploaded_by')) {
        form.setValue('uploaded_by', usersList[0].id);
      }
    };
    
    loadUsers();
  }, [form]);

  // Debounced document number check
  const debouncedDocNumberCheck = useCallback(
    debounce(async (docNumber: string) => {
      if (!docNumber || docNumber.length < 1) {
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
    [projectId, form]
  );

  // Watch for document number changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'doc_number' && type === 'change') {
        const docNumber = value.doc_number;
        setDocNumberState({ checking: false, available: null, message: '' });
        if (docNumber && docNumber.length >= 1) {
          debouncedDocNumberCheck(docNumber as string);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedDocNumberCheck]);

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file, docType.native_format);

    if (!validation.isValid) {
      setFileValidationState({ isValid: false, message: validation.message });
      setSelectedFile(file); // Still set the file but show error
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

  // Télécharger la dernière révision
  const handleDownloadLatest = async () => {
    if (!existingDocument?.latest_revision) return;
    
    setDownloading(existingDocument.latest_revision.id);
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/doc-revisions/${existingDocument.latest_revision.id}/download`,
        { 
          responseType: 'blob',
          timeout: 30000
        }
      );
      
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      
      saveAs(blob, existingDocument.latest_revision.source_filename);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const onSubmit = async (data: AdHocFormValues) => {
    // Si le document existe déjà, on veut uploader une nouvelle révision
    if (existingDocument) {
      if (!selectedFile) {
        setFileValidationState({
          isValid: false,
          message: 'Please select a file to upload as new revision',
        });
        return;
      }

      // Check file validation before submitting
      if (fileValidationState.isValid !== true) {
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setUploadProgress(10);

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (data.revision_code) formData.append('revision_code', data.revision_code);
        if (data.revision_notes) formData.append('revision_notes', data.revision_notes);
        if (data.uploaded_by) formData.append('uploaded_by', data.uploaded_by);

        setUploadProgress(30);

        const uploadUrl = `${API_BASE_URL}/doc-revisions/projdocs/${existingDocument.id}/revisions`;
        console.log('📤 Uploading new revision to:', uploadUrl);

        await axios.post(uploadUrl, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(30 + (percentCompleted * 0.7));
            }
          },
        });

        setUploadProgress(100);
        console.log('✅ New revision created');
        onSuccess();
      } catch (err: any) {
        console.error('❌ Error uploading revision:', err);
        setError(parseErrorMessage(err));
        setUploadProgress(0);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Si le document n'existe pas, on crée un nouveau document avec sa première révision
    if (!selectedFile) {
      setFileValidationState({
        isValid: false,
        message: 'Please select a file to upload',
      });
      return;
    }

    if (fileValidationState.isValid !== true) return;

    // Vérifier que le numéro de document est fourni
    if (!data.doc_number && !docType.only_one_per_project) {
      setError('Document number is required');
      return;
    }

    // Final check before submitting
    const availabilityCheck = await checkDocNumberAvailability(projectId, data.doc_number || '');
    if (!availabilityCheck.available) {
      setError('Document number already exists. Please choose a different number.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(10);

    try {
      setUploadProgress(20);

      // 1. Créer le document
      const docPayload = {
        doc_type_id: docType.id,
        doc_number: data.doc_number?.trim() || `DOC-${Date.now()}`,
        title: data.title || null,
        entity_meta: {},
      };

      console.log('📝 Creating document:', docPayload);

      const docResponse = await axios.post(
        `${API_BASE_URL}/projdocs/project/${projectId}`,
        docPayload
      );

      const projdocId: string = docResponse.data.data.doc.id;
      console.log('✅ Document created with ID:', projdocId);

      setUploadProgress(40);

      // 2. Construire FormData
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (data.revision_code) formData.append('revision_code', data.revision_code);
      if (data.revision_notes) formData.append('revision_notes', data.revision_notes);
      if (data.uploaded_by) formData.append('uploaded_by', data.uploaded_by);

      setUploadProgress(60);

      // 3. Upload de la révision
      const uploadUrl = `${API_BASE_URL}/doc-revisions/projdocs/${projdocId}/revisions`;
      console.log('📤 Uploading to:', uploadUrl);

      await axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(60 + (percentCompleted * 0.4));
          }
        },
      });

      setUploadProgress(100);
      console.log('✅ Document created successfully');
      onSuccess();
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(parseErrorMessage(err));
      setUploadProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Afficher un loader pendant la vérification
  if (checkingExisting) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span>Checking if document already exists...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          {/* Card Header with Title and Actions */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold">{docType.label}</h2>
                {docType.only_one_per_project && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    Unique per project
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {/* Search functionality */}}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !selectedFile ||
                    fileValidationState.isValid !== true ||
                    !form.formState.isValid ||
                    !form.getValues('uploaded_by') ||
                    (!existingDocument && docNumberState.available === false)
                  }
                  size="sm"
                  className="min-w-[100px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                    </>
                  ) : (
                    existingDocument ? 'Upload' : 'Create Document'
                  )}
                </Button>
              </div>
            </div>
            {existingDocument && (
              <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg flex items-center">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                This document already exists. You can upload a new revision.
              </div>
            )}
          </div>

          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Document Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Document Information
                  </h3>

                  {/* Document Number */}
                  <FormField
                    control={form.control}
                    name="doc_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Number {!existingDocument && '*'}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="PRJ-SCH-001"
                              {...field}
                              value={field.value || ''}
                              readOnly={!!existingDocument}
                              onChange={(e) => {
                                if (!existingDocument) {
                                  field.onChange(e);
                                  setDocNumberState({ checking: false, available: null, message: '' });
                                }
                              }}
                              className={
                                existingDocument ? 'bg-gray-100' :
                                docNumberState.checking ? 'border-yellow-500 pr-10' :
                                form.formState.errors.doc_number ? 'border-red-500 pr-10' :
                                docNumberState.available === true ? 'border-green-500 pr-10' :
                                docNumberState.available === false ? 'border-red-500 pr-10' :
                                'pr-10'
                              }
                            />
                            {!existingDocument && (
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
                        
                        {/* Status Message */}
                        {!existingDocument && docNumberState.checking && (
                          <div className="flex items-center text-yellow-600 text-sm mt-1">
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Checking document number availability...
                          </div>
                        )}
                        
                        {!existingDocument && !docNumberState.checking && docNumberState.message && (
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
                          {existingDocument 
                            ? 'This document number is fixed and cannot be changed'
                            : 'Unique document number for this project'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Title - Masquer si document existe déjà */}
                  {!existingDocument && (
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Document title or description"
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Optional title or description of the document</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Revision Code */}
                  <FormField
                    control={form.control}
                    name="revision_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revision Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={existingDocument ? "R1, B2, C3, etc." : "R0, B1, C2, etc."} 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {existingDocument 
                            ? 'Optional revision identifier for this new revision'
                            : 'Optional revision identifier for the first revision'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Revision Notes */}
                  <FormField
                    control={form.control}
                    name="revision_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revision Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={existingDocument 
                              ? "Reason for this new revision or changes made"
                              : "Reason for this revision or additional notes"}
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Right Column - Upload & User Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Upload Information
                  </h3>

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
                            {loadingUsers ? (
                              <SelectItem value="loading" disabled>
                                <div className="flex items-center">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Loading users...
                                </div>
                              </SelectItem>
                            ) : users.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No users available
                              </SelectItem>
                            ) : (
                              users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {user.name} {user.family_name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {user.email} {user.job_title && `• ${user.job_title}`}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the user who is uploading this {existingDocument ? 'new revision' : 'document'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* File Upload Area */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center">
                      <Upload className="h-4 w-4 mr-2 text-blue-600" />
                      {existingDocument ? 'New Revision File *' : 'Document File *'}
                    </h4>

                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : selectedFile
                          ? fileValidationState.isValid === true
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
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
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <div
                              className={`p-2 rounded-full ${
                                fileValidationState.isValid === true
                                  ? 'bg-green-100'
                                  : 'bg-red-100'
                              }`}
                            >
                              {fileValidationState.isValid === true ? (
                                <Check className="h-6 w-6 text-green-600" />
                              ) : (
                                <AlertCircle className="h-6 w-6 text-red-600" />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-sm">
                            {getFileIcon(selectedFile.name)}
                            <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                          </div>

                          <div className="text-xs text-gray-500">
                            {formatFileSize(selectedFile.size)}
                          </div>

                          {/* File Validation Message */}
                          {fileValidationState.message && (
                            <div className="text-left">
                              <div
                                className={`flex items-center text-sm font-medium ${
                                  fileValidationState.isValid === true
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {fileValidationState.isValid === true ? (
                                  <CheckCircle2 className="h-4 w-4 mr-1 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                                )}
                                {fileValidationState.message}
                              </div>
                            </div>
                          )}

                          {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Uploading...</span>
                                <span>{Math.round(uploadProgress)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile();
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-center mb-2">
                            <div className="p-2 bg-blue-100 rounded-full">
                              <Upload className="h-6 w-6 text-blue-600" />
                            </div>
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {isDragging ? 'Drop file here' : 'Drag & drop or click to select'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Max 50MB • Allowed: {docType.native_format}
                          </p>
                          {existingDocument && existingDocument.latest_revision && (
                            <p className="text-xs text-blue-600 mt-2">
                              New revision will be Rev {existingDocument.latest_revision.revision + 1}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Existing Document Info - Full width when present */}
              {existingDocument && existingDocument.latest_revision && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-3 flex items-center text-blue-800">
                    <FileText className="h-4 w-4 mr-2" />
                    Current Document Status
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600 text-xs">Document Number</span>
                      <div className="font-medium">{existingDocument.doc_number}</div>
                    </div>
                    <div>
                      <span className="text-blue-600 text-xs">Title</span>
                      <div className="font-medium">{existingDocument.title || 'No title'}</div>
                    </div>
                    <div>
                      <span className="text-blue-600 text-xs">Latest Revision</span>
                      <div className="font-medium">
                        Rev {existingDocument.latest_revision.revision}
                        {existingDocument.latest_revision.revision_code && 
                          ` (${existingDocument.latest_revision.revision_code})`}
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600 text-xs">Filename</span>
                      <div className="font-medium text-xs truncate">
                        {existingDocument.latest_revision.source_filename}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadLatest}
                      disabled={downloading === existingDocument.latest_revision.id}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {downloading === existingDocument.latest_revision.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download Latest
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/projdocs/${existingDocument.id}/revisions`, '_blank')}
                      className="border-gray-300"
                    >
                      <History className="h-4 w-4 mr-2" />
                      View All Revisions
                    </Button>
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
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
};

export default FormAdHoc;