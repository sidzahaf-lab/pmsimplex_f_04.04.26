// CreateSchedule.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  TrendingUp,
  TrendingDown,
  Hash,
  Upload,
  FileUp,
  Check,
  File,
  HardDrive,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ScheduleAPI, WorkPackageAPI, ScheduleRevisionsAPI } from '@/services/api';

// Types
interface WorkPackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  start_date?: string;
  finish_date?: string;
  actual_start_date?: string;
  actual_finish_date?: string;
  created_at: string;
  category_id: string;
  deliverable_id: string;
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

// Updated schema with file upload and date fields
const createFormSchema = z.object({
  workpackage_id: z.string()
    .min(1, 'Work package is required')
    .uuid('Valid work package ID is required'),
  
  code: z.string()
    .min(1, 'Schedule code is required')
    .max(50, 'Schedule code must be less than 50 characters')
    .regex(/^[A-Z0-9\-_]+$/, 'Schedule code can only contain uppercase letters, numbers, hyphens, and underscores'),
  
  name: z.string()
    .min(1, 'Schedule name is required')
    .max(255, 'Schedule name must be less than 255 characters')
    .regex(/^[a-zA-Z0-9\s\-_&.,()]+$/, 'Schedule name can only contain letters, numbers, spaces, hyphens, underscores, ampersands, periods, commas, and parentheses'),
  
  type: z.enum(['baseline', 'actual'], {
    required_error: 'Schedule type is required',
    invalid_type_error: 'Schedule type must be either baseline or actual',
  }),

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
  
  description: z.string()
    .max(2000, 'Additional notes must be less than 2000 characters')
    .optional()
    .default(''),
  
  xer_file: z.any().optional(),
});

// Manually define FormValues type
type FormValues = {
  workpackage_id: string;
  code: string;
  name: string;
  type: 'baseline' | 'actual';
  data_date: string;
  actual_data_date?: string;
  description?: string;
  xer_file?: File;
};

// Define default values
const defaultValues: FormValues = {
  workpackage_id: '',
  code: '',
  name: '',
  type: 'baseline',
  data_date: new Date().toISOString().split('T')[0], // Today's date as default
  actual_data_date: '',
  description: '',
};

