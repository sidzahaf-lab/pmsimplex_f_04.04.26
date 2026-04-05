// frontend/src/dashboard/users/CreateUser.tsx
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Shield, 
  Clock, 
  Briefcase, 
  Building, 
  Check,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { apiClient, BusinessUnitAPI } from '@/services/api';

// Types
interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface Role {
  id: string;
  name: string;
  scope: string;
}

// Create an extended schema with async refinement
const createFormSchema = () => z.object({
  // Step 1: Personal Information
  name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  
  family_name: z.string()
    .min(1, 'Family name is required')
    .max(50, 'Family name must be less than 50 characters'),
  
  phone_number: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Please provide a valid phone number')
    .optional()
    .or(z.literal('')),
  
  title: z.string()
    .min(1, 'Job title is required')
    .max(100, 'Job title must be less than 100 characters'),
  
  specialty: z.string()
    .min(1, 'Department is required')
    .max(50, 'Department must be less than 50 characters'),
  
  // Step 2: Role Assignment & Business Unit (merged)
  user_type: z.enum(['regular', 'guest', 'corporate'], {
    required_error: 'Please select a user type',
  }),
  
  corporate_role_id: z.string().optional().nullable(),
  default_role_id: z.string().optional().nullable(),
  business_unit_id: z.string().optional().nullable(),
  
  // Step 3: Account Information
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens and underscores'),
  
  email: z.string()
    .email('Please provide a valid email address')
    .max(100, 'Email must be less than 100 characters'),
  
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be less than 128 characters'),
  
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

interface CreateUserProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function CreateUser({ onClose, onSuccess }: CreateUserProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [corporateRoles, setCorporateRoles] = useState<Role[]>([]);
  const [projectRoles, setProjectRoles] = useState<Role[]>([]);
  const [buRoles, setBuRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameValidationState, setUsernameValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [emailValidationState, setEmailValidationState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const form = useForm<FormValues>({
    resolver: zodResolver(createFormSchema()),
    defaultValues: {
      name: '',
      family_name: '',
      phone_number: '',
      title: '',
      specialty: '',
      user_type: 'regular',
      corporate_role_id: null,
      default_role_id: null,
      business_unit_id: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  // Watch user type to conditionally show role selection
  const userType = form.watch('user_type');
  
  // Watch form values for validation
  const nameValue = form.watch('name');
  const familyNameValue = form.watch('family_name');
  const titleValue = form.watch('title');
  const specialtyValue = form.watch('specialty');

  // Check if current step is valid
  const isStepValid = () => {
    const errors = form.formState.errors;
    
    switch (currentStep) {
      case 1:
        return !!nameValue && !errors.name &&
                !!familyNameValue && !errors.family_name &&
                !!titleValue && !errors.title &&
                !!specialtyValue && !errors.specialty;
        
      case 2:
        const userTypeValue = form.getValues('user_type');
        if (userTypeValue === 'corporate') {
          const corporateRoleId = form.getValues('corporate_role_id');
          return !!corporateRoleId;
        } else if (userTypeValue === 'regular') {
          const businessUnitId = form.getValues('business_unit_id');
          return !!businessUnitId;
        }
        return true;
        
      case 3:
        const username = form.getValues('username');
        const email = form.getValues('email');
        const password = form.getValues('password');
        const confirmPassword = form.getValues('confirmPassword');
        
        return !!username && !errors.username &&
                !!email && !errors.email &&
                !!password && !errors.password &&
                !!confirmPassword && !errors.confirmPassword &&
                usernameValidationState.available === true &&
                emailValidationState.available === true;
        
      default:
        return false;
    }
  };

  // Get the next step number
  const getNextStep = () => {
    return currentStep + 1;
  };

  // Check username availability
  const checkUsernameAvailability = async (username: string): Promise<{ available: boolean; message?: string }> => {
    if (!username || username.length < 3) return { available: true };
    
    try {
      const response = await apiClient.get(`/users/check-username/${encodeURIComponent(username.trim())}`);
      return response.data.data;
    } catch (error: any) {
      console.error('Error checking username:', error);
      return { available: true, message: 'Error checking username availability' };
    }
  };

  // Check email availability
  const checkEmailAvailability = async (email: string): Promise<{ available: boolean; message?: string }> => {
    if (!email) return { available: true };
    
    try {
      const response = await apiClient.get(`/users/check-email/${encodeURIComponent(email.trim())}`);
      return response.data.data;
    } catch (error: any) {
      console.error('Error checking email:', error);
      return { available: true, message: 'Error checking email availability' };
    }
  };

  // Real-time validation with debounce for username
  const debouncedUsernameCheck = useCallback(
    debounce(async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameValidationState({
          checking: false,
          available: null,
          message: ''
        });
        return;
      }

      setUsernameValidationState({
        checking: true,
        available: null,
        message: 'Checking username availability...'
      });

      try {
        const result = await checkUsernameAvailability(username);
        setUsernameValidationState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Username is available' : 'Username already exists')
        });

        form.trigger('username');
      } catch (error) {
        setUsernameValidationState({
          checking: false,
          available: null,
          message: 'Error checking username availability'
        });
        console.error('Error checking username:', error);
      }
    }, 800),
    [form]
  );

  // Real-time validation with debounce for email
  const debouncedEmailCheck = useCallback(
    debounce(async (email: string) => {
      if (!email) {
        setEmailValidationState({
          checking: false,
          available: null,
          message: ''
        });
        return;
      }

      setEmailValidationState({
        checking: true,
        available: null,
        message: 'Checking email availability...'
      });

      try {
        const result = await checkEmailAvailability(email);
        setEmailValidationState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Email is available' : 'Email already exists')
        });

        form.trigger('email');
      } catch (error) {
        setEmailValidationState({
          checking: false,
          available: null,
          message: 'Error checking email availability'
        });
        console.error('Error checking email:', error);
      }
    }, 800),
    [form]
  );

  // Watch for username and email changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'username' && type === 'change') {
        const username = value.username;
        
        setUsernameValidationState({
          checking: false,
          available: null,
          message: ''
        });

        if (username && username.length >= 3) {
          debouncedUsernameCheck(username);
        }
      }
      
      if (name === 'email' && type === 'change') {
        const email = value.email;
        
        setEmailValidationState({
          checking: false,
          available: null,
          message: ''
        });

        if (email) {
          debouncedEmailCheck(email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch, debouncedUsernameCheck, debouncedEmailCheck]);

  // Fetch business units and roles
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch business units
      console.log('📡 Fetching business units...');
      const businessUnitsResponse = await BusinessUnitAPI.getAll();
      
      let businessUnitsData: BusinessUnit[] = [];
      
      if (businessUnitsResponse.data && 
          businessUnitsResponse.data.data && 
          businessUnitsResponse.data.data.business_units && 
          Array.isArray(businessUnitsResponse.data.data.business_units)) {
        businessUnitsData = businessUnitsResponse.data.data.business_units;
      } else if (businessUnitsResponse.data && Array.isArray(businessUnitsResponse.data)) {
        businessUnitsData = businessUnitsResponse.data;
      } else if (Array.isArray(businessUnitsResponse.data)) {
        businessUnitsData = businessUnitsResponse.data;
      }
      
      setBusinessUnits(businessUnitsData);
      console.log(`✅ Loaded ${businessUnitsData.length} business units`);
      
      // Fetch all roles with authentication
      console.log('📡 Fetching roles...');
      const rolesResponse = await apiClient.get('/roles');
      
      let rolesData: Role[] = [];
      
      // Extract roles from response
      if (rolesResponse.data?.data?.roles && Array.isArray(rolesResponse.data.data.roles)) {
        rolesData = rolesResponse.data.data.roles;
      } else if (rolesResponse.data?.roles && Array.isArray(rolesResponse.data.roles)) {
        rolesData = rolesResponse.data.roles;
      } else if (Array.isArray(rolesResponse.data)) {
        rolesData = rolesResponse.data;
      } else if (rolesResponse.data?.data && Array.isArray(rolesResponse.data.data)) {
        rolesData = rolesResponse.data.data;
      }
      
      console.log(`📊 Total roles found: ${rolesData.length}`);
      
      // Log all roles
      if (rolesData.length > 0) {
        console.log('📋 All roles:');
        rolesData.forEach(role => {
          console.log(`   - ${role.name} (scope: ${role.scope})`);
        });
      }
      
      // Categorize roles by scope
      const corporate = rolesData.filter(role => role.scope === 'corporate');
      const project = rolesData.filter(role => role.scope === 'project');
      const bu = rolesData.filter(role => role.scope === 'bu');
      
      console.log('📊 Categorized roles:');
      console.log(`   Corporate: ${corporate.length}`, corporate.map(r => r.name).join(', '));
      console.log(`   Project: ${project.length}`, project.map(r => r.name).join(', '));
      console.log(`   BU: ${bu.length}`, bu.map(r => r.name).join(', '));
      
      setCorporateRoles(corporate);
      setProjectRoles(project);
      setBuRoles(bu);
      
      // Set default business unit if available
      if (businessUnitsData.length > 0) {
        form.setValue('business_unit_id', businessUnitsData[0].id);
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching data:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to load data';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      
      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle next step
  const handleNext = () => {
    if (isStepValid()) {
      const nextStep = getNextStep();
      setCurrentStep(nextStep);
    } else {
      form.trigger();
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Handle save user
  const handleSaveUser = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final checks before submitting
      const usernameCheck = await checkUsernameAvailability(data.username);
      const emailCheck = await checkEmailAvailability(data.email);
      
      if (!usernameCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Username already exists. Please choose a different username.',
        });
        setIsSubmitting(false);
        return;
      }

      if (!emailCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Email already exists. Please use a different email address.',
        });
        setIsSubmitting(false);
        return;
      }

      // Map frontend field names to backend model fields
      const { confirmPassword, title, specialty, user_type, corporate_role_id, default_role_id, business_unit_id, ...rest } = data;
      
      const userData: any = {
        ...rest,
        job_title: title,
        department: specialty,
      };
      
      // Only include business_unit_id for regular users
      if (user_type === 'regular' && business_unit_id) {
        userData.business_unit_id = business_unit_id;
      }
      
      // Set role hierarchy fields based on user type
      if (user_type === 'guest') {
        userData.is_guest = true;
      } else if (user_type === 'corporate' && corporate_role_id) {
        userData.corporate_role_id = corporate_role_id;
      } else if (user_type === 'regular' && default_role_id) {
        userData.default_role_id = default_role_id;
      }

      console.log('🚀 Creating user with data:', userData);
      await apiClient.post('/users', userData);
      
      setSubmitResult({
        type: 'success',
        message: 'User created successfully!',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      setTimeout(() => {
        handleClearAll();
        if (onClose) onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to create user. Please try again.';
      
      if (errorMessage.includes('unique constraint') || errorMessage.includes('already exists')) {
        if (errorMessage.includes('username')) {
          errorMessage = 'Username already exists. Please choose a different username.';
        } else if (errorMessage.includes('email')) {
          errorMessage = 'Email already exists. Please use a different email address.';
        }
      }

      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
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
      family_name: '',
      phone_number: '',
      title: '',
      specialty: '',
      user_type: 'regular',
      corporate_role_id: null,
      default_role_id: null,
      business_unit_id: businessUnits.length > 0 ? businessUnits[0].id : '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setCurrentStep(1);
    setSubmitResult(null);
    setUsernameValidationState({
      checking: false,
      available: null,
      message: ''
    });
    setEmailValidationState({
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
        navigate('/users');
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="ml-2">Loading data...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine which steps to show
  const visibleSteps = [1, 2, 3];

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center">
          {visibleSteps.map((step, index) => {
            const isLast = index === visibleSteps.length - 1;
            return (
              <div key={step} className="flex-1 flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep === step 
                    ? 'border-blue-600 bg-blue-600 text-white' 
                    : currentStep > step 
                      ? 'border-green-500 bg-green-500 text-white' 
                      : 'border-gray-300 bg-white text-gray-500'
                }`}>
                  {currentStep > step ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-center w-20">Personal Info</span>
          <span className="text-center w-20">Role & Business Unit</span>
          <span className="text-center w-20">Account</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSaveUser)} className="space-y-6">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Personal Information</CardTitle>
                <CardDescription>
                  Enter the user's personal and professional details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="family_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Family Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Project Manager" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department *</FormLabel>
                        <FormControl>
                          <Input placeholder="Software Development" {...field} />
                        </FormControl>
                        <FormDescription>Department or specialty area</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormDescription>Optional phone number with country code</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Role Assignment & Business Unit */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Role & Business Unit Assignment</CardTitle>
                <CardDescription>
                  Select the user's role in the system and assign to business unit (if applicable)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User Type Selection */}
                <FormField
                  control={form.control}
                  name="user_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="regular">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <span>Regular User</span>
                              <span className="text-xs text-muted-foreground ml-2">(Project or BU level)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="guest">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>Guest User</span>
                              <span className="text-xs text-muted-foreground ml-2">(24-hour temporary access)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="corporate">
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4" />
                              <span>Corporate User</span>
                              <span className="text-xs text-muted-foreground ml-2">(Cross-BU governance)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {userType === 'guest' && 'Guest users have read-only access for 24 hours after first login.'}
                        {userType === 'corporate' && 'Corporate users have cross-BU access for governance roles.'}
                        {userType === 'regular' && 'Regular users need to be assigned to specific projects or BU roles.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Corporate Role Selection */}
                {userType === 'corporate' && (
                  <FormField
                    control={form.control}
                    name="corporate_role_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corporate Role *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a corporate role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Corporate Roles</SelectLabel>
                              {corporateRoles.length > 0 ? (
                                corporateRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no-roles" disabled>
                                  No corporate roles available
                                </SelectItem>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Corporate roles provide cross-BU access for governance, PMO, and executive functions.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Default Role Selection for Regular Users */}
                {userType === 'regular' && (
                  <FormField
                    control={form.control}
                    name="default_role_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Role (Suggestion)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role suggestion" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projectRoles.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Project Level Roles</SelectLabel>
                                {projectRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {buRoles.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>BU Level Roles</SelectLabel>
                                {buRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {projectRoles.length === 0 && buRoles.length === 0 && (
                              <SelectItem value="no-roles" disabled>
                                No roles available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          This is a suggestion for project assignment. The actual role in projects will be assigned separately.
                          {projectRoles.length > 0 && ` Available project roles: ${projectRoles.map(r => r.name).join(', ')}`}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Business Unit Affiliation - Only for Regular Users */}
                {userType === 'regular' && (
                  <div className="border-t pt-4 mt-2">
                    <FormField
                      control={form.control}
                      name="business_unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Unit *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a business unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {businessUnits.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the business unit this user belongs to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {/* Debug info */}
                <div className="text-xs text-muted-foreground border-t pt-2 mt-4">
                  <details>
                    <summary className="cursor-pointer">Debug Info</summary>
                    <div className="mt-1 space-y-1">
                      <div>Corporate roles count: {corporateRoles.length}</div>
                      <div>Project roles count: {projectRoles.length}</div>
                      <div>BU roles count: {buRoles.length}</div>
                      <div>Business units count: {businessUnits.length}</div>
                      {corporateRoles.length > 0 && (
                        <div>Corporate: {corporateRoles.map(r => r.name).join(', ')}</div>
                      )}
                      {projectRoles.length > 0 && (
                        <div>Project: {projectRoles.map(r => r.name).join(', ')}</div>
                      )}
                      {buRoles.length > 0 && (
                        <div>BU: {buRoles.map(r => r.name).join(', ')}</div>
                      )}
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Account Information */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Account Information</CardTitle>
                <CardDescription>
                  Set up the user's login credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="johndoe" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setUsernameValidationState({
                                  checking: false,
                                  available: null,
                                  message: ''
                                });
                              }}
                              className={
                                usernameValidationState.checking ? 'border-yellow-500 pr-10' :
                                usernameValidationState.available === true ? 'border-green-500 pr-10' :
                                usernameValidationState.available === false ? 'border-red-500 pr-10' :
                                'pr-10'
                              }
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {usernameValidationState.checking && (
                                <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                              )}
                              {!usernameValidationState.checking && usernameValidationState.available === true && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {!usernameValidationState.checking && usernameValidationState.available === false && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                        </FormControl>
                        
                        {usernameValidationState.checking && (
                          <div className="flex items-center text-yellow-600 text-sm mt-1">
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Checking username availability...
                          </div>
                        )}
                        
                        {!usernameValidationState.checking && usernameValidationState.message && (
                          <div className={`flex items-center text-sm mt-1 ${
                            usernameValidationState.available === true ? 'text-green-600' : 
                            usernameValidationState.available === false ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {usernameValidationState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                            {usernameValidationState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                            {usernameValidationState.message}
                          </div>
                        )}
                        
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="email"
                              placeholder="john.doe@company.com" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setEmailValidationState({
                                  checking: false,
                                  available: null,
                                  message: ''
                                });
                              }}
                              className={
                                emailValidationState.checking ? 'border-yellow-500 pr-10' :
                                emailValidationState.available === true ? 'border-green-500 pr-10' :
                                emailValidationState.available === false ? 'border-red-500 pr-10' :
                                'pr-10'
                              }
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              {emailValidationState.checking && (
                                <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                              )}
                              {!emailValidationState.checking && emailValidationState.available === true && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {!emailValidationState.checking && emailValidationState.available === false && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                        </FormControl>
                        
                        {emailValidationState.checking && (
                          <div className="flex items-center text-yellow-600 text-sm mt-1">
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Checking email availability...
                          </div>
                        )}
                        
                        {!emailValidationState.checking && emailValidationState.message && (
                          <div className={`flex items-center text-sm mt-1 ${
                            emailValidationState.available === true ? 'text-green-600' : 
                            emailValidationState.available === false ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {emailValidationState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                            {emailValidationState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                            {emailValidationState.message}
                          </div>
                        )}
                        
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password" 
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>Minimum 6 characters</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm password" 
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-4 pt-4">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            
            <div className="flex-1" />
            
            {currentStep < 3 ? (
              <Button 
                type="button" 
                onClick={handleNext} 
                disabled={!isStepValid() || isSubmitting}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting || !isStepValid()}
                className="min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            )}
            
            <Button type="button" variant="outline" onClick={handleCloseForm} disabled={isSubmitting}>
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

export default CreateUser;