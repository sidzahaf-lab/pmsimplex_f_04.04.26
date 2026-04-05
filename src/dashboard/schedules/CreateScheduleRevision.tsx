// CreateScheduleRevision.tsx - UPDATED VERSION WITH SCHEDULE CODE UPDATE
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Save,
  X,
  Plus,
  FileText,
  Calendar as CalendarIcon,
  Clock,
  Info,
  Package,
  Upload,
  FileUp,
  Check,
  File,
  HardDrive,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  GitCompare,
  GitBranch,
  History,
  ArrowRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ScheduleAPI, ScheduleRevisionsAPI } from '@/services/api';

// Types
interface Schedule {
  id: string;
  code: string;
  name: string;
  type: 'baseline' | 'actual';
  workpackage_id: string;
  created_at: string;
  updated_at: string;
}

interface ScheduleRevision {
  id: string;
  revision_number: number;
  revision_status: 'under_review' | 'current' | 'superseded';
  revision_notes: string;
  data_date: string;
  actual_data_date?: string;
  planned_start?: string;
  planned_finish?: string;
  schedule_file_name: string;
  schedule_file_size: number;
  schedule_file_hash: string;
  created_at: string;
}

interface ParsedXERInfo {
  projectCode?: string;
  projectName?: string;
  dataDate?: string;
  plannedStart?: string;
  plannedFinish?: string;
  actualDataDate?: string;
  fileSize: number;
  fileName: string;
}

// Schema for revision creation
const createRevisionFormSchema = z.object({
  schedule_id: z.string()
    .min(1, 'Schedule is required')
    .uuid('Valid schedule ID is required'),
  
  revision_notes: z.string()
    .max(2000, 'Revision notes must be less than 2000 characters')
    .optional()
    .default(''),
  
  data_date: z.string()
    .min(1, 'Data date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Data date must be in YYYY-MM-DD format'
    }),
  
  actual_data_date: z.string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Actual data date must be in YYYY-MM-DD format'
    }),
  
  schedule_file: z.any().optional()
});

type FormValues = {
  schedule_id: string;
  revision_notes?: string;
  data_date: string;
  actual_data_date?: string;
  schedule_file?: any;
};

const defaultValues: FormValues = {
  schedule_id: '',
  revision_notes: '',
  data_date: new Date().toISOString().split('T')[0],
  actual_data_date: '',
};

interface CreateScheduleRevisionProps {
  onSuccess?: () => void;
  scheduleId?: string;
}

