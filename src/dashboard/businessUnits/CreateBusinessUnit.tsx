// CreateBusinessUnit.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Building, Globe, AlertTriangle } from 'lucide-react';
import { BusinessUnitAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Types
interface Client {
  id: number;
  name: string;
  slug: string;
  url?: string;
  created_at: string;
}

// API Response Types
interface ClientApiResponse {
  data?: {
    client?: Client;
  };
  client?: Client;
}

interface GetByIdApiResponse {
  data?: {
    client?: Client;
  };
  client?: Client;
  id?: number;
  name?: string;
  slug?: string;
  created_at?: string;
}

// Check business unit name availability (global uniqueness)
const checkBusinessUnitNameAvailability = async (name: string): Promise<{ available: boolean; message?: string }> => {
  if (!name) return { available: true };
  
  try {
    const response = await BusinessUnitAPI.checkName(name.trim());
    // Handle different response formats
    const data = response.data || response;
    return {
      available: data.available ?? true,
      message: data.message
    };
  } catch (error: any) {
    console.error('Error checking business unit name:', error);
    ApiUtils.handleApiError(error);
    return { 
      available: true, 
      message: 'Error checking name availability' 
    };
  }
};

// Form schema - simplified (removed client_id and type)
const formSchema = z.object({
  name: z.string()
    .min(1, 'Business Unit name is required')
    .max(100, 'Business Unit name must be less than 100 characters'),
  
  description: z.string()
    .max(255, 'Description must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  
  is_active: z.boolean().optional().default(true)
});

type FormValues = z.infer<typeof formSchema>;

interface CreateBusinessUnitProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function CreateBusinessUnit({ onClose, onSuccess }: CreateBusinessUnitProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameValidationState, setNameValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  
  // Database connection state
  const [databaseInfo, setDatabaseInfo] = useState<{
    connected: boolean;
    type: string;
    database: string;
    host: string;
  } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
    mode: 'onBlur',
  });

  // Check database connection
  const checkDatabaseConnection = async () => {
    try {
      const response = await SystemAPI.health();
      
      const dbInfo = {
        connected: true,
        type: response.data?.environment === 'production' ? 'TiDB Cloud' : 'Local MySQL',
        database: response.data?.database?.name || 'unknown',
        host: response.data?.database?.host || 'unknown'
      };
      
      setDatabaseInfo(dbInfo);
      setConnectionError(null);
      return dbInfo;
    } catch (error) {
      const formattedError = ApiUtils.handleApiError(error);
      
      setDatabaseInfo({
        connected: false,
        type: 'Unknown',
        database: 'unknown',
        host: 'unknown'
      });
      
      let errorMessage = 'Cannot connect to database. ';
      if (formattedError.status === 0) {
        errorMessage += 'Please ensure backend server is running.';
      } else if (formattedError.status === 500) {
        errorMessage += 'Database server error.';
      } else {
        errorMessage += formattedError.message || 'Connection failed.';
      }
      
      setConnectionError(errorMessage);
      return null;
    }
  };

  // Real-time validation with debounce
  const debouncedNameCheck = useCallback(
    debounce(async (name: string) => {
      if (!name || name.length < 1) {
        setNameValidationState({
          checking: false,
          available: null,
          message: ''
        });
        return;
      }

      setNameValidationState({
        checking: true,
        available: null,
        message: 'Checking name availability...'
      });

      try {
        const result = await checkBusinessUnitNameAvailability(name);
        setNameValidationState({
          checking: false,
          available: result.available,
          message: result.available ? 'Name is available' : 'Name already exists'
        });

        // Trigger form validation to update error state
        form.trigger('name');
      } catch (error) {
        setNameValidationState({
          checking: false,
          available: null,
          message: 'Error checking name availability'
        });
        ApiUtils.handleApiError(error);
      }
    }, 800), // 800ms debounce
    [form]
  );

  // Watch for name changes for real-time feedback
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'name' && type === 'change') {
        const businessUnitName = value.name;
        
        if (businessUnitName) {
          debouncedNameCheck(businessUnitName);
        } else {
          setNameValidationState({
            checking: false,
            available: null,
            message: ''
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, form, debouncedNameCheck]);

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        
        // Check database connection
        await checkDatabaseConnection();
        
      } catch (error: any) {
        const formattedError = ApiUtils.handleApiError(error);
        
        setSubmitResult({
          type: 'error',
          message: formattedError.message || 'Failed to initialize',
        });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  // Handle save business unit
  const handleSaveBusinessUnit = async (data: FormValues) => {
    if (!databaseInfo?.connected) {
      setSubmitResult({
        type: 'error',
        message: 'Cannot create business unit: Database connection is not available.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final check before submitting
      const nameCheck = await checkBusinessUnitNameAvailability(data.name);
      
      if (!nameCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Business Unit name already exists. Please choose a different name.',
        });
        setIsSubmitting(false);
        return;
      }

      await BusinessUnitAPI.create(data);
      
      setSubmitResult({
        type: 'success',
        message: 'Business Unit created successfully!',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form after successful creation
      form.reset({
        name: '',
        description: '',
        is_active: true,
      });
      setNameValidationState({
        checking: false,
        available: null,
        message: ''
      });
      
    } catch (error: any) {
      const formattedError = ApiUtils.handleApiError(error);
      
      let errorMessage = formattedError.message || 'Failed to create business unit. Please try again.';
      
      if (errorMessage.includes('unique')) {
        errorMessage = 'Business Unit name already exists. Please choose a different name.';
      }
      
      if (errorMessage.includes('Sequelize')) {
        errorMessage = 'Database error. Please check your connection and try again.';
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
      name: '',
      description: '',
      is_active: true,
    });
    setSubmitResult(null);
    setNameValidationState({
      checking: false,
      available: null,
      message: ''
    });
  };

  // Handle close form with navigation
  const handleCloseForm = () => {
    if (onClose) {
      onClose();
    } else {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/business-units');
      }
    }
  };

  // Get name field error
  const nameError = form.formState.errors.name;

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col justify-center items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span>Loading...</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Building className="h-6 w-6" />
            Create New Business Unit
          </CardTitle>
          <CardDescription>
            Define a new business unit within your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Connection Warning */}
          {!databaseInfo?.connected && (
            <Alert className="mb-6 bg-red-50 text-red-800 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="font-medium">
                <strong>Warning:</strong> Database connection is not available. 
                You cannot create business units until the database connection is restored.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveBusinessUnit)} className="space-y-6">
              
              {/* Business Unit Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Business Unit Name *
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Sales Department, IT Team, etc." 
                          {...field}
                          className={
                            nameValidationState.checking ? 'border-yellow-500 pr-10' :
                            nameError ? 'border-red-500 pr-10' :
                            nameValidationState.available === true ? 'border-green-500 pr-10' :
                            'pr-10'
                          }
                          onBlur={field.onBlur}
                          disabled={!databaseInfo?.connected}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {nameValidationState.checking && (
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                          )}
                          {!nameValidationState.checking && nameValidationState.available === true && !nameError && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {!nameValidationState.checking && (nameValidationState.available === false || nameError) && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Name of the business unit (must be globally unique)
                    </FormDescription>
                    
                    {/* Validation Status */}
                    {nameValidationState.checking && (
                      <div className="flex items-center text-yellow-600 text-sm mt-1">
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Checking name availability...
                      </div>
                    )}
                    
                    {!nameValidationState.checking && nameValidationState.message && (
                      <div className={`flex items-center text-sm mt-1 ${
                        nameValidationState.available === true ? 'text-green-600' : 
                        nameValidationState.available === false ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {nameValidationState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                        {nameValidationState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                        {nameValidationState.message}
                      </div>
                    )}
                    
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
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Description
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter business unit description, responsibilities, and purpose..." 
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                        disabled={!databaseInfo?.connected}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional description of the business unit's role and responsibilities
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active Status - Hidden but can be shown if needed */}
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input 
                        type="hidden"
                        {...field}
                        value={field.value ? 'true' : 'false'}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Current Selection Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Selection</CardTitle>
                  <CardDescription>
                    Review your business unit configuration before saving
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Business Unit Name:</span>{' '}
                      {form.watch('name') || <span className="text-muted-foreground">Not set</span>}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Description:</span>{' '}
                      {form.watch('description') || <span className="text-muted-foreground">No description provided</span>}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="text-green-600">Active (default)</span>
                    </div>
                    <div>
                      <span className="font-medium">Database Status:</span>{' '}
                      {databaseInfo?.connected ? 'Connected' : 'Not Connected'}
                    </div>
                    <div>
                      <span className="font-medium">Name Status:</span>{' '}
                      {form.watch('name') ? (
                        nameValidationState.checking ? (
                          <span className="text-yellow-600 flex items-center">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Checking...
                          </span>
                        ) : nameError || nameValidationState.available === false ? (
                          <span className="text-red-600 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Already exists
                          </span>
                        ) : nameValidationState.available === true ? (
                          <span className="text-green-600 flex items-center">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Available
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not checked</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">Not checked</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !form.formState.isValid || nameValidationState.available === false || nameError !== undefined || !databaseInfo?.connected}
                  className="min-w-[200px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Business Unit'
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClearAll}
                  disabled={isSubmitting || !databaseInfo?.connected}
                >
                  Clear All
                </Button>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                >
                  Close Form
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

export default CreateBusinessUnit;