// CreateProject.tsx - Updated with fixed date picker and manual entry
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, CalendarIcon, Building2, User, Calendar, DollarSign, FileText, X } from 'lucide-react';
import { format, differenceInDays, parse, isValid } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ProjectAPI, BusinessUnitAPI } from '@/services/api';
import { GanttTimelineWithLegend } from '@/components/ui/gantt-timeline';

// Types based on backend models
interface BusinessUnit {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface CreatedProject {
  id: string;
  code: string;
  name: string;
  client_name?: string | null;
  description?: string | null;
  start_date: string;
  planned_end_date: string;
  current_phase?: string | null;
  contract_type?: string | null;
  contract_value?: number | null;
  currency?: string | null;
  business_unit?: {
    id: string;
    name: string;
  } | null;
}

// Constants from backend validation
const PROJECT_PHASES = [
  'FEED (Front-End Engineering Design)',
  'Detailed Engineering',
  'Procurement',
  'Construction',
  'Pre-Commissioning',
  'Commissioning',
  'Close-out'
] as const;

const CONTRACT_TYPES = [
  'EPC (Engineering, Procurement, Construction)',
  'EPCM (Engineering, Procurement, Construction Management)',
  'Conception-Construction',
  'Régie',
  'Forfait',
  'BOT (Build, Operate, Transfer)'
] as const;

// Supported currencies (ISO 4217)
const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'DZD'
];

// Check project code availability
const checkProjectCodeAvailability = async (code: string): Promise<{ available: boolean; message?: string }> => {
  if (!code) return { available: true };
  
  try {
    const response = await ProjectAPI.checkCode(code);
    if (response.data?.data?.available !== undefined) {
      return response.data.data;
    } else if (response.data?.available !== undefined) {
      return response.data;
    }
    return { available: true };
  } catch (error) {
    console.error('Error checking project code:', error);
    return { available: true };
  }
};

// Form schema
const createFormSchema = () => z.object({
  code: z.string().min(1, 'Project code is required').max(50),
  name: z.string().min(1, 'Project name is required').max(255),
  client_name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  planned_end_date: z.string().min(1, 'Planned end date is required'),
  current_phase: z.enum(PROJECT_PHASES).optional().nullable(),
  contract_type: z.enum(CONTRACT_TYPES).optional().nullable(),
  contract_value: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  business_unit_id: z.string().optional().nullable(),
}).refine((data) => {
  const start = new Date(data.start_date);
  const plannedEnd = new Date(data.planned_end_date);
  return plannedEnd > start;
}, {
  message: 'Planned end date must be after start date',
  path: ['planned_end_date'],
}).refine((data) => {
  if (data.contract_value && !data.currency) {
    return false;
  }
  return true;
}, {
  message: 'Currency is required when contract value is provided',
  path: ['currency'],
});

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

interface CreateProjectProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

// Custom date picker component with manual entry
interface DatePickerWithManualInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
  filled?: boolean;
}

function DatePickerWithManualInput({ 
  value, 
  onChange, 
  disabled, 
  placeholder = "Pick a date",
  className,
  filled
}: DatePickerWithManualInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(false);

  // Update input value when value prop changes
  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (isValid(date)) {
          setInputValue(format(date, 'dd/MM/yyyy'));
          setInputError(false);
        }
      } catch {
        // Ignore parsing errors
      }
    } else {
      setInputValue('');
      setInputError(false);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Try to parse the date
    if (newValue.length === 10) { // dd/MM/yyyy format
      const parsed = parse(newValue, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        // Check if date is disabled
        if (disabled && disabled(parsed)) {
          setInputError(true);
          return;
        }
        onChange(format(parsed, 'yyyy-MM-dd'));
        setInputError(false);
      } else {
        setInputError(true);
      }
    } else {
      setInputError(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setInputValue(format(date, 'dd/MM/yyyy'));
      setOpen(false);
      setInputError(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full pl-3 pr-10 text-left font-normal relative",
              !value && "text-muted-foreground bg-white",
              filled && 'border-blue-300 bg-blue-50',
              inputError && 'border-red-500',
              className
            )}
          >
            {value ? format(new Date(value), "PPP") : placeholder}
            <CalendarIcon className="absolute right-3 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        {/* Hidden input for manual entry */}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="dd/mm/yyyy"
          className="absolute left-0 top-0 opacity-0 w-0 h-0 pointer-events-none"
          aria-hidden="true"
        />
      </div>
      
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        sideOffset={5}
        avoidCollisions={false}
        style={{ position: 'fixed' }}
      >
        <div className="p-3 border-b border-gray-200">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="dd/mm/yyyy"
            className={cn(
              "w-full",
              inputError && "border-red-500"
            )}
          />
          {inputError && (
            <p className="text-xs text-red-500 mt-1">
              Invalid date format. Use dd/mm/yyyy
            </p>
          )}
        </div>
        <CalendarComponent
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
          fromYear={2020}
          toYear={2030}
          captionLayout="dropdown-buttons"
        />
      </PopoverContent>
    </Popover>
  );
}