// Parse XER file to extract project info
const parseXERFile = async (file: File): Promise<ParsedXERInfo> => {
  const fileInfo: ParsedXERInfo = {
    fileName: file.name,
    fileSize: file.size
  };

  try {
    const text = await file.text();
    const lines = text.split('\n');
    
    console.log('=== DEBUG: Starting XER file parsing ===');
    console.log('File:', file.name, 'Size:', file.size, 'bytes');
    
    // Parse PROJWBS table for wbs_name and wbs_short_name
    console.log('--- Parsing PROJWBS table ---');
    const projwbsStartIndex = lines.findIndex(line => 
      line.trim().startsWith('%T') && line.includes('PROJWBS')
    );

    if (projwbsStartIndex !== -1) {
      console.log(`Found PROJWBS table at line ${projwbsStartIndex}:`, lines[projwbsStartIndex]);
      
      // Find the %F line (field definitions)
      for (let j = projwbsStartIndex + 1; j < Math.min(projwbsStartIndex + 10, lines.length); j++) {
        const fieldLine = lines[j];
        if (fieldLine.startsWith('%F')) {
          console.log(`Found PROJWBS field definitions at line ${j}:`, fieldLine.substring(0, 200) + '...');
          
          // Split by tab character
          const fieldParts = fieldLine.split('\t');
          const fieldNames = fieldParts.slice(1); // Skip the '%F'
          console.log('PROJWBS Total fields:', fieldNames.length);
          
          // Log each field with its index
          console.log('=== PROJWBS FIELD INDEX MAPPING ===');
          fieldNames.forEach((field, index) => {
            console.log(`Index ${index}: "${field.trim()}"`);
          });
          
          // Find indices for wbs_short_name and wbs_name
          const wbsShortNameIndex = fieldNames.findIndex(field => 
            field.trim().toLowerCase() === 'wbs_short_name'
          );
          const wbsNameIndex = fieldNames.findIndex(field => 
            field.trim().toLowerCase() === 'wbs_name'
          );
          
          console.log('wbs_short_name index:', wbsShortNameIndex);
          console.log('wbs_name index:', wbsNameIndex);
          
          if (wbsShortNameIndex !== -1 && wbsNameIndex !== -1) {
            // Find the data row (%R) - only first row
            for (let k = j + 1; k < Math.min(j + 20, lines.length); k++) {
              const dataLine = lines[k];
              if (dataLine.startsWith('%R')) {
                console.log(`Found PROJWBS data row (Row 1) at line ${k}:`, dataLine.substring(0, 200) + '...');
                
                // Parse data values
                const dataParts = dataLine.split('\t');
                const dataValues = dataParts.slice(1); // Skip the '%R'
                console.log('PROJWBS Data values count:', dataValues.length);
                
                // Extract wbs_short_name for project code
                if (dataValues[wbsShortNameIndex]) {
                  const wbsShortName = dataValues[wbsShortNameIndex].trim();
                  console.log('wbs_short_name raw value:', wbsShortName);
                  if (wbsShortName && wbsShortName !== '0' && wbsShortName !== 'null') {
                    const cleanCode = wbsShortName
                      .replace(/[^A-Z0-9\-_]/g, '-')
                      .toUpperCase()
                      .substring(0, 50);
                    fileInfo.projectCode = cleanCode;
                    console.log('✓ Parsed project code from wbs_short_name:', fileInfo.projectCode);
                  }
                }
                
                // Extract wbs_name for project name
                if (dataValues[wbsNameIndex]) {
                  const wbsName = dataValues[wbsNameIndex].trim();
                  console.log('wbs_name raw value:', wbsName);
                  if (wbsName && wbsName !== '0' && wbsName !== 'null') {
                    const cleanName = wbsName.substring(0, 255);
                    fileInfo.projectName = cleanName;
                    console.log('✓ Parsed project name from wbs_name:', fileInfo.projectName);
                  }
                }
                
                break; // Only parse first row
              }
            }
          }
          break;
        }
      }
    } else {
      console.log('PROJWBS table not found');
    }
    
    // ORIGINAL PROJECT TABLE PARSING - Keep this for dates
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('%T') && line.includes('PROJECT')) {
        console.log(`Found PROJECT table at line ${i}:`, line);
        
        // Find the %F line (field definitions)
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const fieldLine = lines[j];
          if (fieldLine.startsWith('%F')) {
            console.log(`Found field definitions at line ${j}:`, fieldLine.substring(0, 200) + '...');
            
            // Split by tab character
            const fieldParts = fieldLine.split('\t');
            const fieldNames = fieldParts.slice(1); // Skip the '%F'
            console.log('Total fields:', fieldNames.length);
            
            // Find the data row (%R)
            for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
              const dataLine = lines[k];
              if (dataLine.startsWith('%R')) {
                console.log(`Found data row at line ${k}:`, dataLine.substring(0, 200) + '...');
                
                // Parse data values
                const dataParts = dataLine.split('\t');
                const dataValues = dataParts.slice(1); // Skip the '%R'
                console.log('Data values count:', dataValues.length);
                
                // First, try to find fields by exact match
                const findFieldIndexExact = (searchTerm: string): number => {
                  return fieldNames.findIndex(field => {
                    const fieldName = field.trim();
                    return fieldName === searchTerm;
                  });
                };
                
                // Look for plan_start_date
                console.log('--- Searching for plan_start_date ---');
                const planStartIndex = findFieldIndexExact('plan_start_date');
                console.log('plan_start_date index result:', planStartIndex);
                if (planStartIndex !== -1 && dataValues[planStartIndex]) {
                  const planStart = dataValues[planStartIndex].trim();
                  console.log('plan_start_date raw value:', planStart);
                  if (planStart && planStart !== '0' && planStart !== 'null') {
                    fileInfo.plannedStart = planStart.split(' ')[0];
                    console.log('✓ Parsed planned start:', fileInfo.plannedStart);
                  }
                } else {
                  console.log('✗ plan_start_date not found by exact match');
                  // Fallback to contains search
                  const fallbackIndex = fieldNames.findIndex(field => 
                    field.trim().toLowerCase().includes('plan_start')
                  );
                  if (fallbackIndex !== -1 && dataValues[fallbackIndex]) {
                    const planStart = dataValues[fallbackIndex].trim();
                    console.log('Found via fallback, raw value:', planStart);
                    if (planStart && planStart !== '0' && planStart !== 'null') {
                      fileInfo.plannedStart = planStart.split(' ')[0];
                      console.log('✓ Parsed planned start (fallback):', fileInfo.plannedStart);
                    }
                  }
                }
                
                // Look for plan_end_date - try exact match first
                console.log('--- Searching for plan_end_date ---');
                const planEndIndex = findFieldIndexExact('plan_end_date');
                console.log('plan_end_date index result (exact match):', planEndIndex);
                
                if (planEndIndex !== -1 && dataValues[planEndIndex]) {
                  const planEnd = dataValues[planEndIndex].trim();
                  console.log('plan_end_date raw value:', planEnd);
                  if (planEnd && planEnd !== '0' && planEnd !== 'null') {
                    fileInfo.plannedFinish = planEnd.split(' ')[0];
                    console.log('✓ Parsed planned finish:', fileInfo.plannedFinish);
                  }
                } else {
                  console.log('✗ plan_end_date not found by exact match');
                  // Try various search patterns
                  const searchPatterns = [
                    'plan_end_date',
                    'plan_end',
                    'planned_end',
                    'end_date',
                    'scd_end_date'
                  ];
                  
                  for (const pattern of searchPatterns) {
                    const index = fieldNames.findIndex(field => 
                      field.trim().toLowerCase().includes(pattern.toLowerCase())
                    );
                    if (index !== -1 && dataValues[index]) {
                      const planEnd = dataValues[index].trim();
                      console.log(`Found "${pattern}" at index ${index}, raw value:`, planEnd);
                      if (planEnd && planEnd !== '0' && planEnd !== 'null') {
                        fileInfo.plannedFinish = planEnd.split(' ')[0];
                        console.log(`✓ Parsed planned finish (via "${pattern}"):`, fileInfo.plannedFinish);
                        break;
                      }
                    }
                  }
                }
                
                // Look for last_recalc_date
                console.log('--- Searching for last_recalc_date ---');
                const lastRecalcIndex = findFieldIndexExact('last_recalc_date');
                console.log('last_recalc_date index:', lastRecalcIndex);
                if (lastRecalcIndex !== -1 && dataValues[lastRecalcIndex]) {
                  const lastRecalc = dataValues[lastRecalcIndex].trim();
                  if (lastRecalc && lastRecalc !== '0' && lastRecalc !== 'null') {
                    fileInfo.actualDataDate = lastRecalc.split(' ')[0];
                    console.log('✓ Parsed actual data date:', fileInfo.actualDataDate);
                  }
                }
                
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
    
    // Fallbacks (only if WBS didn't provide the data)
    if (!fileInfo.projectName) {
      fileInfo.projectName = file.name.replace(/\.xer$/i, '');
      console.log('Using filename as project name:', fileInfo.projectName);
    }
    
    if (!fileInfo.projectCode) {
      const cleanName = fileInfo.projectName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
      fileInfo.projectCode = cleanName.substring(0, 20);
      console.log('Generated project code:', fileInfo.projectCode);
    }
    
    console.log('=== FINAL PARSED INFO ===');
    console.log('projectName:', fileInfo.projectName);
    console.log('projectCode:', fileInfo.projectCode);
    console.log('plannedStart:', fileInfo.plannedStart);
    console.log('plannedFinish:', fileInfo.plannedFinish);
    console.log('actualDataDate:', fileInfo.actualDataDate);
    console.log('=========================\n');
    
  } catch (error) {
    console.error('Error parsing XER file:', error);
    fileInfo.projectName = file.name.replace(/\.xer$/i, '');
    const cleanName = fileInfo.projectName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
    fileInfo.projectCode = cleanName.substring(0, 20);
  }

  return fileInfo;
};

// Validate XER file format
const validateXerFile = (file: File): { isValid: boolean; message: string } => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'xer') {
    return {
      isValid: false,
      message: 'File must be a XER file (.xer extension)'
    };
  }

  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      message: 'File size must be less than 100MB'
    };
  }

  return {
    isValid: true,
    message: 'Valid XER file'
  };
};