interface CreateScheduleProps {
  onSuccess?: () => void;
  workpackageId?: string; // Optional: pre-select a work package
}
// Parse XER file to extract project info - FULL VERSION

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
    
    // NEW: Parse PROJWBS table for wbs_name and wbs_short_name
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
    
    // ORIGINAL PROJECT TABLE PARSING - KEEP THIS EXACTLY AS IS
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
            
            // Log each field with its index
            console.log('=== FIELD INDEX MAPPING ===');
            fieldNames.forEach((field, index) => {
              console.log(`Index ${index}: "${field.trim()}"`);
            });
            
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
                
                // Look for proj_short_name (only if not already set from WBS)
                if (!fileInfo.projectName) {
                  console.log('--- Searching for proj_short_name ---');
                  const projNameIndex = findFieldIndexExact('proj_short_name');
                  console.log('proj_short_name index:', projNameIndex);
                  if (projNameIndex !== -1 && dataValues[projNameIndex]) {
                    fileInfo.projectName = dataValues[projNameIndex].trim();
                    console.log('✓ Parsed project name:', fileInfo.projectName);
                  } else {
                    // Fallback
                    const fallbackIndex = fieldNames.findIndex(field => 
                      field.trim().toLowerCase().includes('proj_short')
                    );
                    if (fallbackIndex !== -1 && dataValues[fallbackIndex]) {
                      fileInfo.projectName = dataValues[fallbackIndex].trim();
                      console.log('✓ Parsed project name (fallback):', fileInfo.projectName);
                    }
                  }
                }
                
                // Look for proj_id (only if not already set from WBS)
                if (!fileInfo.projectCode) {
                  console.log('--- Searching for proj_id ---');
                  const projCodeIndex = findFieldIndexExact('proj_id');
                  console.log('proj_id index:', projCodeIndex);
                  if (projCodeIndex !== -1 && dataValues[projCodeIndex]) {
                    fileInfo.projectCode = dataValues[projCodeIndex].trim();
                    console.log('✓ Parsed project code:', fileInfo.projectCode);
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

export function CreateSchedule({ onSuccess, workpackageId: propWorkpackageId }: CreateScheduleProps) {
  const navigate = useNavigate();
  
  // Get workpackageId from URL params if available
  const { workpackageId: urlWorkpackageId } = useParams<{ workpackageId?: string }>();
  
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState<WorkPackage | null>(null);
  const [typeAvailability, setTypeAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
    existingSchedule?: { code: string; name: string; type: string };
  }>({ checking: false, available: null, message: '' });
  
  const [codeValidationState, setCodeValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  
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

  // Determine which workpackageId to use (prop > URL param)
  const finalWorkpackageId = propWorkpackageId || urlWorkpackageId;

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      ...defaultValues,
      workpackage_id: finalWorkpackageId || '',
    },
    mode: 'onBlur',
  });

  // Check schedule code availability
  const checkScheduleCodeAvailability = async (code: string): Promise<{ available: boolean; message?: string }> => {
    if (!code) return { available: true };
    
    try {
      const response = await ScheduleAPI.checkCode(code.trim());
      const data = response.data || response;
      return {
        available: data.data?.available ?? true,
        message: data.data?.message || data.message
      };
    } catch (error: any) {
      console.error('Error checking schedule code:', error);
      return { 
        available: true, 
        message: 'Error checking code availability' 
      };
    }
  };

  // Check schedule type availability for work package - PRESERVING ORIGINAL LOGIC
  const checkScheduleTypeAvailability = async (workpackageId: string, type: 'baseline' | 'actual'): Promise<{ 
    available: boolean; 
    message?: string;
    existingSchedule?: { code: string; name: string; type: string };
  }> => {
    if (!workpackageId || !type) return { available: true };
    
    try {
      const response = await ScheduleAPI.checkBaseline(workpackageId);
      const data = response.data || response;
      
      // For type-specific check - PRESERVING ORIGINAL LOGIC
      if (type === 'baseline') {
        const canCreate = data.data?.available ?? true;
        return {
          available: canCreate,
          message: canCreate 
            ? 'No baseline schedule exists for this work package' 
            : `Work package already has a baseline schedule (${data.data?.existing_schedule?.code || 'Unknown'})`,
          existingSchedule: data.data?.existing_schedule
        };
      } else {
        // For actual type, we need to check differently - PRESERVING ORIGINAL LOGIC
        try {
          const typeCheckResponse = await ScheduleAPI.checkBaseline(workpackageId); // Using same endpoint for now
          const typeCheckData = typeCheckResponse.data || typeCheckResponse;
          
          // For actual schedule, we need to check if one exists
          // This is a simplified check - you may need a dedicated endpoint
          return {
            available: true, // Assume available for now
            message: 'Actual schedule availability check'
          };
        } catch (error) {
          console.error('Error checking actual schedule availability:', error);
          return { available: true };
        }
      }
    } catch (error: any) {
      console.error('Error checking schedule type availability:', error);
      return { 
        available: true, 
        message: 'Error checking schedule type availability' 
      };
    }
  };

  // Real-time validation with debounce for schedule code
  const debouncedCodeCheck = useCallback(
    debounce(async (code: string) => {
      if (!code || code.length < 1) {
        setCodeValidationState({
          checking: false,
          available: null,
          message: ''
        });
        return;
      }

      setCodeValidationState({
        checking: true,
        available: null,
        message: 'Checking code availability...'
      });

      try {
        const result = await checkScheduleCodeAvailability(code);
        setCodeValidationState({
          checking: false,
          available: result.available,
          message: result.available ? 'Code is available' : 'Code already exists'
        });

        form.trigger('code');
      } catch (error) {
        setCodeValidationState({
          checking: false,
          available: null,
          message: 'Error checking code availability'
        });
        console.error('Error checking code:', error);
      }
    }, 800),
    [form]
  );

  // Check type availability when workpackage or type changes
  const checkTypeAvailability = async (workpackageId: string, type: 'baseline' | 'actual') => {
    if (!workpackageId || !type) {
      setTypeAvailability({
        checking: false,
        available: null,
        message: ''
      });
      return;
    }

    setTypeAvailability({
      checking: true,
      available: null,
      message: `Checking ${type} schedule availability...`
    });

    try {
      const result = await checkScheduleTypeAvailability(workpackageId, type);
      setTypeAvailability({
        checking: false,
        available: result.available,
        message: result.message || '',
        existingSchedule: result.existingSchedule
      });

      form.trigger('type');
    } catch (error) {
      setTypeAvailability({
        checking: false,
        available: null,
        message: 'Error checking schedule type availability'
      });
      console.error('Error checking type availability:', error);
    }
  };

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
      form.setError('xer_file', {
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
      form.setValue('xer_file', file);
      
      // Auto-fill form fields from parsed info
      if (parsedInfo.projectCode) {
        const cleanCode = parsedInfo.projectCode
          .replace(/[^A-Z0-9\-_]/g, '-')
          .toUpperCase()
          .substring(0, 50);
        form.setValue('code', cleanCode);
        debouncedCodeCheck(cleanCode);
      }
      
      if (parsedInfo.projectName) {
        const cleanName = parsedInfo.projectName.substring(0, 255);
        form.setValue('name', cleanName);
      }
      
      // Set actual data date from parsed info if available (last_recalc_date)
      if (parsedInfo.actualDataDate) {
        form.setValue('actual_data_date', parsedInfo.actualDataDate);
      }
      
      setFileValidationState({
        checking: false,
        isValid: true,
        message: 'XER file validated and parsed successfully'
      });
      
      form.clearErrors('xer_file');
      
    } catch (error) {
      console.error('Error processing XER file:', error);
      setFileValidationState({
        checking: false,
        isValid: false,
        message: 'Failed to parse XER file. Please try another file.'
      });
      form.setError('xer_file', {
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
    form.setValue('xer_file', undefined);
    form.setValue('code', '');
    form.setValue('name', '');
    form.setValue('actual_data_date', '');
    setFileValidationState({
      checking: false,
      isValid: null,
      message: ''
    });
    form.clearErrors('xer_file');
    
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

  // Watch for changes for real-time feedback
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      const { 
        code, 
        workpackage_id,
        type: schedule_type
      } = value;

      if (name === 'code' && type === 'change') {
        if (code) {
          debouncedCodeCheck(code);
        } else {
          setCodeValidationState({
            checking: false,
            available: null,
            message: ''
          });
        }
      }

      if (name === 'workpackage_id' && type === 'change') {
        // Find the selected work package
        const selected = workPackages.find(wp => wp.id === workpackage_id) || null;
        setSelectedWorkPackage(selected);
        
        // Check type availability if type is already selected
        const currentType = form.getValues('type');
        if (workpackage_id && currentType) {
          checkTypeAvailability(workpackage_id, currentType);
        }
      }

      if (name === 'type' && type === 'change') {
        const currentWorkpackage = form.getValues('workpackage_id');
        if (currentWorkpackage && schedule_type) {
          checkTypeAvailability(currentWorkpackage, schedule_type);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, form, debouncedCodeCheck, workPackages]);

  // Fetch work packages on component mount
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch work packages
      let workPackagesData: WorkPackage[] = [];
      try {
        const response = await WorkPackageAPI.getAll();
        
        if (response.data?.data?.workpackages) {
          workPackagesData = response.data.data.workpackages;
        } else if (response.data?.workpackages) {
          workPackagesData = response.data.workpackages;
        } else if (Array.isArray(response.data)) {
          workPackagesData = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          workPackagesData = response.data.data;
        }
        
      } catch (error: any) {
        console.error('Error fetching work packages:', error);
      }
      
      setWorkPackages(workPackagesData);
      
      // If we have a workpackageId from props or URL, set it as the selected work package
      if (finalWorkpackageId) {
        const foundWorkPackage = workPackagesData.find(wp => wp.id === finalWorkpackageId);
        if (foundWorkPackage) {
          setSelectedWorkPackage(foundWorkPackage);
          form.setValue('workpackage_id', finalWorkpackageId);
          
          // Check type availability for the selected work package
          checkTypeAvailability(finalWorkpackageId, form.getValues('type'));
        }
      }
      
    } catch (error: any) {
      console.error('Error in fetchData:', error);
      setSubmitResult({
        type: 'error',
        message: 'Failed to load work packages.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle save schedule with file upload
  const handleSaveSchedule = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Check code availability one more time
      const codeCheck = await checkScheduleCodeAvailability(data.code);
      
      if (!codeCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Schedule code already exists. Please choose a different code.',
        });
        setIsSubmitting(false);
        return;
      }

      // Check type availability one more time
      const typeCheck = await checkScheduleTypeAvailability(data.workpackage_id, data.type);
      
      if (!typeCheck.available) {
        setSubmitResult({
          type: 'error',
          message: typeCheck.message || `A ${data.type} schedule already exists for this work package.`,
        });
        setIsSubmitting(false);
        return;
      }

      // Check if XER file is provided
      if (!xerFile || !fileValidationState.isValid) {
        setSubmitResult({
          type: 'error',
          message: 'Please upload a valid XER file.',
        });
        setIsSubmitting(false);
        return;
      }

      // 1. Create the schedule
      const scheduleData = {
        workpackage_id: data.workpackage_id,
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        type: data.type,
      };

      console.log('Creating schedule with data:', scheduleData);

      // Create schedule using ScheduleAPI
      const scheduleResponse = await ScheduleAPI.create(scheduleData);
      
      console.log('✅ Schedule creation response:', scheduleResponse.data);
      
      const schedule = scheduleResponse.data?.data?.schedule || scheduleResponse.data?.schedule || scheduleResponse.data?.data;
      
      if (!schedule || !schedule.id) {
        throw new Error('Failed to create schedule');
      }

      // 2. Create FormData for file upload with parsed dates
      const formData = new FormData();
      formData.append('schedule_id', schedule.id);
      formData.append('schedule_file', xerFile);
      
      // Add parsed dates from XER file
      if (parsedXerInfo?.plannedStart) {
        formData.append('planned_start', parsedXerInfo.plannedStart);
      }
      
      if (parsedXerInfo?.plannedFinish) {
        formData.append('planned_finish', parsedXerInfo.plannedFinish);
      }
      
      if (data.data_date) {
        formData.append('data_date', data.data_date);
      }
      
      if (data.actual_data_date) {
        formData.append('actual_data_date', data.actual_data_date);
      } else if (parsedXerInfo?.actualDataDate) {
        formData.append('actual_data_date', parsedXerInfo.actualDataDate);
      }
      
      // Add revision notes
      formData.append('revision_notes', `Initial upload: ${data.description || 'Created from XER file'}`);
      formData.append('revision_status', 'current');
      formData.append('revision_number', '1'); // Start from 0
      console.log('Uploading revision with parsed dates...');

      // 3. Upload file and create revision
      const revisionResponse = await ScheduleRevisionsAPI.upload(formData);
      
      console.log('✅ Revision created:', revisionResponse.data);

      setSubmitResult({
        type: 'success',
        message: `Schedule created successfully with Revision 0! ${data.type === 'baseline' ? 'This is the baseline schedule for the work package.' : 'This is an actual schedule for the work package.'}`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form after successful creation (keep workpackage if provided)
      form.reset({
        ...defaultValues,
        workpackage_id: finalWorkpackageId || '',
      });
      setCodeValidationState({
        checking: false,
        available: null,
        message: ''
      });
      setTypeAvailability({
        checking: false,
        available: null,
        message: ''
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
      
    } catch (error: any) {
      console.error('❌ Error creating schedule:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to create schedule. Please try again.';
      
      // Map backend validation errors to form fields
      if (error.response?.data?.errors) {
        if (Array.isArray(error.response.data.errors)) {
          error.response.data.errors.forEach((err: any) => {
            if (err.param && err.msg) {
              const fieldName = err.param.replace('workpackage_id', 'workpackage_id') as keyof FormValues;
              form.setError(fieldName, {
                type: 'manual',
                message: err.msg
              });
            }
          });
          errorMessage = 'Please fix the validation errors above.';
        }
      }
      
      if (errorMessage.includes('Duplicate') || errorMessage.includes('unique')) {
        if (errorMessage.includes('code')) {
          errorMessage = 'Schedule code already exists. Please choose a different code.';
        } else if (errorMessage.includes('workpackage_id') && errorMessage.includes('type')) {
          errorMessage = `A ${form.getValues('type')} schedule already exists for this work package.`;
        }
      } else if (errorMessage.includes('workpackage_id') || errorMessage.includes('UUID')) {
        errorMessage = 'Invalid work package selected. Please select a valid work package.';
      } else if (errorMessage.includes('type')) {
        errorMessage = 'Invalid schedule type. Please select a valid type.';
      } else if (errorMessage.includes('XER') || errorMessage.includes('file')) {
        form.setError('xer_file', {
          type: 'manual',
          message: errorMessage
        });
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
      workpackage_id: finalWorkpackageId || '',
    });
    setSubmitResult(null);
    setCodeValidationState({
      checking: false,
      available: null,
      message: ''
    });
    setTypeAvailability({
      checking: false,
      available: null,
      message: ''
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
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/schedules');
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

  // Get code field error
  const codeError = form.formState.errors.code;
  const typeError = form.formState.errors.type;

  // Check if form can be submitted
  const canSubmit = () => {
    return (
      !isSubmitting &&
      form.getValues('code') &&
      form.getValues('name') &&
      form.getValues('workpackage_id') &&
      form.getValues('data_date') &&
      xerFile &&
      fileValidationState.isValid === true &&
      codeValidationState.available === true &&
      typeAvailability.available !== false
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-6xl">
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="ml-2">Loading work packages...</span>
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
                Create New Schedule
              </CardTitle>
              <CardDescription>
                Define a new schedule with XER file upload for tracking work package progress
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              New Schedule
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <FileUp className="h-5 w-5 mr-2 text-blue-600" />
                Step 1: Select XER Schedule File
              </CardTitle>
              <CardDescription>
                Upload a Primavera P6 XER file to create the schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* File Selection Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : xerFile
                    ? 'border-green-500 bg-green-50'
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
                      <div className="p-3 bg-green-100 rounded-full">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-green-700 mb-1">
                        XER File Selected
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
                    
                    {/* Validation Status */}
                    <div className="text-left">
                      <div className={`flex items-center text-sm font-medium ${
                        fileValidationState.isValid === true
                          ? 'text-green-600'
                          : fileValidationState.isValid === false
                          ? 'text-red-600'
                          : 'text-gray-600'
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
                        Select Primavera P6 XER file (max 100MB)
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Schedule information will be automatically parsed from the file
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* File Error Message */}
              {form.formState.errors.xer_file && (
                <Alert className="mt-4 bg-red-50 text-red-800 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="font-medium">
                    {form.formState.errors.xer_file.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Schedule Configuration - Only show when XER file is uploaded */}
          {xerFile && fileValidationState.isValid === true && (
            <>
              {/* Work Package and Schedule Type */}
              <Card className="mb-8">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Package className="h-5 w-5 mr-2 text-blue-600" />
                    Step 2: Schedule Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the schedule by selecting work package, schedule type and dates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveSchedule)} className="space-y-6">
                      
                      {/* Work Package Selection */}
                      <div className="border-b pb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Info className="h-5 w-5 mr-2 text-blue-600" />
                          Work Package Selection
                        </h3>
                        
                        <FormField
                          control={form.control}
                          name="workpackage_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                <Package className="h-4 w-4 mr-2 text-gray-500" />
                                Work Package *
                              </FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={!!finalWorkpackageId || isParsingFile}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={
                                      workPackages.length === 0 ? "No work packages available" : 
                                      "Select a work package"
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {workPackages && workPackages.length > 0 ? (
                                    workPackages.map((workPackage) => (
                                      <SelectItem 
                                        key={`workpackage-${workPackage.id}`}
                                        value={workPackage.id}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{workPackage.name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {workPackage.code} • {workPackage.start_date ? format(parseISO(workPackage.start_date), 'MMM dd') : 'No dates'}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No work packages available. Please create work packages first.
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {workPackages.length > 0 
                                  ? "Select the work package for this schedule" 
                                  : "No work packages found. Please create work packages first."}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Selected Work Package Info */}
                        {selectedWorkPackage && (
                          <div className="bg-blue-100 p-4 rounded-md mt-4">
                            <h4 className="font-semibold mb-2">Selected Work Package:</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Code:</span>
                                <span className="ml-2 font-medium font-mono">{selectedWorkPackage.code}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Name:</span>
                                <span className="ml-2 font-medium">{selectedWorkPackage.name}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Planned Dates:</span>
                                <span className="ml-2 font-medium">
                                  {selectedWorkPackage.start_date 
                                    ? format(parseISO(selectedWorkPackage.start_date), 'MMM dd') 
                                    : 'Not set'} → {selectedWorkPackage.finish_date 
                                      ? format(parseISO(selectedWorkPackage.finish_date), 'MMM dd') 
                                      : 'Not set'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Actual Dates:</span>
                                <span className="ml-2 font-medium">
                                  {selectedWorkPackage.actual_start_date 
                                    ? format(parseISO(selectedWorkPackage.actual_start_date), 'MMM dd') 
                                    : 'Not set'} → {selectedWorkPackage.actual_finish_date 
                                      ? format(parseISO(selectedWorkPackage.actual_finish_date), 'MMM dd') 
                                      : 'Not set'}
                                </span>
                              </div>
                            </div>
                            {selectedWorkPackage.description && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {selectedWorkPackage.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Basic Information */}
                      <div className="border-b pb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-blue-600" />
                          Basic Information
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Schedule Code */}
                          <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Hash className="h-4 w-4 mr-2 text-gray-500" />
                                  Schedule Code *
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      placeholder="BL-CONTRACT, AC-JAN-2024, etc." 
                                      {...field}
                                      className={
                                        codeValidationState.checking ? 'border-yellow-500 pr-10' :
                                        codeError ? 'border-red-500 pr-10' :
                                        codeValidationState.available === true ? 'border-green-500 pr-10' :
                                        'pr-10'
                                      }
                                      onBlur={field.onBlur}
                                      onChange={(e) => {
                                        field.onChange(e.target.value.toUpperCase());
                                      }}
                                      disabled={isParsingFile}
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                      {codeValidationState.checking && (
                                        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                      )}
                                      {!codeValidationState.checking && codeValidationState.available === true && !codeError && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      )}
                                      {!codeValidationState.checking && (codeValidationState.available === false || codeError) && (
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Unique identifier for the schedule (uppercase only)
                                </FormDescription>
                                
                                {/* Validation Status */}
                                {codeValidationState.checking && (
                                  <div className="flex items-center text-yellow-600 text-sm mt-1">
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                    Checking code availability...
                                  </div>
                                )}
                                
                                {!codeValidationState.checking && codeValidationState.message && (
                                  <div className={`flex items-center text-sm mt-1 ${
                                    codeValidationState.available === true ? 'text-green-600' : 
                                    codeValidationState.available === false ? 'text-red-600' : 
                                    'text-gray-600'
                                  }`}>
                                    {codeValidationState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                    {codeValidationState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                                    {codeValidationState.message}
                                  </div>
                                )}
                                
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Schedule Name */}
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                                  Schedule Name *
                                </FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Contract Baseline, Monthly Actual, etc." 
                                    {...field}
                                    disabled={isParsingFile}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Descriptive name of the schedule
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Date Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
                                  Status date of the schedule
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

                        {/* Schedule Type */}
                        <div className="mt-6">
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center">
                                  <Clock className="h-4 w-4 mr-2 text-gray-500" />
                                  Schedule Type *
                                </FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value}
                                  disabled={isParsingFile}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select schedule type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="baseline">
                                      <div className="flex items-center">
                                        <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">Baseline</span>
                                          <span className="text-xs text-muted-foreground">
                                            Original planned schedule (only one per work package)
                                          </span>
                                        </div>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="actual">
                                      <div className="flex items-center">
                                        <TrendingDown className="h-4 w-4 mr-2 text-green-500" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">Actual</span>
                                          <span className="text-xs text-muted-foreground">
                                            Record of actual progress (only one per work package)
                                          </span>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Each work package can have only one baseline and one actual schedule
                                </FormDescription>
                                
                                {/* Type Availability Status */}
                                {typeAvailability.checking && (
                                  <div className="flex items-center text-yellow-600 text-sm mt-1">
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                    {typeAvailability.message}
                                  </div>
                                )}
                                
                                {!typeAvailability.checking && typeAvailability.message && (
                                  <div className={`flex items-center text-sm mt-1 ${
                                    typeAvailability.available === true ? 'text-green-600' : 
                                    typeAvailability.available === false ? 'text-red-600' : 
                                    'text-gray-600'
                                  }`}>
                                    {typeAvailability.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                    {typeAvailability.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                                    {typeAvailability.message}
                                    {typeAvailability.existingSchedule && (
                                      <span className="ml-1 font-medium">
                                        ({typeAvailability.existingSchedule.code})
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Additional Notes */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Purpose and context of the schedule..."
                                {...field}
                                value={field.value || ''}
                                className="min-h-[100px]"
                                disabled={isParsingFile}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                                    <div className="font-medium">{parsedXerInfo.projectCode}</div>
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

                      {/* Schedule Type Explanation */}
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-6">
                          <h4 className="font-medium mb-3 flex items-center">
                            <Info className="h-5 w-5 mr-2 text-blue-600" />
                            About Schedule Types
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-white p-4 rounded-md border">
                              <div className="flex items-center mb-2">
                                <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                                <h5 className="font-medium">Baseline Schedule</h5>
                              </div>
                              <ul className="space-y-1 text-muted-foreground">
                                <li>• Original planned schedule</li>
                                <li>• Created before work starts</li>
                                <li>• Only one per work package</li>
                                <li>• Used for comparison with actual progress</li>
                                <li>• Required for variance analysis</li>
                              </ul>
                            </div>
                            <div className="bg-white p-4 rounded-md border">
                              <div className="flex items-center mb-2">
                                <TrendingDown className="h-4 w-4 mr-2 text-green-500" />
                                <h5 className="font-medium">Actual Schedule</h5>
                              </div>
                              <ul className="space-y-1 text-muted-foreground">
                                <li>• Record of actual progress</li>
                                <li>• Created during or after work</li>
                                <li>• Only one per work package</li>
                                <li>• Shows real-time progress</li>
                                <li>• Used for performance measurement</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Preview of new schedule */}
                      <Card className="bg-gray-50">
                        <CardContent className="pt-6">
                          <h4 className="font-medium mb-4">Preview of New Schedule:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Schedule Code</p>
                              <p className="font-medium font-mono">{form.getValues('code') || 'Not set'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Schedule Name</p>
                              <p className="font-medium">{form.getValues('name') || 'Not set'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Work Package</p>
                              <p className="font-medium">
                                {workPackages.find(wp => wp.id === form.getValues('workpackage_id'))?.name || 'Not selected'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Schedule Type</p>
                              <p className={`font-medium ${form.getValues('type') === 'baseline' ? 'text-blue-600' : 'text-green-600'}`}>
                                {form.getValues('type') === 'baseline' ? 'Baseline' : 'Actual'}
                              </p>
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
                              <p className="text-sm text-gray-500">Code Status</p>
                              <p className={`font-medium ${codeValidationState.available === true ? 'text-green-600' : 
                                codeValidationState.available === false ? 'text-red-600' : 'text-yellow-600'}`}>
                                {codeValidationState.available === true ? 'Available' : 
                                codeValidationState.available === false ? 'Already exists' : 'Not checked'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Type Status</p>
                              <p className={`font-medium ${typeAvailability.available === true ? 'text-green-600' : 
                                            typeAvailability.available === false ? 'text-red-600' : 'text-yellow-600'}`}>
                                {typeAvailability.available === true ? 'Available' : 
                                typeAvailability.available === false ? 'Already exists' : 'Not checked'}
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
                          className="min-w-[200px]"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Create Schedule with Revision 0
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
                            <div className="font-medium mb-1">Requirements to create schedule:</div>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              {!xerFile && <li>Select a valid XER file</li>}
                              {!form.getValues('code') && <li>Schedule code will be parsed from XER file</li>}
                              {!form.getValues('name') && <li>Schedule name will be parsed from XER file</li>}
                              {!form.getValues('workpackage_id') && <li>Select a work package</li>}
                              {!form.getValues('data_date') && <li>Select a data date</li>}
                              {form.getValues('code') && codeValidationState.available === false && <li>Schedule code already exists</li>}
                              {form.getValues('type') && typeAvailability.available === false && <li>Schedule type constraint violation</li>}
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
                          </AlertDescription>
                        </Alert>
                      )}
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default CreateSchedule;