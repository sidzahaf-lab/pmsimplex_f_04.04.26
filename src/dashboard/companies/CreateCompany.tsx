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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Building, Globe, Phone, MapPin, Briefcase } from 'lucide-react';
import { CompanyAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Check slug availability
const checkSlugAvailability = async (slug: string): Promise<{ available: boolean; message?: string }> => {
  if (!slug) return { available: true };
  
  try {
    const response = await CompanyAPI.checkSlug(slug.trim());
    const data = response.data || response;
    return {
      available: data.available ?? true,
      message: data.message
    };
  } catch (error: any) {
    console.error('Error checking slug:', error);
    ApiUtils.handleApiError(error);
    return { 
      available: true, 
      message: 'Error checking slug availability' 
    };
  }
};

// Check name availability
const checkNameAvailability = async (name: string): Promise<{ available: boolean; message?: string }> => {
  if (!name) return { available: true };
  
  try {
    const response = await CompanyAPI.checkName(name.trim());
    const data = response.data || response;
    return {
      available: data.available ?? true,
      message: data.message
    };
  } catch (error: any) {
    console.error('Error checking name:', error);
    ApiUtils.handleApiError(error);
    return { 
      available: true, 
      message: 'Error checking name availability' 
    };
  }
};

// Form schema - simplified with better type handling
const formSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(25, 'Slug must be less than 25 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  
  name: z.string()
    .min(1, 'Company name is required')
    .max(50, 'Company name must be less than 50 characters'),
  
  address: z.string()
    .max(150, 'Address must be less than 150 characters')
    .optional(),
  
  phone: z.string()
    .max(16, 'Phone number must be less than 16 characters')
    .regex(/^\+[1-9][0-9]{7,14}$/, 'Phone must be in international format: + followed by country code and 7-14 digits')
    .optional()
    .or(z.literal('')),
  
  url: z.string()
    .max(100, 'URL must be less than 100 characters')
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),
  
  industry_sector: z.string()
    .min(1, 'Industry sector is required')
    .max(50, 'Industry sector must be less than 50 characters'),
  
  business_domain: z.string()
    .max(250, 'Business domain must be less than 250 characters')
    .optional(),
  
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  
  is_active: z.boolean().default(true),
});

type FormValues = {
  slug: string;
  name: string;
  address?: string;
  phone?: string;
  url?: string;
  industry_sector: string;
  business_domain?: string;
  description?: string;
  is_active: boolean;
};

