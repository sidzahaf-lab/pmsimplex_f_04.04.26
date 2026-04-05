// EditProject.tsx
import { useState, useEffect, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  CalendarIcon, 
  Info, 
  Tag, 
  Calendar, 
  Building, 
  ArrowLeft,
  Save,
  X,
  Lock,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ProjectAPI, BusinessUnitAPI } from '@/services/api';

// Types
interface BusinessUnit {
  id: string;
  client_id: number;
  type: 'PMO' | 'PMT' | 'Department' | 'Management_Board';
  name: string;
  description: string;
  created_at: string;
  last_modified_at: string;
}

interface Project {
  id: string;
  code: string;
  name: string;
  status: 'PLANNING' | 'EXECUTION' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  start_date: string;
  finish_date: string;
  business_unit_id?: string | null;
  created_at: string;
  last_modified_at?: string;
  business_unit?: {
    id: number;
    name: string;
    type: string;
  };
}

// Define the base schema without the cross-field validation
const editFormSchemaBase = z.object({
  status: z.enum(['PLANNING', 'EXECUTION', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const),
  
  start_date: z.string()
    .min(1, 'Start date is required')
    .refine((date: string) => {
      const start = new Date(date);
      return !isNaN(start.getTime());
    }, {
      message: 'Invalid start date'
    }),
  
  finish_date: z.string()
    .min(1, 'Finish date is required')
    .refine((date: string) => {
      const finish = new Date(date);
      return !isNaN(finish.getTime());
    }, {
      message: 'Invalid finish date'
    }),
  
  business_unit_id: z.string().optional(),
});

// Create the final schema with cross-field validation
const editFormSchema = editFormSchemaBase.refine(
  (data) => {
    const start = new Date(data.start_date);
    const finish = new Date(data.finish_date);
    return finish >= start;
  },
  {
    message: "Finish date must be after or equal to start date",
    path: ["finish_date"],
  }
);

type FormValues = z.infer<typeof editFormSchema>;

export function EditProject() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [originalProject, setOriginalProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDirty, setFormDirty] = useState(false);
  
  const [dateRangeValidation, setDateRangeValidation] = useState<{
    valid: boolean | null;
    message: string;
  }>({ valid: null, message: '' });

  // Type labels for display
  const typeLabels: { [key: string]: string } = {
    'PMO': 'Project Management Office',
    'PMT': 'Project Management Team',
    'Department': 'Department',
    'Management_Board': 'Management Board',
  };

  // Status labels for display
  const statusLabels: { [key: string]: string } = {
    'PLANNING': 'Planning',
    'EXECUTION': 'Execution',
    'ON_HOLD': 'On Hold',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled',
  };

  // Status colors
  const statusColors: { [key: string]: string } = {
    'PLANNING': 'bg-blue-100 text-blue-800 border-blue-200',
    'EXECUTION': 'bg-green-100 text-green-800 border-green-200',
    'ON_HOLD': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'COMPLETED': 'bg-gray-100 text-gray-800 border-gray-200',
    'CANCELLED': 'bg-red-100 text-red-800 border-red-200',
  };

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      status: 'PLANNING',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      finish_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      business_unit_id: undefined,
    },
    mode: 'onBlur',
  });

  // Function to check if form has changes
  const checkHasChanges = useCallback((currentValues: FormValues) => {
    if (!originalProject) return false;
    
    // Convert original dates to yyyy-MM-dd format for comparison
    const originalStartDate = originalProject.start_date ? 
      format(new Date(originalProject.start_date), 'yyyy-MM-dd') : '';
    const originalFinishDate = originalProject.finish_date ? 
      format(new Date(originalProject.finish_date), 'yyyy-MM-dd') : '';
    
    return (
      currentValues.status !== originalProject.status ||
      currentValues.start_date !== originalStartDate ||
      currentValues.finish_date !== originalFinishDate ||
      currentValues.business_unit_id !== (originalProject.business_unit_id || undefined)
    );
  }, [originalProject]);

  // Fetch project data using ProjectAPI
  const fetchProject = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await ProjectAPI.getById(id);
      
      let projectData: Project;
      if (response.data?.data?.project) {
        projectData = response.data.data.project;
      } else if (response.data?.project) {
        projectData = response.data.project;
      } else {
        projectData = response.data;
      }
      
      console.log('Fetched project:', projectData);
      setProject(projectData);
      setOriginalProject(projectData);
      
      // Update form values
      const formData = {
        status: projectData.status || 'PLANNING',
        start_date: projectData.start_date ? format(new Date(projectData.start_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        finish_date: projectData.finish_date ? format(new Date(projectData.finish_date), 'yyyy-MM-dd') : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        business_unit_id: projectData.business_unit_id || undefined,
      };
      
      form.reset(formData);
      setFormDirty(false);
      
      // Validate date range after setting initial values
      validateDateRange(formData.start_date, formData.finish_date);
      
    } catch (error: any) {
      console.error('Error fetching project:', error);
      setSubmitResult({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load project. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch business units using BusinessUnitAPI
  const fetchBusinessUnits = async () => {
    try {
      const response = await BusinessUnitAPI.getAll();
      
      let businessUnitsData: any[] = [];
      if (Array.isArray(response.data)) {
        businessUnitsData = response.data;
      } else if (response.data?.data?.business_units) {
        businessUnitsData = response.data.data.business_units;
      } else if (response.data?.business_units) {
        businessUnitsData = response.data.business_units;
      }
      
      const validBusinessUnits: BusinessUnit[] = businessUnitsData
        .filter(unit => unit && unit.id && unit.name)
        .map(unit => ({
          ...unit,
          id: String(unit.id),
          name: String(unit.name),
          type: (unit.type && ['PMO', 'PMT', 'Department', 'Management_Board'].includes(unit.type)) 
            ? unit.type as BusinessUnit['type']
            : 'Department'
        }));
      
      setBusinessUnits(validBusinessUnits);
    } catch (error) {
      console.error('Error fetching business units:', error);
      setBusinessUnits([]);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchBusinessUnits();
    }
  }, [id]);

  // Validate date range
  const validateDateRange = (startDate: string, finishDate: string) => {
    if (!startDate || !finishDate) {
      setDateRangeValidation({ valid: null, message: '' });
      return;
    }

    const start = new Date(startDate);
    const finish = new Date(finishDate);

    if (isNaN(start.getTime()) || isNaN(finish.getTime())) {
      setDateRangeValidation({ valid: false, message: 'Invalid date format' });
      return;
    }

    if (finish < start) {
      setDateRangeValidation({ 
        valid: false, 
        message: 'Finish date must be after start date' 
      });
    } else {
      const duration = Math.ceil((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setDateRangeValidation({ 
        valid: true, 
        message: `Project duration: ${duration} days` 
      });
    }
  };

  // Watch for date changes for real-time feedback and form dirty state
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if ((name === 'start_date' || name === 'finish_date') && type === 'change') {
        validateDateRange(value.start_date || '', value.finish_date || '');
      }
      
      // Check if form has changes whenever any field changes
      if (originalProject) {
        const hasChangesNow = checkHasChanges(value as FormValues);
        setFormDirty(hasChangesNow);
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, form, originalProject, checkHasChanges]);

  // Get selected business unit name
  const getSelectedBusinessUnit = () => {
    const currentBusinessUnitId = form.getValues('business_unit_id');
    if (!currentBusinessUnitId || currentBusinessUnitId === 'no-unit') {
      return 'Not assigned';
    }
    
    const selectedUnit = businessUnits.find(unit => unit.id === currentBusinessUnitId);
    return selectedUnit ? selectedUnit.name : 'Invalid selection';
  };

  // Calculate project duration
  const calculateProjectDuration = () => {
    const startDate = form.getValues('start_date');
    const finishDate = form.getValues('finish_date');
    
    if (!startDate || !finishDate) return 'N/A';
    
    const start = new Date(startDate);
    const finish = new Date(finishDate);
    
    if (isNaN(start.getTime()) || isNaN(finish.getTime())) return 'Invalid date';
    
    const duration = Math.ceil((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (duration <= 0) return 'Invalid date range';
    return `${duration} days`;
  };

  // Handle update project using ProjectAPI
  const handleUpdateProject = async (data: FormValues) => {
    if (!id || !project) return;
    
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Validate dates
      const startDate = new Date(data.start_date);
      const finishDate = new Date(data.finish_date);
      
      if (isNaN(startDate.getTime()) || isNaN(finishDate.getTime())) {
        setSubmitResult({
          type: 'error',
          message: 'Invalid date format.',
        });
        setIsSubmitting(false);
        return;
      }

      if (startDate > finishDate) {
        setSubmitResult({
          type: 'error',
          message: 'Start date must be before finish date.',
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare project data (only updatable fields)
      const projectData = {
        // Keep original code and name
        code: project.code,
        name: project.name,
        // Updated fields
        status: data.status,
        start_date: data.start_date,
        finish_date: data.finish_date,
        business_unit_id: data.business_unit_id && data.business_unit_id !== 'no-unit' 
          ? data.business_unit_id 
          : null,
      };

      console.log('Updating project with data:', projectData);

      // Update project using ProjectAPI
      const response = await ProjectAPI.update(id, projectData);
      
      console.log('Project update response:', response.data);
      
      setSubmitResult({
        type: 'success',
        message: 'Project updated successfully!',
      });
      
      // Update local project state
      setProject(prev => prev ? { ...prev, ...projectData } : null);
      setOriginalProject(prev => prev ? { ...prev, ...projectData } : null);
      
      // Refresh the data after a delay
      setTimeout(() => {
        fetchProject();
      }, 1000);
      
    } catch (error: any) {
      console.error('Error updating project:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to update project. Please try again.';
      
      if (errorMessage.includes('business_unit_id') || errorMessage.includes('UUID')) {
        errorMessage = 'Invalid business unit selected. Please select a valid business unit or leave it empty.';
      }

      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/projects');
  };

  // Handle reset form
  const handleReset = () => {
    if (originalProject) {
      const formData = {
        status: originalProject.status || 'PLANNING',
        start_date: originalProject.start_date ? format(new Date(originalProject.start_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        finish_date: originalProject.finish_date ? format(new Date(originalProject.finish_date), 'yyyy-MM-dd') : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        business_unit_id: originalProject.business_unit_id || undefined,
      };
      
      form.reset(formData);
      setFormDirty(false);
      setSubmitResult(null);
      validateDateRange(formData.start_date, formData.finish_date);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-7xl">
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="ml-2">Loading project data...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project && !loading) {
    return (
      <div className="container mx-auto py-6 max-w-7xl">
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
            <h3 className="mt-4 text-lg font-semibold">Project Not Found</h3>
            <p className="text-muted-foreground mt-2">
              The project you're trying to edit doesn't exist or has been deleted.
            </p>
            <Button 
              onClick={() => navigate('/projects')}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex flex-col gap-6">
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
                  Edit Project
                </CardTitle>
                <CardDescription>
                  Update project timeline, status, and business unit
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                Project ID: {project?.id?.substring(0, 8)}...
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Project Information Display Card - Showing read-only code and name */}
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Info className="h-5 w-5 mr-2 text-blue-600" />
                  Project Information (Read-only)
                </CardTitle>
                <CardDescription>
                  Project code and name cannot be modified
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Read-only fields */}
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="flex items-center w-full">
                        <Tag className="h-5 w-5 mr-3 mt-0.5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium text-gray-500">Project Code</h4>
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Read-only
                            </Badge>
                          </div>
                          <div className="flex items-center p-3 bg-gray-50 rounded-md border">
                            <div className="font-mono font-semibold text-gray-900">
                              {project?.code || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="flex items-center w-full">
                        <FileText className="h-5 w-5 mr-3 mt-0.5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium text-gray-500">Project Name</h4>
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Read-only
                            </Badge>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-md border">
                            <div className="font-medium text-gray-900">
                              {project?.name || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Column - Project metadata */}
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <Calendar className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Created Date</h4>
                        <p className="font-medium">
                          {project?.created_at ? format(new Date(project.created_at), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Calendar className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Last Modified</h4>
                        <p className="font-medium">
                          {project?.last_modified_at ? 
                            format(new Date(project.last_modified_at), 'MMM dd, yyyy') : 
                            'Never modified'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Building className="h-5 w-5 mr-3 mt-0.5 text-gray-500" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Current Business Unit</h4>
                        <p className="font-medium">
                          {project?.business_unit?.name || 'Not assigned'}
                        </p>
                        {project?.business_unit?.type && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {typeLabels[project.business_unit.type] || project.business_unit.type}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editable Fields Section */}
            <Card className="mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-green-600" />
                  Editable Fields
                </CardTitle>
                <CardDescription>
                  Update project status, timeline, and business unit assignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleUpdateProject)} className="space-y-6">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Project Status */}
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Status *</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PLANNING">Planning</SelectItem>
                                <SelectItem value="EXECUTION">Execution</SelectItem>
                                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Current project status
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Start Date */}
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Start Date *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      field.onChange(format(date, 'yyyy-MM-dd'));
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Project start date
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Finish Date */}
                      <FormField
                        control={form.control}
                        name="finish_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Finish Date *</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      field.onChange(format(date, 'yyyy-MM-dd'));
                                    }
                                  }}
                                  disabled={(date) => {
                                    const startDate = form.getValues('start_date');
                                    const start = startDate ? new Date(startDate) : new Date();
                                    return date < start;
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Project finish date
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Date Range Validation */}
                    {dateRangeValidation.message && (
                      <div className={`text-sm ${dateRangeValidation.valid === false ? 'text-red-600' : 'text-green-600'}`}>
                        {dateRangeValidation.valid === false ? (
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                        ) : dateRangeValidation.valid === true ? (
                          <CheckCircle2 className="h-4 w-4 inline mr-2" />
                        ) : null}
                        {dateRangeValidation.message}
                      </div>
                    )}

                    {/* Business Unit Selection */}
                    <FormField
                      control={form.control}
                      name="business_unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Unit (Optional)</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a business unit (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="no-unit">No Business Unit</SelectItem>
                              {businessUnits && businessUnits.length > 0 ? (
                                businessUnits.map((unit) => (
                                  <SelectItem 
                                    key={`bu-${unit.id}`}
                                    value={unit.id}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{unit.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {typeLabels[unit.type] || unit.type}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No business units available
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Optional: Associate this project with a business unit
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Preview of updated values */}
                    <Card className="bg-gray-50">
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-4">Preview of Updated Information:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColors[form.getValues('status') || 'PLANNING']}`}>
                              {statusLabels[form.getValues('status') || 'PLANNING']}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Duration</p>
                            <p className="font-medium">{calculateProjectDuration()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Business Unit</p>
                            <p className="font-medium">{getSelectedBusinessUnit()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Changes Made</p>
                            <p className={`font-medium ${formDirty ? 'text-green-600' : 'text-gray-500'}`}>
                              {formDirty ? 'Yes' : 'No changes detected'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting || !form.formState.isValid || !formDirty}
                        className="min-w-[200px]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Update Project
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleReset}
                        disabled={isSubmitting || !formDirty}
                      >
                        Reset Changes
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default EditProject;