export function CreateScheduleRevision({ onSuccess, scheduleId: propScheduleId }: CreateScheduleRevisionProps) {
  const navigate = useNavigate();
  
  // Get scheduleId from URL params if available
  const { scheduleId: urlScheduleId } = useParams<{ scheduleId?: string }>();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [revisions, setRevisions] = useState<ScheduleRevision[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [currentRevision, setCurrentRevision] = useState<ScheduleRevision | null>(null);
  const [nextRevisionNumber, setNextRevisionNumber] = useState<number>(1);
  
  const [xerFile, setXerFile] = useState<File | null>(null);
  const [parsedXerInfo, setParsedXerInfo] = useState<ParsedXERInfo | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileValidationState, setFileValidationState] = useState<{
    checking: boolean;
    isValid: boolean | null;
    message: string;
  }>({ checking: false, isValid: null, message: '' });
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataDateInputRef = useRef<HTMLInputElement>(null);
  const actualDataDateInputRef = useRef<HTMLInputElement>(null);

  // Determine which scheduleId to use (prop > URL param)
  const finalScheduleId = propScheduleId || urlScheduleId;
  const scheduleIdProvided = !!finalScheduleId;

  // Initialize form with simplified validation
  const form = useForm<FormValues>({
    resolver: zodResolver(createRevisionFormSchema),
    defaultValues: {
      ...defaultValues,
      schedule_id: finalScheduleId || '',
    },
    mode: 'onChange',
  });

  // Handle file selection and parsing
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    const validation = validateXerFile(file);
    if (!validation.isValid) {
      setFileValidationState({
        checking: false,
        isValid: false,
        message: validation.message
      });
      // Set form error manually
      form.setError('schedule_file', {
        type: 'manual',
        message: validation.message
      });
      return;
    }

    setFileValidationState({
      checking: true,
      isValid: null,
      message: 'Validating and parsing XER file...'
    });
    
    setIsParsingFile(true);
    
    try {
      const parsedInfo = await parseXERFile(file);
      
      setXerFile(file);
      setParsedXerInfo(parsedInfo);
      
      // Set the file in the form
      form.setValue('schedule_file', file, { 
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true 
      });
      
      // Clear any previous errors
      form.clearErrors('schedule_file');
      
      // Set actual data date from parsed info if available
      if (parsedInfo.actualDataDate) {
        form.setValue('actual_data_date', parsedInfo.actualDataDate, { 
          shouldValidate: true 
        });
      }
      
      setFileValidationState({
        checking: false,
        isValid: true,
        message: 'XER file validated and parsed successfully'
      });
      
    } catch (error) {
      console.error('Error processing XER file:', error);
      setFileValidationState({
        checking: false,
        isValid: false,
        message: 'Failed to parse XER file. Please try another file.'
      });
      form.setError('schedule_file', {
        type: 'manual',
        message: 'Failed to parse XER file. Please try another file.'
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelect(e.dataTransfer.files);
    }
  };

  // Handle remove file
  const handleRemoveFile = () => {
    setXerFile(null);
    setParsedXerInfo(null);
    form.setValue('schedule_file', undefined, { 
      shouldValidate: true,
      shouldDirty: true 
    });
    form.setValue('actual_data_date', '', { 
      shouldValidate: true 
    });
    setFileValidationState({
      checking: false,
      isValid: null,
      message: ''
    });
    form.clearErrors('schedule_file');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle trigger file input
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Function to update schedule code
  const updateScheduleCode = async (scheduleId: string, newCode: string, newName?: string) => {
    try {
      console.log('🔄 Updating schedule...');
      console.log('Schedule ID:', scheduleId);
      console.log('New Code:', newCode);
      console.log('New Name:', newName);
      
      const updateData: any = {
        code: newCode
      };
      
      if (newName) {
        updateData.name = newName;
      }
      
      const response = await ScheduleAPI.update(scheduleId, updateData);
      console.log('✅ Schedule updated successfully:', response.data);
      
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ Failed to update schedule:', error);
      
      let errorMessage = 'Failed to update schedule code.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Watch for schedule changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'schedule_id' && type === 'change') {
        // Find the selected schedule
        const selected = schedules.find(s => s.id === value.schedule_id) || null;
        setSelectedSchedule(selected);
        
        // Load revisions for this schedule
        if (value.schedule_id) {
          loadRevisions(value.schedule_id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, schedules]);

  // Fetch schedules on component mount
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch schedules
      let schedulesData: Schedule[] = [];
      try {
        const response = await ScheduleAPI.getAll();
        
        if (response.data?.data?.schedules) {
          schedulesData = response.data.data.schedules;
        } else if (response.data?.schedules) {
          schedulesData = response.data.schedules;
        } else if (Array.isArray(response.data)) {
          schedulesData = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          schedulesData = response.data.data;
        }
        
      } catch (error: any) {
        console.error('Error fetching schedules:', error);
      }
      
      setSchedules(schedulesData);
      
      // If we have a scheduleId from props or URL, set it as the selected schedule
      if (finalScheduleId) {
        const foundSchedule = schedulesData.find(s => s.id === finalScheduleId);
        if (foundSchedule) {
          setSelectedSchedule(foundSchedule);
          form.setValue('schedule_id', finalScheduleId, { shouldValidate: true });
          
          // Load revisions for this schedule
          loadRevisions(finalScheduleId);
        } else {
          console.error(`Schedule with ID ${finalScheduleId} not found`);
          setSubmitResult({
            type: 'error',
            message: `Schedule with ID ${finalScheduleId} not found`,
          });
        }
      }
      
    } catch (error: any) {
      console.error('Error in fetchData:', error);
      setSubmitResult({
        type: 'error',
        message: 'Failed to load schedules.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load revisions for a schedule
  const loadRevisions = async (scheduleId: string) => {
    try {
      const response = await ScheduleRevisionsAPI.getBySchedule(scheduleId);
      let revisionsData: ScheduleRevision[] = [];
      
      if (response.data?.data?.revisions) {
        revisionsData = response.data.data.revisions;
      } else if (response.data?.revisions) {
        revisionsData = response.data.revisions;
      } else if (Array.isArray(response.data)) {
        revisionsData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        revisionsData = response.data.data;
      }
      
      setRevisions(revisionsData);
      
      // Find current revision
      const currentRev = revisionsData.find(rev => rev.revision_status === 'current');
      setCurrentRevision(currentRev || null);
      
      // Calculate next revision number
      const nextRevNum = revisionsData.length > 0 
        ? Math.max(...revisionsData.map(rev => rev.revision_number)) + 1
        : 1;
      setNextRevisionNumber(nextRevNum);
      
    } catch (error) {
      console.error('Error loading revisions:', error);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Ensure schedule_id is set in form when finalScheduleId is available
    if (finalScheduleId && !form.getValues('schedule_id')) {
      form.setValue('schedule_id', finalScheduleId, { 
        shouldValidate: true,
        shouldDirty: true 
      });
    }
  }, []);

  // Handle save revision - UPDATED WITH SCHEDULE CODE UPDATE
  const handleSaveRevision = async (data: FormValues) => {
    console.log('Submitting form with data:', data);
    
    // Manual file validation
    if (!xerFile) {
      setSubmitResult({
        type: 'error',
        message: 'Please upload a valid XER file.',
      });
      return;
    }

    // Validate the XER file
    const fileValidation = validateXerFile(xerFile);
    if (!fileValidation.isValid) {
      setSubmitResult({
        type: 'error',
        message: fileValidation.message,
      });
      return;
    }

    // Get the schedule_id
    const scheduleId = data.schedule_id || finalScheduleId || form.getValues('schedule_id');
    
    if (!scheduleId) {
      setSubmitResult({
        type: 'error',
        message: 'Schedule ID is required. Please select a schedule.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Create FormData for revision upload
      const formData = new FormData();
      formData.append('schedule_id', scheduleId);
      formData.append('schedule_file', xerFile);
      
      // Add revision notes if provided (optional)
      if (data.revision_notes && data.revision_notes.trim()) {
        formData.append('revision_notes', data.revision_notes);
      } else {
        // Default revision notes
        formData.append('revision_notes', `Revision ${nextRevisionNumber} uploaded on ${new Date().toLocaleDateString()}`);
      }
      
      // Add dates
      if (data.data_date) {
        formData.append('data_date', data.data_date);
      }
      
      if (data.actual_data_date) {
        formData.append('actual_data_date', data.actual_data_date);
      } else if (parsedXerInfo?.actualDataDate) {
        formData.append('actual_data_date', parsedXerInfo.actualDataDate);
      }
      
      // Add parsed dates from XER file
      if (parsedXerInfo?.plannedStart) {
        formData.append('planned_start', parsedXerInfo.plannedStart);
      }
      
      if (parsedXerInfo?.plannedFinish) {
        formData.append('planned_finish', parsedXerInfo.plannedFinish);
      }

      // Log FormData contents for debugging
      console.log('📤 FormData contents being sent:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }

      console.log('🚀 Calling create endpoint...');

      // 1. Create the revision
      const revisionResponse = await ScheduleRevisionsAPI.upload(formData);
      
      console.log('✅ Revision created:', revisionResponse.data);

      const revision = revisionResponse.data?.data?.revision;
      
      // 2. UPDATE SCHEDULE CODE WITH PARSED INFO (IF DIFFERENT)
      let scheduleUpdateMessage = '';
      if (parsedXerInfo?.projectCode && selectedSchedule) {
        const shouldUpdateCode = parsedXerInfo.projectCode !== selectedSchedule.code;
        const shouldUpdateName = parsedXerInfo.projectName && parsedXerInfo.projectName !== selectedSchedule.name;
        
        if (shouldUpdateCode || shouldUpdateName) {
          console.log('🔄 Updating schedule information...');
          
          const updateResult = await updateScheduleCode(
            selectedSchedule.id,
            parsedXerInfo.projectCode,
            shouldUpdateName ? parsedXerInfo.projectName : undefined
          );
          
          if (updateResult.success) {
            scheduleUpdateMessage = shouldUpdateCode 
              ? ` Schedule code updated to: ${parsedXerInfo.projectCode}`
              : '';
            
            // Update local state
            setSelectedSchedule(prev => prev ? {
              ...prev,
              code: parsedXerInfo.projectCode || prev.code,
              name: shouldUpdateName ? (parsedXerInfo.projectName || prev.name) : prev.name
            } : null);
            
            // Update schedules list
            setSchedules(prev => prev.map(schedule => 
              schedule.id === selectedSchedule.id 
                ? { 
                    ...schedule, 
                    code: parsedXerInfo.projectCode || schedule.code,
                    name: shouldUpdateName ? (parsedXerInfo.projectName || schedule.name) : schedule.name
                  }
                : schedule
            ));
          } else {
            console.warn('⚠️ Schedule update failed:', updateResult.error);
            scheduleUpdateMessage = ' (Schedule update failed)';
          }
        }
      }
      
      // Set success message
      setSubmitResult({
        type: 'success',
        message: `Revision ${revision?.revision_number || nextRevisionNumber} created successfully! ${
          currentRevision 
            ? `Previous revision ${currentRevision.revision_number} has been superseded.`
            : 'This is the first revision for this schedule.'
        }${scheduleUpdateMessage}`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form after successful creation
      form.reset({
        ...defaultValues,
        schedule_id: finalScheduleId || scheduleId || '',
        revision_notes: '',
      });
      
      setXerFile(null);
      setParsedXerInfo(null);
      setFileValidationState({
        checking: false,
        isValid: null,
        message: ''
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh revisions list
      loadRevisions(scheduleId);
      
    } catch (error: any) {
      console.error('❌ Error creating revision:', error);
      
      let errorMessage = 'Failed to create revision. Please try again.';
      
      // Enhanced error handling
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes('Duplicate') || errorMessage.includes('unique')) {
        if (errorMessage.includes('file hash')) {
          errorMessage = 'This XER file has already been uploaded for this schedule.';
        }
      } else if (errorMessage.includes('Revision not found')) {
        errorMessage = 'Schedule not found or you do not have permission to create revisions for it.';
      } else if (errorMessage.includes('schedule id is required')) {
        errorMessage = 'Schedule ID is required. Please make sure a schedule is selected.';
      }

      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle clear all button
  const handleClearAll = () => {
    form.reset({
      ...defaultValues,
      schedule_id: finalScheduleId || '',
      revision_notes: '',
    });
    setSubmitResult(null);
    setXerFile(null);
    setParsedXerInfo(null);
    setFileValidationState({
      checking: false,
      isValid: null,
      message: ''
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (selectedSchedule) {
      navigate(`/schedules/${selectedSchedule.id}/revisions`);
    } else {
      navigate('/schedules');
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if form can be submitted
  const canSubmit = () => {
    const formValues = form.getValues();
    const formErrors = form.formState.errors;
    
    // Basic checks
    const hasSchedule = !!formValues.schedule_id && !formErrors.schedule_id;
    const hasDataDate = !!formValues.data_date && !formErrors.data_date;
    const hasValidFile = xerFile && fileValidationState.isValid === true;
    
    return !isSubmitting && hasSchedule && hasDataDate && hasValidFile;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-6xl">
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="ml-2">Loading schedules...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="mr-2 h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Create Schedule Revision
              </CardTitle>
              <CardDescription>
                Upload a new XER file to create a revision for {scheduleIdProvided ? 'the selected' : 'an existing'} schedule
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              New Revision
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <GitCompare className="h-5 w-5 mr-2 text-blue-600" />
                Step 1: {scheduleIdProvided ? 'Selected Schedule' : 'Select Schedule'} and Upload New XER File
              </CardTitle>
              <CardDescription>
                {scheduleIdProvided 
                  ? `Schedule is pre-selected. Upload the updated XER file for revision ${nextRevisionNumber}.`
                  : 'Choose the schedule to revise and upload the updated XER file'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveRevision)} className="space-y-6">
                  {/* Schedule Selection - HIDDEN WHEN scheduleIdProvided */}
                  {!scheduleIdProvided && (
                    <FormField
                      control={form.control}
                      name="schedule_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Package className="h-4 w-4 mr-2 text-gray-500" />
                            Schedule *
                          </FormLabel>
                          <FormControl>
                            <select 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              onChange={field.onChange}
                              value={field.value}
                              disabled={isParsingFile}
                            >
                              <option value="">Select a schedule</option>
                              {schedules.map((schedule) => (
                                <option key={`schedule-${schedule.id}`} value={schedule.id}>
                                  {schedule.code} - {schedule.name} ({schedule.type})
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormDescription>
                            Select the schedule you want to create a revision for
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Selected Schedule Info - ALWAYS SHOW WHEN SCHEDULE IS SELECTED */}
                  {selectedSchedule && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2">Selected Schedule:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Code:</span>
                            <span className="ml-2 font-medium font-mono bg-blue-100 px-2 py-1 rounded">
                              {selectedSchedule.code}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Name:</span>
                            <span className="ml-2 font-medium">{selectedSchedule.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className={`ml-2 font-medium ${
                              selectedSchedule.type === 'baseline' ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              {selectedSchedule.type === 'baseline' ? 'Baseline' : 'Actual'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Show code update info if parsed code is different */}
                        {parsedXerInfo?.projectCode && parsedXerInfo.projectCode !== selectedSchedule.code && (
                          <Alert className="mt-4 bg-yellow-50 text-yellow-800 border-yellow-200">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription>
                              <div className="font-medium">Schedule code will be updated:</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="line-through font-mono">{selectedSchedule.code}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-bold font-mono">{parsedXerInfo.projectCode}</span>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* Current Revision Info */}
                        {currentRevision && (
                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <h5 className="font-semibold mb-2 flex items-center">
                              <History className="h-4 w-4 mr-2" />
                              Current Revision: #{currentRevision.revision_number}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Data Date:</span>
                                <span className="ml-2 font-medium">
                                  {formatDate(currentRevision.data_date)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Status:</span>
                                <Badge 
                                  variant="outline" 
                                  className={`ml-2 ${
                                    currentRevision.revision_status === 'current' 
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  }`}
                                >
                                  {currentRevision.revision_status}
                                </Badge>
                              </div>
                              {currentRevision.revision_notes && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Notes:</span>
                                  <p className="mt-1 text-sm text-gray-600">
                                    {currentRevision.revision_notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Next Revision Info */}
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <h5 className="font-semibold mb-2 flex items-center">
                            <GitBranch className="h-4 w-4 mr-2" />
                            New Revision: #{nextRevisionNumber}
                          </h5>
                          <p className="text-sm text-gray-600">
                            This will create revision #{nextRevisionNumber} {currentRevision 
                              ? `and supersede revision ${currentRevision.revision_number}`
                              : 'as the first revision'
                            }
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Hidden schedule_id field for when schedule is pre-selected */}
                  {scheduleIdProvided && (
                    <FormField
                      control={form.control}
                      name="schedule_id"
                      render={({ field }) => (
                        <input type="hidden" {...field} />
                      )}
                    />
                  )}
                </form>
              </Form>

              {/* File Selection Area */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FileUp className="h-5 w-5 mr-2 text-blue-600" />
                  XER File Upload *
                </h3>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : xerFile
                      ? fileValidationState.isValid === true 
                        ? 'border-green-500 bg-green-50'
                        : fileValidationState.isValid === false
                          ? 'border-red-300 bg-red-50'
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
                    accept=".xer"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  
                  {xerFile ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <div className={`p-3 rounded-full ${
                          fileValidationState.isValid === true 
                            ? 'bg-green-100' 
                            : fileValidationState.isValid === false
                              ? 'bg-red-100'
                              : 'bg-yellow-100'
                        }`}>
                          {fileValidationState.isValid === true ? (
                            <Check className="h-8 w-8 text-green-600" />
                          ) : fileValidationState.isValid === false ? (
                            <AlertCircle className="h-8 w-8 text-red-600" />
                          ) : (
                            <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className={`text-lg font-semibold mb-1 ${
                          fileValidationState.isValid === true 
                            ? 'text-green-700' 
                            : fileValidationState.isValid === false
                              ? 'text-red-700'
                              : 'text-yellow-700'
                        }`}>
                          {fileValidationState.isValid === true 
                            ? 'XER File Selected' 
                            : fileValidationState.isValid === false
                              ? 'File Validation Failed'
                              : 'Processing File...'}
                        </h3>
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                          <File className="h-4 w-4" />
                          <span className="font-medium">{xerFile.name}</span>
                        </div>
                      </div>
                      
                      {/* File Details */}
                      <div className="bg-white border rounded-lg p-4 text-left">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center text-gray-500">
                              <File className="h-3 w-3 mr-2" />
                              <span>File Name:</span>
                            </div>
                            <div className="font-medium truncate">{xerFile.name}</div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center text-gray-500">
                              <HardDrive className="h-3 w-3 mr-2" />
                              <span>File Size:</span>
                            </div>
                            <div className="font-medium">{formatFileSize(xerFile.size)}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Parsed Information Display */}
                      {parsedXerInfo && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                          <h4 className="font-medium mb-2 flex items-center text-sm">
                            <Info className="h-3 w-3 mr-2 text-blue-600" />
                            Information Parsed from XER File
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {parsedXerInfo.projectCode && (
                              <div>
                                <div className="text-blue-600">Project Code:</div>
                                <div className="font-medium font-mono">{parsedXerInfo.projectCode}</div>
                              </div>
                            )}
                            {parsedXerInfo.projectName && (
                              <div>
                                <div className="text-blue-600">Project Name:</div>
                                <div className="font-medium">{parsedXerInfo.projectName}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Validation Status */}
                      <div className="text-left">
                        <div className={`flex items-center text-sm font-medium ${
                          fileValidationState.isValid === true
                            ? 'text-green-600'
                            : fileValidationState.isValid === false
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {fileValidationState.checking || isParsingFile ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {isParsingFile ? 'Parsing XER file...' : 'Validating file...'}
                            </>
                          ) : fileValidationState.isValid === true ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {fileValidationState.message}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              {fileValidationState.message}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="p-3 bg-blue-100 rounded-full">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">
                          {isDragging ? 'Drop XER file here' : 'Drag & drop or click to select'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Select updated Primavera P6 XER file (max 100MB)
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Project information will be automatically parsed from the file
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* File Error Message */}
                {form.formState.errors.schedule_file && (
                  <Alert className="mt-4 bg-red-50 text-red-800 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="font-medium">
                      {form.formState.errors.schedule_file.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revision Configuration - Only show when XER file is uploaded and schedule is selected */}
          {xerFile && fileValidationState.isValid === true && selectedSchedule && (
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  Step 2: Revision Configuration
                </CardTitle>
                <CardDescription>
                  Configure the revision details and notes (notes are optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSaveRevision)} className="space-y-6">
                    
                    {/* Revision Notes - NOW OPTIONAL */}
                    <FormField
                      control={form.control}
                      name="revision_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            Revision Notes (Optional)
                          </FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Optional: Describe the changes in this revision, reason for update, approvals, etc. If left blank, a default note will be added."
                              {...field}
                              value={field.value || ''}
                              className="min-h-[120px]"
                              disabled={isParsingFile}
                            />
                          </FormControl>
                          <FormDescription>
                            Optional: Explain what changed in this revision and why it was created
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Date Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Data Date */}
                      <FormField
                        control={form.control}
                        name="data_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center">
                              <CalendarDays className="h-4 w-4 mr-2 text-gray-500" />
                              Data Date *
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="date"
                                  ref={dataDateInputRef}
                                  {...field}
                                  disabled={isParsingFile}
                                  className="pr-10"
                                />
                                <CalendarIcon 
                                  className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600"
                                  onClick={() => dataDateInputRef.current?.showPicker()}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>
                              Status date of this revision
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Actual Data Date */}
                      <FormField
                        control={form.control}
                        name="actual_data_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center">
                              <CalendarDays className="h-4 w-4 mr-2 text-gray-500" />
                              Actual Data Date (Optional)
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="date"
                                  ref={actualDataDateInputRef}
                                  {...field}
                                  disabled={isParsingFile}
                                  className="pr-10"
                                />
                                <CalendarIcon 
                                  className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600"
                                  onClick={() => actualDataDateInputRef.current?.showPicker()}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>
                              Cut-off date for actual progress data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Parsed XER Information */}
                    {parsedXerInfo && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-6">
                          <h4 className="font-medium mb-3 flex items-center">
                            <Info className="h-5 w-5 mr-2 text-blue-600" />
                            Information Parsed from XER File
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {/* Left Column - Basic Info */}
                            <div className="space-y-4">
                              {parsedXerInfo.projectCode && (
                                <div>
                                  <div className="text-sm text-blue-600">Project Code:</div>
                                  <div className="font-medium font-mono bg-white px-2 py-1 rounded border">
                                    {parsedXerInfo.projectCode}
                                  </div>
                                  {selectedSchedule && parsedXerInfo.projectCode !== selectedSchedule.code && (
                                    <div className="text-xs text-yellow-600 mt-1 flex items-center">
                                      <ArrowRight className="h-3 w-3 mr-1" />
                                      Will update schedule code
                                    </div>
                                  )}
                                </div>
                              )}
                              {parsedXerInfo.projectName && (
                                <div>
                                  <div className="text-sm text-blue-600">Project Name:</div>
                                  <div className="font-medium">{parsedXerInfo.projectName}</div>
                                </div>
                              )}
                            </div>
                            
                            {/* Right Column - Date Information */}
                            <div className="space-y-4">
                              {(parsedXerInfo.plannedStart || parsedXerInfo.plannedFinish) && (
                                <div className="bg-white p-4 rounded-md border">
                                  <div className="flex items-center text-blue-700 mb-3">
                                    <CalendarRange className="h-4 w-4 mr-2" />
                                    <span className="font-semibold">Planned Dates</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    {parsedXerInfo.plannedStart && (
                                      <div>
                                        <div className="text-sm text-blue-600">Planned Start:</div>
                                        <div className="font-medium">{formatDate(parsedXerInfo.plannedStart)}</div>
                                      </div>
                                    )}
                                    {parsedXerInfo.plannedFinish && (
                                      <div>
                                        <div className="text-sm text-blue-600">Planned Finish:</div>
                                        <div className="font-medium">{formatDate(parsedXerInfo.plannedFinish)}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {parsedXerInfo.actualDataDate && (
                                <div className="bg-white p-4 rounded-md border">
                                  <div className="flex items-center text-green-700 mb-3">
                                    <CalendarDays className="h-4 w-4 mr-2" />
                                    <span className="font-semibold">Actual Data Date</span>
                                  </div>
                                  <div>
                                    <div className="text-sm text-green-600">Last Recalculation:</div>
                                    <div className="font-medium">{formatDate(parsedXerInfo.actualDataDate)}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Parsed from last_recalc_date field
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Revision Preview */}
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-4">Revision Preview:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Schedule</p>
                            <p className="font-medium font-mono">
                              {selectedSchedule.code}
                              {parsedXerInfo?.projectCode && parsedXerInfo.projectCode !== selectedSchedule.code && (
                                <span className="ml-2 text-yellow-600 text-xs">
                                  → {parsedXerInfo.projectCode}
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Revision Number</p>
                            <p className="font-medium">#{nextRevisionNumber}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              Current
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Data Date</p>
                            <p className="font-medium">
                              {form.getValues('data_date') ? formatDate(form.getValues('data_date')) : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">File Status</p>
                            <p className={`font-medium ${fileValidationState.isValid === true ? 'text-green-600' : 'text-yellow-600'}`}>
                              {fileValidationState.isValid === true ? 'Ready' : 'Not ready'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Form Status</p>
                            <p className={`font-medium ${form.formState.isValid ? 'text-green-600' : 'text-yellow-600'}`}>
                              {form.formState.isValid ? 'Valid' : 'Has errors'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                      <Button 
                        type="submit" 
                        disabled={!canSubmit()}
                        className="min-w-[200px] bg-green-600 hover:bg-green-700"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Creating Revision...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Create Revision #{nextRevisionNumber}
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleClearAll}
                        disabled={isSubmitting}
                      >
                        Reset Form
                      </Button>

                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCancel}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>

                    {/* Submit Conditions */}
                    {!canSubmit() && !isSubmitting && (
                      <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription>
                          <div className="font-medium mb-1">Requirements to create revision:</div>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {!selectedSchedule && <li>Select a schedule</li>}
                            {!xerFile && <li>Select a valid XER file</li>}
                            {form.formState.errors.schedule_file && <li>File error: {form.formState.errors.schedule_file.message}</li>}
                            {!form.getValues('data_date') && <li>Select a data date</li>}
                            {form.formState.errors.data_date && <li>Date error: {form.formState.errors.data_date.message}</li>}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Save Result Alert */}
                    {submitResult && (
                      <Alert className={
                        submitResult.type === 'success' 
                          ? 'bg-green-50 text-green-800 border-green-200' 
                          : 'bg-red-50 text-red-800 border-red-200'
                      }>
                        {submitResult.type === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <AlertDescription className="font-medium">
                          {submitResult.message}
                          {submitResult.type === 'success' && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/schedules/${selectedSchedule.id}/revisions`)}
                                className="text-green-700 border-green-200 hover:bg-green-50"
                              >
                                View All Revisions
                              </Button>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CreateScheduleRevision;