export function CreateProject({ onClose, onSuccess }: CreateProjectProps) {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (error) {
    console.warn('useNavigate hook failed:', error);
    navigate = undefined;
  }
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeValidationState, setCodeValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  const [createdProject, setCreatedProject] = useState<CreatedProject | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  // Track filled fields for highlighting
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set());

  // Contract type labels
  const contractTypeLabels: { [key: string]: string } = {
    'EPC (Engineering, Procurement, Construction)': 'EPC',
    'EPCM (Engineering, Procurement, Construction Management)': 'EPCM',
    'Conception-Construction': 'Conception-Construction',
    'Régie': 'Régie',
    'Forfait': 'Forfait',
    'BOT (Build, Operate, Transfer)': 'BOT',
  };

  // Phase labels
  const phaseLabels: { [key: string]: string } = {
    'FEED (Front-End Engineering Design)': 'FEED (Front-End Engineering Design)',
    'Detailed Engineering': 'Detailed Engineering',
    'Procurement': 'Procurement',
    'Construction': 'Construction',
    'Pre-Commissioning': 'Pre-Commissioning',
    'Commissioning': 'Commissioning',
    'Close-out': 'Close-out',
  };

  // Initialize form
  const formSchema = createFormSchema();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      client_name: '',
      description: '',
      start_date: '',
      planned_end_date: '',
      current_phase: undefined,
      contract_type: undefined,
      contract_value: '',
      currency: '',
      business_unit_id: undefined,
    },
    mode: 'onBlur',
  });

  // Update filled fields when form values change
  useEffect(() => {
    const subscription = form.watch((value) => {
      const newFilledFields = new Set<string>();
      Object.entries(value).forEach(([key, val]) => {
        if (val && val !== '' && val !== undefined && val !== null && val !== 'no-unit') {
          newFilledFields.add(key);
        }
      });
      setFilledFields(newFilledFields);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Debounced code check
  const debouncedCodeCheck = useCallback(
    debounce(async (code: string) => {
      if (!code) {
        setCodeValidationState({ checking: false, available: null, message: '' });
        return;
      }
      setCodeValidationState({ checking: true, available: null, message: 'Checking...' });
      try {
        const result = await checkProjectCodeAvailability(code);
        setCodeValidationState({
          checking: false,
          available: result.available,
          message: result.available ? 'Code is available' : 'Code already exists'
        });
        if (!result.available) {
          form.setError('code', { type: 'manual', message: 'Code already exists' });
        } else {
          form.clearErrors('code');
        }
      } catch (error) {
        setCodeValidationState({ checking: false, available: null, message: 'Error checking' });
      }
    }, 800),
    [form]
  );

  // Watch for code changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'code') {
        debouncedCodeCheck(value.code || '');
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedCodeCheck]);

  // Fetch business units
  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        setLoading(true);
        const response = await BusinessUnitAPI.getAll();
        let businessUnitsData: any[] = [];
        
        if (Array.isArray(response.data)) {
          businessUnitsData = response.data;
        } else if (response.data?.data?.business_units) {
          businessUnitsData = response.data.data.business_units;
        } else if (response.data?.business_units) {
          businessUnitsData = response.data.business_units;
        }
        
        const validBusinessUnits = businessUnitsData
          .filter(unit => unit && unit.id && unit.name)
          .map(unit => ({
            id: String(unit.id),
            name: String(unit.name),
            description: unit.description || '',
            is_active: unit.is_active !== false
          }))
          .filter(unit => unit.is_active);
        
        setBusinessUnits(validBusinessUnits);
      } catch (error) {
        console.error('Error fetching business units:', error);
        setBusinessUnits([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBusinessUnits();
  }, []);

  const handleSaveProject = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);
    setCreatedProject(null);

    try {
      const projectData = {
        code: data.code,
        name: data.name,
        client_name: data.client_name || null,
        description: data.description || null,
        start_date: data.start_date,
        planned_end_date: data.planned_end_date,
        current_phase: data.current_phase || null,
        contract_type: data.contract_type || null,
        contract_value: data.contract_value ? parseFloat(data.contract_value) : null,
        currency: data.currency || null,
        business_unit_id: data.business_unit_id === 'no-unit' ? null : (data.business_unit_id || null),
      };

      const response = await ProjectAPI.create(projectData);
      
      // Extract created project data from response
      const createdProjectData = response.data?.data || response.data;
      
      // Find business unit name if selected
      let businessUnitInfo = null;
      if (data.business_unit_id && data.business_unit_id !== 'no-unit') {
        const selectedUnit = businessUnits.find(unit => unit.id === data.business_unit_id);
        if (selectedUnit) {
          businessUnitInfo = {
            id: selectedUnit.id,
            name: selectedUnit.name
          };
        }
      }

      setCreatedProject({
        id: createdProjectData.id || 'unknown',
        code: data.code,
        name: data.name,
        client_name: data.client_name,
        description: data.description,
        start_date: data.start_date,
        planned_end_date: data.planned_end_date,
        current_phase: data.current_phase,
        contract_type: data.contract_type,
        contract_value: data.contract_value ? parseFloat(data.contract_value) : null,
        currency: data.currency,
        business_unit: businessUnitInfo
      });
      
      setSubmitResult({ type: 'success', message: 'Project created successfully!' });
      
      if (onSuccess) onSuccess();
      
    } catch (error: any) {
      console.error('Error creating project:', error);
      let errorMessage = error.response?.data?.message || 'Failed to create project.';
      
      if (error.response?.data?.errors) {
        if (Array.isArray(error.response.data.errors)) {
          error.response.data.errors.forEach((err: any) => {
            if (err.param && err.msg) {
              form.setError(err.param as any, { type: 'manual', message: err.msg });
            }
          });
          errorMessage = 'Please fix validation errors.';
        }
      }
      
      setSubmitResult({ type: 'error', message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearAll = () => {
    form.reset({
      code: '',
      name: '',
      client_name: '',
      description: '',
      start_date: '',
      planned_end_date: '',
      current_phase: undefined,
      contract_type: undefined,
      contract_value: '',
      currency: '',
      business_unit_id: undefined,
    });
    setSubmitResult(null);
    setCodeValidationState({ checking: false, available: null, message: '' });
    setCreatedProject(null);
    form.clearErrors();
  };

  const handleCreateAnother = () => {
    handleClearAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    if (onClose) {
      onClose();
    } else if (navigate) {
      navigate(-1);
    }
  };

  const handleOpenSheet = (sheetType: 'team' | 'documents' | 'contractors') => {
    setActiveSheet(sheetType);
  };

  const handleCloseSheet = () => {
    setActiveSheet(null);
  };

  const codeError = form.formState.errors.code;
  const startDate = form.watch('start_date');
  const endDate = form.watch('planned_end_date');
  const showTimeline = startDate && endDate;

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="ml-2">Loading...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success card with project information (matching form colors)
  if (createdProject && submitResult?.type === 'success') {
    const start = new Date(createdProject.start_date);
    const end = new Date(createdProject.planned_end_date);
    const duration = differenceInDays(end, start);

    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card className="border-gray-200">
          <CardHeader className="text-center border-b border-gray-200 pb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-blue-100 p-3">
                <span className="text-2xl text-blue-600 font-bold">✓</span>
              </div>
            </div>
            <CardTitle className="text-2xl text-gray-900">Project Created Successfully!</CardTitle>
            <CardDescription className="text-gray-500">
              The project has been created with the following details
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            {/* Project Information Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Header with project code and name */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Project Code</p>
                    <p className="text-lg font-semibold text-gray-900">{createdProject.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Project Name</p>
                    <p className="text-lg font-semibold text-gray-900">{createdProject.name}</p>
                  </div>
                </div>
              </div>

              {/* Project details grid */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left column */}
                  <div className="space-y-4">
                    {createdProject.client_name && (
                      <div>
                        <p className="text-sm text-gray-500">Client</p>
                        <p className="font-medium text-gray-900">{createdProject.client_name}</p>
                      </div>
                    )}

                    {createdProject.business_unit && (
                      <div>
                        <p className="text-sm text-gray-500">Business Unit</p>
                        <p className="font-medium text-gray-900">{createdProject.business_unit.name}</p>
                      </div>
                    )}

                    {createdProject.current_phase && (
                      <div>
                        <p className="text-sm text-gray-500">Current Phase</p>
                        <p className="font-medium text-gray-900">{phaseLabels[createdProject.current_phase] || createdProject.current_phase}</p>
                      </div>
                    )}
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Project Timeline</p>
                      <p className="font-medium text-gray-900">
                        {format(new Date(createdProject.start_date), 'PPP')} - {format(new Date(createdProject.planned_end_date), 'PPP')}
                      </p>
                    </div>

                    {createdProject.contract_type && (
                      <div>
                        <p className="text-sm text-gray-500">Contract Type</p>
                        <p className="font-medium text-gray-900">{contractTypeLabels[createdProject.contract_type] || createdProject.contract_type}</p>
                      </div>
                    )}

                    {createdProject.contract_value && createdProject.currency && (
                      <div>
                        <p className="text-sm text-gray-500">Contract Value</p>
                        <p className="font-medium text-gray-900">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: createdProject.currency,
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(createdProject.contract_value)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gantt Timeline Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700">Project Duration: {duration} days</p>
                  </div>
                  <GanttTimelineWithLegend
                    startDate={createdProject.start_date}
                    endDate={createdProject.planned_end_date}
                  />
                </div>

                {/* Description - full width */}
                {createdProject.description && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{createdProject.description}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons for Project Management */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Project Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      className="flex items-center justify-center h-auto py-3 px-4 border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow-sm"
                      onClick={() => handleOpenSheet('team')}
                    >
                      <span className="text-sm font-medium">Assign Project Management Team</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex items-center justify-center h-auto py-3 px-4 border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow-sm"
                      onClick={() => handleOpenSheet('documents')}
                    >
                      <span className="text-sm font-medium">Attach Project Documents</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex items-center justify-center h-auto py-3 px-4 border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow-sm"
                      onClick={() => handleOpenSheet('contractors')}
                    >
                      <span className="text-sm font-medium">Add Selected Contractors</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional info badge */}
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Project ID: {createdProject.id}
              </span>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-center gap-4 pt-2 pb-6">
            <Button 
              onClick={handleCreateAnother}
              variant="outline"
              className="min-w-[150px]"
            >
              Create Another Project
            </Button>
            <Button 
              onClick={handleCloseForm}
              className="min-w-[150px] bg-gray-900 hover:bg-gray-800 text-white"
            >
              Close
            </Button>
          </CardFooter>
        </Card>

        {/* Right Sheet Component - No overlay, success card remains visible */}
        <div
          className={cn(
            "fixed top-0 right-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-hidden flex flex-col",
            activeSheet ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Sheet Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              {activeSheet === 'team' && 'Assign Project Management Team'}
              {activeSheet === 'documents' && 'Attach Project Documents'}
              {activeSheet === 'contractors' && 'Add Selected Contractors'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseSheet}
              className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sheet Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {activeSheet === 'team' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">Assign team members to manage this project.</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Project Manager</p>
                          <p className="text-xs text-gray-500">Select project manager</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Select</Button>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Team Members</p>
                          <p className="text-xs text-gray-500">Add team members</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Add</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'documents' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">Upload and attach documents to this project.</p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">Drag and drop files here</p>
                    <p className="text-xs text-gray-500 mb-3">or</p>
                    <Button size="sm" variant="outline">Browse Files</Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500">Recent documents</p>
                    <p className="text-xs text-gray-400 text-center py-2">No documents uploaded yet</p>
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'contractors' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">Select and add contractors to this project.</p>
                  <div className="space-y-2">
                    <Input placeholder="Search contractors..." className="mb-3" />
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium">Contractor {i}</p>
                            <p className="text-xs text-gray-500">Specialty {i}</p>
                          </div>
                          <Button variant="outline" size="sm">Select</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sheet Footer */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <Button
              onClick={handleCloseSheet}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show form (when no success or during error)
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create New Project</CardTitle>
          <CardDescription>Define a new project with its details</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveProject)} className="space-y-6">
              
              {/* ROW 1: code and business_unit_id */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Code */}
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="PRJ-001" 
                            {...field}
                            className={cn(
                              filledFields.has('code') && 'border-blue-300 bg-blue-50',
                              codeValidationState.checking ? 'border-yellow-500' :
                              codeError ? 'border-red-500' :
                              codeValidationState.available === true ? 'border-green-500' : ''
                            )}
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {codeValidationState.checking && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
                            {!codeValidationState.checking && codeValidationState.available === true && !codeError && 
                              <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {!codeValidationState.checking && (codeValidationState.available === false || codeError) && 
                              <AlertCircle className="h-4 w-4 text-red-500" />}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Business Unit */}
                <FormField
                  control={form.control}
                  name="business_unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className={filledFields.has('business_unit_id') ? 'border-blue-300 bg-blue-50' : ''}>
                            <SelectValue placeholder="Select business unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-unit">None</SelectItem>
                          {businessUnits.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ROW 2: project name */}
              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Project name" 
                          {...field}
                          className={filledFields.has('name') ? 'border-blue-300 bg-blue-50' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ROW 3: client */}
              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Client name" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          className={filledFields.has('client_name') ? 'border-blue-300 bg-blue-50' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ROW 4: contract type, contract value, currency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Contract Type */}
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className={filledFields.has('contract_type') ? 'border-blue-300 bg-blue-50' : ''}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTRACT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {contractTypeLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contract Value */}
                <FormField
                  control={form.control}
                  name="contract_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value</FormLabel>
                      <FormControl>
                        <Input 
                          type="text"
                          placeholder="0.00" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                              field.onChange(value);
                            }
                          }}
                          className={filledFields.has('contract_value') ? 'border-blue-300 bg-blue-50' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Currency */}
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className={filledFields.has('currency') ? 'border-blue-300 bg-blue-50' : ''}>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Currency required warning */}
              {form.watch('contract_value') && !form.watch('currency') && (
                <div className="text-sm text-amber-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Currency required when contract value is provided
                </div>
              )}

              {/* ROW 5: start date, planned end date, current phase */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Start Date - 🔥 MODIFIED: Allow any date (past, present, future) */}
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <DatePickerWithManualInput
                          value={field.value}
                          onChange={field.onChange}
                          // 🔥 No disabled function = all dates allowed
                          placeholder="Select start date"
                          filled={filledFields.has('start_date')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Planned End Date */}
                <FormField
                  control={form.control}
                  name="planned_end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Planned End Date *</FormLabel>
                      <FormControl>
                        <DatePickerWithManualInput
                          value={field.value}
                          onChange={field.onChange}
                          disabled={(date) => {
                            const startDate = form.getValues('start_date');
                            const start = startDate ? new Date(startDate) : new Date();
                            // Allow future dates, but must be after start date
                            return date <= start;
                          }}
                          placeholder="Select end date"
                          filled={filledFields.has('planned_end_date')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Current Phase */}
                <FormField
                  control={form.control}
                  name="current_phase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Phase</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className={filledFields.has('current_phase') ? 'border-blue-300 bg-blue-50' : ''}>
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROJECT_PHASES.map((phase) => (
                            <SelectItem key={phase} value={phase}>
                              {phaseLabels[phase]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Gantt Timeline - Show only when both dates are entered */}
              {showTimeline && (
                <div className="col-span-3 mt-2 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <GanttTimelineWithLegend
                    startDate={startDate}
                    endDate={endDate}
                    legendClassName="mb-2"
                  />
                </div>
              )}

              {/* ROW 6: description */}
              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Project description" 
                          className={cn(
                            "min-h-[100px]",
                            filledFields.has('description') && 'border-blue-300 bg-blue-50'
                          )}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Hidden fields */}
              <input type="hidden" {...form.register('health_status')} value={null} />
              <input type="hidden" {...form.register('baseline_finish_date')} value={null} />
              <input type="hidden" {...form.register('current_finish_date')} value={null} />

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isSubmitting} className="min-w-[200px] bg-gray-900 hover:bg-gray-800 text-white">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : 'Create Project'}
                </Button>
                <Button type="button" variant="outline" onClick={handleClearAll} disabled={isSubmitting}>
                  Clear All
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseForm} disabled={isSubmitting}>
                  Close Form
                </Button>
              </div>

              {/* Result Alert */}
              {submitResult && submitResult.type === 'error' && (
                <Alert className="bg-red-50 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submitResult.message}</AlertDescription>
                </Alert>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default CreateProject;