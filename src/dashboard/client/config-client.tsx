import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Building, Globe, Key, Info, AlertTriangle } from 'lucide-react';
import { ClientAPI, SystemAPI } from '@/services/api';
import { ApiUtils } from '@/utils/apiUtils';

// Client type
interface Client {
  id: number;
  name: string;
  slug: string;
  url?: string;
  created_at: string;
  business_units?: any[];
  business_units_count?: number;
}

// Updated ApiResponse interface to include 'available' property
interface ApiResponse {
  client?: Client;
  clients?: Client[];
  data?: {
    client?: Client;
    clients?: Client[];
    available?: boolean;
  };
  id?: number;
  slug?: string;
  name?: string;
  available?: boolean; // Added this property
}

// Validation schema for new client creation
const createFormSchema = z.object({
  slug: z.string()
    .min(1, 'Client slug is required')
    .max(25, 'Client slug must be less than 25 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  
  name: z.string()
    .min(1, 'Company name is required')
    .max(50, 'Company name must be less than 50 characters'),
  
  url: z.string()
    .url('URL must be a valid URL')
    .max(50, 'URL must be less than 50 characters')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof createFormSchema>;

interface ConfigClientProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ConfigClient({ onClose, onSuccess }: ConfigClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingClient, setExistingClient] = useState<Client | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [showComponent, setShowComponent] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      slug: '',
      name: '',
      url: '',
    },
    mode: 'onChange',
  });

  // Fetch client data
  const fetchClientData = async () => {
    try {
      setLoading(true);
      
      // Try multiple approaches to get the client
      let clientData: Client | null = null;
      
      // Approach 2: Try getting client by ID 1
      if (!clientData) {
        try {
          const response = await ClientAPI.getById(1);
          console.log('📦 Client by ID response:', response);
          // Type the response data
          const responseData = response.data as ApiResponse;
          if (responseData?.client) {
            clientData = responseData.client;
          } else if (responseData?.id === 1) {
            // If response itself has an id, it might be the client
            clientData = responseData as Client;
          }
        } catch (error) {
          console.log('Client by ID endpoint failed:', error);
        }
      }
      
      // Approach 3: Try database test endpoint
      if (!clientData) {
        try {
          const response = await SystemAPI.testDb();
          console.log('📦 Test DB response:', response);
          // Type the response data
          const responseData = response.data as ApiResponse;
          if (responseData?.clients && responseData.clients.length > 0) {
            clientData = responseData.clients[0];
          } else if (responseData?.data?.clients && responseData.data.clients.length > 0) {
            clientData = responseData.data.clients[0];
          }
        } catch (error) {
          console.log('Database test endpoint failed:', error);
        }
      }
      
      // Approach 4: Try monorepo client endpoint
      if (!clientData) {
        try {
          const response = await ClientAPI.getMonorepoClient();
          console.log('📦 Monorepo client response:', response);
          // Type the response data
          const responseData = response.data as ApiResponse;
          if (responseData?.client) {
            clientData = responseData.client;
          } else if (responseData?.id) {
            clientData = responseData as Client;
          }
        } catch (error) {
          console.log('Monorepo client endpoint failed:', error);
        }
      }
      
      if (clientData) {
        console.log('✅ Found client:', clientData);
        setExistingClient(clientData);
        
        // Pre-fill form with existing client data
        form.reset({
          slug: clientData.slug,
          name: clientData.name,
          url: clientData.url || '',
        });
      } else {
        console.log('📭 No client found');
        setExistingClient(null);
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching client data:', error);
      const formattedError = ApiUtils.handleApiError(error);
      console.error('Formatted error:', formattedError);
      setExistingClient(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  // Check slug availability (only for new client)
  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 1 || existingClient) {
      setSlugAvailable(null);
      return;
    }

    setIsCheckingSlug(true);
    try {
      const response = await ClientAPI.checkSlug(slug);
      // Type the response data - fix for line 199 error
      const responseData = response.data as ApiResponse;
      // Handle different response formats
      const available = responseData?.available ?? responseData?.data?.available ?? false;
      setSlugAvailable(available);
    } catch (error) {
      console.error('Error checking slug availability:', error);
      const formattedError = ApiUtils.handleApiError(error);
      console.error('Formatted error:', formattedError);
      setSlugAvailable(false);
    } finally {
      setIsCheckingSlug(false);
    }
  };

  // Check name availability (only for new client)
  const checkNameAvailability = async (name: string) => {
    if (!name || name.length < 1 || existingClient) {
      setNameAvailable(null);
      return;
    }

    setIsCheckingName(true);
    try {
      const response = await ClientAPI.checkName(name);
      // Type the response data - fix for line 222 error
      const responseData = response.data as ApiResponse;
      // Handle different response formats
      const available = responseData?.available ?? responseData?.data?.available ?? false;
      setNameAvailable(available);
    } catch (error) {
      console.error('Error checking name availability:', error);
      const formattedError = ApiUtils.handleApiError(error);
      console.error('Formatted error:', formattedError);
      setNameAvailable(false);
    } finally {
      setIsCheckingName(false);
    }
  };

  // Debounced slug checking (only for new client)
  useEffect(() => {
    if (existingClient) return; // Skip if client exists
    
    const slug = form.watch('slug');
    const timeoutId = setTimeout(() => {
      checkSlugAvailability(slug);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch('slug'), existingClient]);

  // Debounced name checking (only for new client)
  useEffect(() => {
    if (existingClient) return; // Skip if client exists
    
    const name = form.watch('name');
    const timeoutId = setTimeout(() => {
      checkNameAvailability(name);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch('name'), existingClient]);

  // Handle save client (for new client only)
  const handleSaveClient = async (data: FormValues) => {
    if (existingClient) {
      setSubmitResult({
        type: 'error',
        message: 'Client already exists. Cannot create a new one in monorepo.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Create new client using the new API service
      const response = await ClientAPI.create(data);
      // Type the response data
      const responseData = response.data as ApiResponse;
      
      setSubmitResult({
        type: 'success',
        message: 'Monorepo client created successfully! This is now your main client (ID: 1).',
      });
      
      // Update state - handle different response formats
      let newClient: Client | null = null;
      if (responseData?.client) {
        newClient = responseData.client;
      } else if (responseData?.id) {
        newClient = responseData as Client;
      }
      
      if (newClient) {
        setExistingClient(newClient);
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('Error creating client:', error);
      const formattedError = ApiUtils.handleApiError(error);
      console.error('Formatted error:', formattedError);
      
      let errorMessage = formattedError.message || 'Failed to create client. Please try again.';
      
      // Check for monorepo enforcement error
      if (errorMessage.includes('monorepo') || errorMessage.includes('only one client')) {
        errorMessage = 'This is a monorepo application. Only one client can be configured.';
      } else if (errorMessage.includes('unique')) {
        errorMessage = errorMessage.includes('slug') 
          ? 'Client slug already exists. Please choose a different slug.'
          : 'Company name already exists. Please choose a different name.';
      }

      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle clear all button (only for new client form)
  const handleClearAll = () => {
    if (existingClient) return;
    
    form.reset({
      slug: '',
      name: '',
      url: '',
    });
    setSubmitResult(null);
    setSlugAvailable(null);
    setNameAvailable(null);
  };

  // Handle close form
  const handleCloseForm = () => {
    console.log('🔘 Close button clicked');
    console.log('📞 onClose prop:', onClose);
    console.log('📞 onClose type:', typeof onClose);
    
    // First try to call the provided onClose callback
    if (onClose && typeof onClose === 'function') {
      console.log('✅ Calling provided onClose callback');
      try {
        onClose();
      } catch (error) {
        console.error('❌ Error in onClose callback:', error);
        // Fallback to hiding the component
        setShowComponent(false);
      }
    } else {
      console.log('⚠️ No onClose callback provided, hiding component');
      // If no callback provided, simply hide the component
      setShowComponent(false);
    }
  };

  // Force re-fetch client data
  const handleRefresh = () => {
    setLoading(true);
    fetchClientData();
  };

  // Don't render anything if component is hidden
  if (!showComponent) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col justify-center items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span>Loading client configuration...</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="mt-2"
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingClient) {
    // Display existing client information
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Building className="h-6 w-6" />
              Client Configuration
            </CardTitle>
            {/* <CardDescription>
              Your main client is already configured (ID: {existingClient.id})
            </CardDescription> */}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monorepo Info Card */}
            {/* <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Monorepo Application - Client Configured
                </CardTitle>
                <CardDescription>
                  This application is configured for a single client (ID: 1).
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Application Type:</span>{' '}
                    <span className="text-blue-600">Monorepo (Single Client)</span>
                  </div>
                  <div>
                    <span className="font-medium">Client ID:</span>{' '}
                    <span className="font-mono font-bold">{existingClient.id}</span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="text-green-600 font-semibold">✓ Configured</span>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(existingClient.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* Client Information Display */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Client Information</CardTitle>
                <CardDescription>
                  Current client configuration (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4" />
                      Client Slug
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={existingClient.slug} 
                        readOnly 
                        className="bg-gray-100 font-mono"
                      />
                      <span className="text-xs text-muted-foreground">(Cannot be changed)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unique identifier for your client
                    </p>
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4" />
                      Company Name
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={existingClient.name} 
                        readOnly 
                        className="bg-gray-100"
                      />
                      <span className="text-xs text-muted-foreground">(Cannot be changed)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Official name of your company
                    </p>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4" />
                      Website URL
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={existingClient.url || 'Not set'} 
                        readOnly 
                        className="bg-gray-100"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Company website URL
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Important Note */}
            <Alert className="bg-amber-50 text-amber-800 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="font-medium">
                <strong>Demo Environment Notice:</strong>
                simplexenergy is a demonstration client provided as a sandbox to showcase the platform’s core features.
                <br />This environment operates on a standalone database, isolated from any production data.
                <strong>Real client environments are configured on demand, each with its own dedicated database, settings, workflows, and access rules tailored to specific organizational requirements.</strong>
              </AlertDescription>
            </Alert>

            {/* Action Buttons for existing client */}
            <div className="flex gap-4 pt-4">
              <Button 
                type="button"
                onClick={handleCloseForm}
                className="flex-1"
              >
                Close
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={handleRefresh}
                className="flex-1"
              >
                Refresh
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // New client form
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Building className="h-6 w-6" />
            Configure Monorepo Client
          </CardTitle>
          <CardDescription>
            Set up your main client for this monorepo application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-blue-50 text-blue-800 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              This is a monorepo application. Only one client can be configured (ID: 1).
            </AlertDescription>
          </Alert>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveClient)} className="space-y-6">
              
              {/* Monorepo Info Card */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    Monorepo Application Setup
                  </CardTitle>
                  <CardDescription>
                    This is a monorepo application that requires exactly one client configuration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Application Type:</span>{' '}
                      <span className="text-blue-600">Monorepo (Single Client)</span>
                    </div>
                    <div>
                      <span className="font-medium">Client ID:</span>{' '}
                      <span className="font-mono font-bold">Will be: 1</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Important:</span>{' '}
                      <span className="text-red-600 font-semibold">
                        Once created, client slug, name, and URL cannot be changed.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Slug */}
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Client Slug *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder="company-slug" 
                            {...field}
                            className={
                              form.formState.errors.slug ? 'border-red-500 pr-10' : 
                              slugAvailable === true ? 'border-green-500 pr-10' :
                              slugAvailable === false ? 'border-red-500 pr-10' : 'pr-10'
                            }
                          />
                          {isCheckingSlug && (
                            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                          )}
                          {slugAvailable === true && !isCheckingSlug && (
                            <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                          )}
                          {slugAvailable === false && !isCheckingSlug && (
                            <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Unique identifier (cannot be changed after creation)
                      </FormDescription>
                      {slugAvailable === true && (
                        <p className="text-sm text-green-600">✓ This slug is available</p>
                      )}
                      {slugAvailable === false && (
                        <p className="text-sm text-red-600">✗ This slug is already taken</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Company Name */}
                <FormField
                  control={form.control}
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
                            placeholder="Your Company Name" 
                            {...field}
                            className={
                              form.formState.errors.name ? 'border-red-500 pr-10' : 
                              nameAvailable === true ? 'border-green-500 pr-10' :
                              nameAvailable === false ? 'border-red-500 pr-10' : 'pr-10'
                            }
                          />
                          {isCheckingName && (
                            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
                          )}
                          {nameAvailable === true && !isCheckingName && (
                            <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                          )}
                          {nameAvailable === false && !isCheckingName && (
                            <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Official name (cannot be changed after creation)
                      </FormDescription>
                      {nameAvailable === true && (
                        <p className="text-sm text-green-600">✓ This name is available</p>
                      )}
                      {nameAvailable === false && (
                        <p className="text-sm text-red-600">✗ This name is already taken</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* URL */}
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website URL (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.yourcompany.com" 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional website URL (cannot be changed after creation)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !form.formState.isValid}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Monorepo Client'
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClearAll}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Clear All
                </Button>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Close
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

export default ConfigClient;