interface CreateCompanyProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function CreateCompany({ onClose, onSuccess }: CreateCompanyProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Database connection state
  const [databaseInfo, setDatabaseInfo] = useState<{
    connected: boolean;
    type: string;
    database: string;
    host: string;
  } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [slugValidationState, setSlugValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [nameValidationState, setNameValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  // Create form with explicit type
  const formMethods = useForm<FormValues>({
    resolver: zodResolver(formSchema as any), // Use 'as any' to bypass type issues
    defaultValues: {
      slug: '',
      name: '',
      address: '',
      phone: '',
      url: '',
      industry_sector: '',
      business_domain: '',
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

  // Initialize component
  const initializeComponent = async () => {
    try {
      setLoading(true);
      
      // Check database connection
      const dbInfo = await checkDatabaseConnection();
      if (!dbInfo?.connected) {
        throw new Error(connectionError || 'Database connection failed');
      }
      
    } catch (error: any) {
      const formattedError = ApiUtils.handleApiError(error);
      
      setSubmitResult({
        type: 'error',
        message: formattedError.message || 'Failed to initialize form',
      });
    } finally {
      setLoading(false);
    }
  };

  // Real-time validation with debounce for slug
  const debouncedSlugCheck = useCallback(
    (slug: string) => {
      if (!slug || slug.length < 1) {
        setSlugValidationState({
          checking: false,
          available: null,
          message: ''
        });
        return;
      }

      setSlugValidationState({
        checking: true,
        available: null,
        message: 'Checking slug availability...'
      });

      const checkSlug = async () => {
        try {
          const result = await checkSlugAvailability(slug);
          setSlugValidationState({
            checking: false,
            available: result.available,
            message: result.message || (result.available ? 'Slug is available' : 'Slug already exists')
          });

          formMethods.trigger('slug');
        } catch (error) {
          setSlugValidationState({
            checking: false,
            available: null,
            message: 'Error checking slug availability'
          });
          ApiUtils.handleApiError(error);
        }
      };

      const timeoutId = setTimeout(checkSlug, 800);
      return () => clearTimeout(timeoutId);
    },
    [formMethods]
  );

  // Real-time validation with debounce for name
  const debouncedNameCheck = useCallback(
    (name: string) => {
      if (!name) {
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

      const checkName = async () => {
        try {
          const result = await checkNameAvailability(name);
          setNameValidationState({
            checking: false,
            available: result.available,
            message: result.message || (result.available ? 'Name is available' : 'Name already exists')
          });

          formMethods.trigger('name');
        } catch (error) {
          setNameValidationState({
            checking: false,
            available: null,
            message: 'Error checking name availability'
          });
          ApiUtils.handleApiError(error);
        }
      };

      const timeoutId = setTimeout(checkName, 800);
      return () => clearTimeout(timeoutId);
    },
    [formMethods]
  );

  // Watch for slug and name changes for real-time feedback
  useEffect(() => {
    const subscription = formMethods.watch((value, { name, type }) => {
      if (name === 'slug' && type === 'change') {
        const slug = value.slug;
        
        setSlugValidationState({
          checking: false,
          available: null,
          message: ''
        });

        if (slug && slug.length >= 1) {
          return debouncedSlugCheck(slug);
        }
      }
      
      if (name === 'name' && type === 'change') {
        const name = value.name;
        
        setNameValidationState({
          checking: false,
          available: null,
          message: ''
        });

        if (name) {
          return debouncedNameCheck(name);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [formMethods.watch, debouncedSlugCheck, debouncedNameCheck]);

  // Initialize on component mount
  useEffect(() => {
    initializeComponent();
  }, []);

  // Handle save company
  const handleSaveCompany = async (data: FormValues) => {
    if (!databaseInfo?.connected) {
      setSubmitResult({
        type: 'error',
        message: 'Cannot create company: Database connection is not available.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final checks before submitting
      const slugCheck = await checkSlugAvailability(data.slug);
      const nameCheck = await checkNameAvailability(data.name);
      
      if (!slugCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Company slug already exists. Please choose a different slug.',
        });
        setIsSubmitting(false);
        return;
      }

      if (!nameCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Company name already exists. Please choose a different name.',
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare data for API (convert empty strings to null for optional fields)
      const companyData = {
        slug: data.slug.trim(),
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        url: data.url?.trim() || null,
        industry_sector: data.industry_sector.trim(),
        business_domain: data.business_domain?.trim() || null,
        description: data.description?.trim() || null,
        is_active: data.is_active,
      };

      console.log('🚀 Creating company with data:', companyData);
      await CompanyAPI.create(companyData);
      
      setSubmitResult({
        type: 'success',
        message: 'Company created successfully!',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form after successful creation
      formMethods.reset({
        slug: '',
        name: '',
        address: '',
        phone: '',
        url: '',
        industry_sector: '',
        business_domain: '',
        description: '',
        is_active: true,
      });
      
      setSlugValidationState({
        checking: false,
        available: null,
        message: ''
      });
      setNameValidationState({
        checking: false,
        available: null,
        message: ''
      });
      
    } catch (error: any) {
      const formattedError = ApiUtils.handleApiError(error);
      
      let errorMessage = formattedError.message || 'Failed to create company. Please try again.';
      
      if (errorMessage.includes('unique constraint') || errorMessage.includes('already exists')) {
        if (errorMessage.includes('slug')) {
          errorMessage = 'Company slug already exists. Please choose a different slug.';
        } else if (errorMessage.includes('name')) {
          errorMessage = 'Company name already exists. Please choose a different name.';
        }
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
    formMethods.reset({
      slug: '',
      name: '',
      address: '',
      phone: '',
      url: '',
      industry_sector: '',
      business_domain: '',
      description: '',
      is_active: true,
    });
    setSubmitResult(null);
    setSlugValidationState({
      checking: false,
      available: null,
      message: ''
    });
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
        navigate('/companies');
      }
    }
  };

  // Get field errors
  const slugError = formMethods.formState.errors.slug;
  const nameError = formMethods.formState.errors.name;

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col justify-center items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span>Loading database information...</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={initializeComponent}
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
            Create New Company
          </CardTitle>
          <CardDescription>
            Add a new company to the system with all necessary business information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Connection Warning */}
          {!databaseInfo?.connected && (
            <Alert className="mb-6 bg-red-50 text-red-800 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="font-medium">
                <strong>Warning:</strong> Database connection is not available. 
                You cannot create companies until the database connection is restored.
              </AlertDescription>
            </Alert>
          )}

          <Form {...formMethods}>
            <form onSubmit={formMethods.handleSubmit(handleSaveCompany)} className="space-y-6">
              
              {/* Company Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                  <CardDescription>
                    Company identifier and contact details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Slug */}
                    <FormField
                      control={formMethods.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Company Slug *
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="acme-corp" 
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setSlugValidationState({
                                    checking: false,
                                    available: null,
                                    message: ''
                                  });
                                }}
                                className={
                                  slugValidationState.checking ? 'border-yellow-500 pr-10' :
                                  slugError ? 'border-red-500 pr-10' :
                                  slugValidationState.available === true ? 'border-green-500 pr-10' :
                                  slugValidationState.available === false ? 'border-red-500 pr-10' :
                                  'pr-10'
                                }
                                onBlur={field.onBlur}
                                disabled={!databaseInfo?.connected}
                              />
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {slugValidationState.checking && (
                                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                )}
                                {!slugValidationState.checking && slugValidationState.available === true && !slugError && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                                {!slugValidationState.checking && (slugValidationState.available === false || slugError) && (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </div>
                          </FormControl>
                          
                          {/* Validation Status */}
                          {slugValidationState.checking && (
                            <div className="flex items-center text-yellow-600 text-sm mt-1">
                              <Loader2 className="h-3 w-3 animate-spin mr-2" />
                              Checking slug availability...
                            </div>
                          )}
                          
                          {!slugValidationState.checking && slugValidationState.message && (
                            <div className={`flex items-center text-sm mt-1 ${
                              slugValidationState.available === true ? 'text-green-600' : 
                              slugValidationState.available === false ? 'text-red-600' : 
                              'text-gray-600'
                            }`}>
                              {slugValidationState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                              {slugValidationState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                              {slugValidationState.message}
                            </div>
                          )}
                          
                          <FormDescription>
                            Unique identifier for the company (lowercase letters, numbers, and hyphens only)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Name */}
                    <FormField
                      control={formMethods.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Company Name *
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="Acme Corporation" 
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setNameValidationState({
                                    checking: false,
                                    available: null,
                                    message: ''
                                  });
                                }}
                                className={
                                  nameValidationState.checking ? 'border-yellow-500 pr-10' :
                                  nameError ? 'border-red-500 pr-10' :
                                  nameValidationState.available === true ? 'border-green-500 pr-10' :
                                  nameValidationState.available === false ? 'border-red-500 pr-10' :
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
                  </div>

                  {/* Description */}
                  <FormField
                    control={formMethods.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of the company..." 
                            className="min-h-[80px]"
                            {...field}
                            disabled={!databaseInfo?.connected}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description of the company
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formMethods.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Address
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123 Main Street, City, Country" 
                            {...field}
                            disabled={!databaseInfo?.connected}
                          />
                        </FormControl>
                        <FormDescription>
                          Company's physical address
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={formMethods.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+1234567890" 
                              {...field}
                              disabled={!databaseInfo?.connected}
                            />
                          </FormControl>
                          <FormDescription>
                            International format with country code
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={formMethods.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Website URL
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://www.example.com" 
                              {...field}
                              disabled={!databaseInfo?.connected}
                            />
                          </FormControl>
                          <FormDescription>
                            Company's official website
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Business Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Business Information</CardTitle>
                  <CardDescription>
                    Company's industry and business details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={formMethods.control}
                    name="industry_sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Industry Sector *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Technology, Healthcare, Finance, etc." 
                            {...field}
                            disabled={!databaseInfo?.connected}
                          />
                        </FormControl>
                        <FormDescription>
                          Primary industry sector the company operates in
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formMethods.control}
                    name="business_domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Domain</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Products and services description" 
                            {...field}
                            disabled={!databaseInfo?.connected}
                          />
                        </FormControl>
                        <FormDescription>
                          Description of products, services, and business focus
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formMethods.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Active Status
                          </FormLabel>
                          <FormDescription>
                            Company account will be active upon creation
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={!databaseInfo?.connected}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Current Selection Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Selection</CardTitle>
                  <CardDescription>
                    Review your company configuration before saving
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Slug:</span>{' '}
                      {formMethods.watch('slug') || <span className="text-muted-foreground">Not set</span>}
                    </div>
                    <div>
                      <span className="font-medium">Name:</span>{' '}
                      {formMethods.watch('name') || <span className="text-muted-foreground">Not set</span>}
                    </div>
                    <div>
                      <span className="font-medium">Industry Sector:</span>{' '}
                      {formMethods.watch('industry_sector') || <span className="text-muted-foreground">Not set</span>}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      {formMethods.watch('is_active') ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Database Status:</span>{' '}
                      {databaseInfo?.connected ? 'Connected' : 'Not Connected'}
                    </div>
                    <div>
                      <span className="font-medium">Database Type:</span>{' '}
                      {databaseInfo?.type || 'Unknown'}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Slug Status:</span>{' '}
                      {formMethods.watch('slug') ? (
                        slugValidationState.checking ? (
                          <span className="text-yellow-600 flex items-center">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Checking...
                          </span>
                        ) : slugError || slugValidationState.available === false ? (
                          <span className="text-red-600 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Already exists
                          </span>
                        ) : slugValidationState.available === true ? (
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
                    <div className="md:col-span-2">
                      <span className="font-medium">Name Status:</span>{' '}
                      {formMethods.watch('name') ? (
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
                  disabled={isSubmitting || !formMethods.formState.isValid || 
                    slugValidationState.available === false ||
                    nameValidationState.available === false ||
                    !databaseInfo?.connected}
                  className="min-w-[200px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Company'
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

export default CreateCompany;