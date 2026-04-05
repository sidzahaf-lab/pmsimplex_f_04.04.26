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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, AlertCircle, FolderTree, Edit, Trash2, X, Eye } from 'lucide-react';
import axios from 'axios';

// Types
interface DocCategory {
  id: string;
  label: string;
  description?: string;
  created_at: string;
}

interface DocSubcategory {
  id: string;
  category_id: string;
  label: string;
  description?: string;
  created_at: string;
}

interface DocType {
  id: string;
  subcategory_id: string;
  label: string;
  is_periodic: boolean;
  only_one_per_project: boolean;  // ADDED THIS FIELD
  entity_type: string;
  native_format: string;
  created_at: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

// Check category label availability
const checkCategoryLabelAvailability = async (label: string, excludeId?: string): Promise<{ available: boolean; message?: string }> => {
  if (!label || label.length < 1) return { available: true };
  
  try {
    const response = await axios.get(`${API_BASE_URL}/doc-categories`);
    const categories = response.data.data.categories || [];
    const exists = categories.some((cat: DocCategory) => 
      cat.label.toLowerCase() === label.toLowerCase().trim() && cat.id !== excludeId
    );
    
    return { 
      available: !exists,
      message: exists ? 'Category label already exists' : 'Category label is available'
    };
  } catch (error: any) {
    console.error('Error checking category label:', error);
    return { available: true, message: 'Error checking category label availability' };
  }
};

// Check subcategory label availability within a category
const checkSubcategoryLabelAvailability = async (categoryId: string, label: string, excludeId?: string): Promise<{ available: boolean; message?: string }> => {
  if (!label || label.length < 1 || !categoryId) return { available: true };
  
  try {
    const response = await axios.get(`${API_BASE_URL}/doc-subcategories/by-category/${categoryId}`);
    const subcategories = response.data.data.subcategories || [];
    const exists = subcategories.some((sub: DocSubcategory) => 
      sub.label.toLowerCase() === label.toLowerCase().trim() && sub.id !== excludeId
    );
    
    return { 
      available: !exists,
      message: exists ? 'Subcategory label already exists in this category' : 'Subcategory label is available'
    };
  } catch (error: any) {
    console.error('Error checking subcategory label:', error);
    return { available: true, message: 'Error checking subcategory label availability' };
  }
};

// Check document type label availability within a subcategory
const checkDocTypeLabelAvailability = async (subcategoryId: string, label: string, excludeId?: string): Promise<{ available: boolean; message?: string }> => {
  if (!label || label.length < 1 || !subcategoryId) return { available: true };
  
  try {
    const response = await axios.get(`${API_BASE_URL}/doc-types/by-subcategory/${subcategoryId}`);
    const docTypes = response.data.data.docTypes || [];
    const exists = docTypes.some((type: DocType) => 
      type.label.toLowerCase() === label.toLowerCase().trim() && type.id !== excludeId
    );
    
    return { 
      available: !exists,
      message: exists ? 'Document type label already exists in this subcategory' : 'Document type label is available'
    };
  } catch (error: any) {
    console.error('Error checking document type label:', error);
    return { available: true, message: 'Error checking document type label availability' };
  }
};

// Create schemas for each tab
const categorySchema = z.object({
  label: z.string()
    .min(1, 'Category label is required')
    .max(250, 'Category label must be less than 250 characters'),
  
  description: z.string()
    .max(65535, 'Description exceeds maximum length')
    .optional()
    .or(z.literal('')),
});

const subcategorySchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  label: z.string()
    .min(1, 'Subcategory label is required')
    .max(250, 'Subcategory label must be less than 250 characters'),
  
  description: z.string()
    .max(65535, 'Description exceeds maximum length')
    .optional()
    .or(z.literal('')),
});

// UPDATED: Added only_one_per_project to schema
const docTypeSchema = z.object({
  subcategory_id: z.string().min(1, 'Subcategory is required'),
  label: z.string()
    .min(1, 'Document type label is required')
    .max(250, 'Document type label must be less than 250 characters'),
  
  is_periodic: z.boolean().default(false),
  
  only_one_per_project: z.boolean().default(false),  // ADDED THIS FIELD
  
  entity_type: z.string()
    .min(1, 'Entity type is required')
    .max(100, 'Entity type must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Entity type can only contain letters, numbers, spaces, hyphens and underscores'),
  
  native_format: z.string()
    .min(1, 'Native format is required')
    .refine(val => {
      const formats = val.split(',');
      return formats.every(f => f.trim().startsWith('.') && f.trim().length > 1);
    }, 'Each format must start with a dot (e.g., .pdf, .xlsx)')
    .refine(val => {
      const formats = val.split(',');
      return formats.every(f => /^\.[a-zA-Z0-9]+$/.test(f.trim()));
    }, 'Use only letters and numbers after the dot (e.g., .pdf, .docx)'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;
type SubcategoryFormValues = z.infer<typeof subcategorySchema>;
type DocTypeFormValues = z.infer<typeof docTypeSchema>;

interface CreateDocClassificationProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialTab?: 'categories' | 'subcategories' | 'doc-types';
}

// Edit Category Dialog Component
interface EditCategoryDialogProps {
  category: DocCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const EditCategoryDialog = ({ category, open, onOpenChange, onUpdate }: EditCategoryDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelState, setLabelState] = useState<{ checking: boolean; available: boolean | null; message: string }>({
    checking: false,
    available: null,
    message: ''
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      label: category.label,
      description: category.description || '',
    },
    mode: 'onBlur',
  });

  const debouncedLabelCheck = useCallback(
    debounce(async (label: string) => {
      if (!label || label.length < 1) {
        setLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setLabelState({
        checking: true,
        available: null,
        message: 'Checking label availability...'
      });

      try {
        const result = await checkCategoryLabelAvailability(label, category.id);
        setLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Label is available' : 'Label already exists')
        });
        form.trigger('label');
      } catch (error) {
        setLabelState({
          checking: false,
          available: null,
          message: 'Error checking label availability'
        });
      }
    }, 800),
    [form, category.id]
  );

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'label' && type === 'change') {
        const label = value.label;
        setLabelState({ checking: false, available: null, message: '' });
        if (label && label.length >= 1) {
          debouncedLabelCheck(label);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedLabelCheck]);

  const onSubmit = async (data: CategoryFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const labelCheck = await checkCategoryLabelAvailability(data.label, category.id);
      if (!labelCheck.available) {
        setError('Category label already exists. Please choose a different label.');
        setIsSubmitting(false);
        return;
      }

      await axios.put(`${API_BASE_URL}/doc-categories/${category.id}`, {
        label: data.label.trim(),
        description: data.description || null,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Label *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Engineering" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setLabelState({ checking: false, available: null, message: '' });
                        }}
                        className={
                          labelState.checking ? 'border-yellow-500 pr-10' :
                          form.formState.errors.label ? 'border-red-500 pr-10' :
                          labelState.available === true ? 'border-green-500 pr-10' :
                          labelState.available === false ? 'border-red-500 pr-10' :
                          'pr-10'
                        }
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {labelState.checking && (
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        )}
                        {!labelState.checking && labelState.available === true && !form.formState.errors.label && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {!labelState.checking && (labelState.available === false || form.formState.errors.label) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </FormControl>
                  {labelState.message && (
                    <div className={`text-sm mt-1 ${
                      labelState.available === true ? 'text-green-600' : 
                      labelState.available === false ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {labelState.message}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description of the category"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Edit Subcategory Dialog Component
interface EditSubcategoryDialogProps {
  subcategory: DocSubcategory;
  categories: DocCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const EditSubcategoryDialog = ({ subcategory, categories, open, onOpenChange, onUpdate }: EditSubcategoryDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelState, setLabelState] = useState<{ checking: boolean; available: boolean | null; message: string }>({
    checking: false,
    available: null,
    message: ''
  });

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      category_id: subcategory.category_id,
      label: subcategory.label,
      description: subcategory.description || '',
    },
    mode: 'onBlur',
  });

  const debouncedLabelCheck = useCallback(
    debounce(async (label: string) => {
      const categoryId = form.getValues('category_id');
      if (!label || label.length < 1 || !categoryId) {
        setLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setLabelState({
        checking: true,
        available: null,
        message: 'Checking label availability...'
      });

      try {
        const result = await checkSubcategoryLabelAvailability(categoryId, label, subcategory.id);
        setLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Label is available' : 'Label already exists')
        });
        form.trigger('label');
      } catch (error) {
        setLabelState({
          checking: false,
          available: null,
          message: 'Error checking label availability'
        });
      }
    }, 800),
    [form, subcategory.id]
  );

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if ((name === 'label' || name === 'category_id') && type === 'change') {
        const label = value.label;
        setLabelState({ checking: false, available: null, message: '' });
        if (label && label.length >= 1) {
          debouncedLabelCheck(label);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedLabelCheck]);

  const onSubmit = async (data: SubcategoryFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const labelCheck = await checkSubcategoryLabelAvailability(data.category_id, data.label, subcategory.id);
      if (!labelCheck.available) {
        setError('Subcategory label already exists in this category. Please choose a different label.');
        setIsSubmitting(false);
        return;
      }

      await axios.put(`${API_BASE_URL}/doc-subcategories/${subcategory.id}`, {
        category_id: data.category_id,
        label: data.label.trim(),
        description: data.description || null,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update subcategory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Subcategory</DialogTitle>
          <DialogDescription>
            Update the subcategory details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory Label *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Drawing" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setLabelState({ checking: false, available: null, message: '' });
                        }}
                        className={
                          labelState.checking ? 'border-yellow-500 pr-10' :
                          form.formState.errors.label ? 'border-red-500 pr-10' :
                          labelState.available === true ? 'border-green-500 pr-10' :
                          labelState.available === false ? 'border-red-500 pr-10' :
                          'pr-10'
                        }
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {labelState.checking && (
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        )}
                        {!labelState.checking && labelState.available === true && !form.formState.errors.label && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {!labelState.checking && (labelState.available === false || form.formState.errors.label) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </FormControl>
                  {labelState.message && (
                    <div className={`text-sm mt-1 ${
                      labelState.available === true ? 'text-green-600' : 
                      labelState.available === false ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {labelState.message}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Description of the subcategory"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Edit Document Type Dialog Component
interface EditDocTypeDialogProps {
  docType: DocType;
  subcategories: DocSubcategory[];
  categories: DocCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const EditDocTypeDialog = ({ docType, subcategories, categories, open, onOpenChange, onUpdate }: EditDocTypeDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelState, setLabelState] = useState<{ checking: boolean; available: boolean | null; message: string }>({
    checking: false,
    available: null,
    message: ''
  });

  const form = useForm<DocTypeFormValues>({
    resolver: zodResolver(docTypeSchema),
    defaultValues: {
      subcategory_id: docType.subcategory_id,
      label: docType.label,
      is_periodic: docType.is_periodic,
      only_one_per_project: docType.only_one_per_project,  // ADDED THIS FIELD
      entity_type: docType.entity_type,
      native_format: docType.native_format,
    },
    mode: 'onBlur',
  });

  const debouncedLabelCheck = useCallback(
    debounce(async (label: string) => {
      const subcategoryId = form.getValues('subcategory_id');
      if (!label || label.length < 1 || !subcategoryId) {
        setLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setLabelState({
        checking: true,
        available: null,
        message: 'Checking label availability...'
      });

      try {
        const result = await checkDocTypeLabelAvailability(subcategoryId, label, docType.id);
        setLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Label is available' : 'Label already exists')
        });
        form.trigger('label');
      } catch (error) {
        setLabelState({
          checking: false,
          available: null,
          message: 'Error checking label availability'
        });
      }
    }, 800),
    [form, docType.id]
  );

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if ((name === 'label' || name === 'subcategory_id') && type === 'change') {
        const label = value.label;
        setLabelState({ checking: false, available: null, message: '' });
        if (label && label.length >= 1) {
          debouncedLabelCheck(label);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, debouncedLabelCheck]);

  const onSubmit = async (data: DocTypeFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const labelCheck = await checkDocTypeLabelAvailability(data.subcategory_id, data.label, docType.id);
      if (!labelCheck.available) {
        setError('Document type label already exists in this subcategory. Please choose a different label.');
        setIsSubmitting(false);
        return;
      }

      await axios.put(`${API_BASE_URL}/doc-types/${docType.id}`, {
        subcategory_id: data.subcategory_id,
        label: data.label.trim(),
        is_periodic: data.is_periodic,
        only_one_per_project: data.only_one_per_project,  // ADDED THIS FIELD
        entity_type: data.entity_type,
        native_format: data.native_format,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update document type');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Document Type</DialogTitle>
          <DialogDescription>
            Update the document type details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subcategory_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a subcategory" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subcategories.map((sub) => {
                        const category = categories.find(c => c.id === sub.category_id);
                        return (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.label} ({category?.label})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type Label *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Drawing - Mechanical" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setLabelState({ checking: false, available: null, message: '' });
                        }}
                        className={
                          labelState.checking ? 'border-yellow-500 pr-10' :
                          form.formState.errors.label ? 'border-red-500 pr-10' :
                          labelState.available === true ? 'border-green-500 pr-10' :
                          labelState.available === false ? 'border-red-500 pr-10' :
                          'pr-10'
                        }
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {labelState.checking && (
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                        )}
                        {!labelState.checking && labelState.available === true && !form.formState.errors.label && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {!labelState.checking && (labelState.available === false || form.formState.errors.label) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </FormControl>
                  {labelState.message && (
                    <div className={`text-sm mt-1 ${
                      labelState.available === true ? 'text-green-600' : 
                      labelState.available === false ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {labelState.message}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_periodic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Periodic Document</FormLabel>
                    <FormDescription>
                      Check if documents are periodic (e.g., weekly reports)
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {/* ADDED: Only One Per Project checkbox */}
            <FormField
              control={form.control}
              name="only_one_per_project"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Only One Per Project</FormLabel>
                    <FormDescription>
                      Check if only one document of this type is allowed per project
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="schedule, report, drawing, etc." 
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Type of entity for programmatic handling
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="native_format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Native Format *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder=".dwg,.pdf" 
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of allowed file extensions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export function CreateDocClassification({ 
  onClose, 
  onSuccess, 
  initialTab = 'categories' 
}: CreateDocClassificationProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  
  // Edit dialog states
  const [editingCategory, setEditingCategory] = useState<DocCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<DocSubcategory | null>(null);
  const [editingDocType, setEditingDocType] = useState<DocType | null>(null);
  
  // Data states
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [subcategories, setSubcategories] = useState<DocSubcategory[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Validation states
  const [categoryLabelState, setCategoryLabelState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [subcategoryLabelState, setSubcategoryLabelState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [docTypeLabelState, setDocTypeLabelState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  // Forms
  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      label: '',
      description: '',
    },
    mode: 'onBlur',
  });

  const subcategoryForm = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      category_id: '',
      label: '',
      description: '',
    },
    mode: 'onBlur',
  });

  const docTypeForm = useForm<DocTypeFormValues>({
    resolver: zodResolver(docTypeSchema),
    defaultValues: {
      subcategory_id: '',
      label: '',
      is_periodic: false,
      only_one_per_project: false,  // ADDED THIS FIELD
      entity_type: '',
      native_format: '',
    },
    mode: 'onBlur',
  });

  // Real-time validation with debounce for category label
  const debouncedCategoryLabelCheck = useCallback(
    debounce(async (label: string) => {
      if (!label || label.length < 1) {
        setCategoryLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setCategoryLabelState({
        checking: true,
        available: null,
        message: 'Checking category label availability...'
      });

      try {
        const result = await checkCategoryLabelAvailability(label);
        setCategoryLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Category label is available' : 'Category label already exists')
        });

        categoryForm.trigger('label');
      } catch (error) {
        setCategoryLabelState({
          checking: false,
          available: null,
          message: 'Error checking category label availability'
        });
      }
    }, 800),
    [categoryForm]
  );

  // Real-time validation with debounce for subcategory label
  const debouncedSubcategoryLabelCheck = useCallback(
    debounce(async ({ categoryId, label }: { categoryId: string; label: string }) => {
      if (!label || label.length < 1 || !categoryId) {
        setSubcategoryLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setSubcategoryLabelState({
        checking: true,
        available: null,
        message: 'Checking subcategory label availability...'
      });

      try {
        const result = await checkSubcategoryLabelAvailability(categoryId, label);
        setSubcategoryLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Subcategory label is available' : 'Subcategory label already exists')
        });

        subcategoryForm.trigger('label');
      } catch (error) {
        setSubcategoryLabelState({
          checking: false,
          available: null,
          message: 'Error checking subcategory label availability'
        });
      }
    }, 800),
    [subcategoryForm]
  );

  // Real-time validation with debounce for document type label
  const debouncedDocTypeLabelCheck = useCallback(
    debounce(async ({ subcategoryId, label }: { subcategoryId: string; label: string }) => {
      if (!label || label.length < 1 || !subcategoryId) {
        setDocTypeLabelState({ checking: false, available: null, message: '' });
        return;
      }

      setDocTypeLabelState({
        checking: true,
        available: null,
        message: 'Checking document type label availability...'
      });

      try {
        const result = await checkDocTypeLabelAvailability(subcategoryId, label);
        setDocTypeLabelState({
          checking: false,
          available: result.available,
          message: result.message || (result.available ? 'Document type label is available' : 'Document type label already exists')
        });

        docTypeForm.trigger('label');
      } catch (error) {
        setDocTypeLabelState({
          checking: false,
          available: null,
          message: 'Error checking document type label availability'
        });
      }
    }, 800),
    [docTypeForm]
  );

  // Watch for changes in forms
  useEffect(() => {
    const subscription = categoryForm.watch((value, { name, type }) => {
      if (name === 'label' && type === 'change') {
        const label = value.label;
        
        setCategoryLabelState({ checking: false, available: null, message: '' });

        if (label && label.length >= 1) {
          debouncedCategoryLabelCheck(label);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [categoryForm.watch, debouncedCategoryLabelCheck]);

  useEffect(() => {
    const subscription = subcategoryForm.watch((value, { name, type }) => {
      if ((name === 'label' || name === 'category_id') && type === 'change') {
        const label = value.label;
        const categoryId = value.category_id;
        
        setSubcategoryLabelState({ checking: false, available: null, message: '' });

        if (label && label.length >= 1 && categoryId) {
          debouncedSubcategoryLabelCheck({ categoryId, label });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [subcategoryForm.watch, debouncedSubcategoryLabelCheck]);

  useEffect(() => {
    const subscription = docTypeForm.watch((value, { name, type }) => {
      if ((name === 'label' || name === 'subcategory_id') && type === 'change') {
        const label = value.label;
        const subcategoryId = value.subcategory_id;
        
        setDocTypeLabelState({ checking: false, available: null, message: '' });

        if (label && label.length >= 1 && subcategoryId) {
          debouncedDocTypeLabelCheck({ subcategoryId, label });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [docTypeForm.watch, debouncedDocTypeLabelCheck]);

  // Fetch data on component mount
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories
      const categoriesResponse = await axios.get(`${API_BASE_URL}/doc-categories`);
      setCategories(categoriesResponse.data.data.categories || []);
      
      // Fetch subcategories
      const subcategoriesResponse = await axios.get(`${API_BASE_URL}/doc-subcategories`);
      setSubcategories(subcategoriesResponse.data.data.subcategories || []);
      
      // Fetch document types
      const docTypesResponse = await axios.get(`${API_BASE_URL}/doc-types`);
      setDocTypes(docTypesResponse.data.data.docTypes || []);
      
      // Set default selections if available
      if (categories.length > 0) {
        subcategoryForm.setValue('category_id', categories[0].id);
      }
      
      if (subcategories.length > 0) {
        docTypeForm.setValue('subcategory_id', subcategories[0].id);
      }
      
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setSubmitResult({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch classification structure for drawer
  const fetchClassificationStructure = async () => {
    setLoadingStructure(true);
    try {
      const [categoriesRes, subcategoriesRes, docTypesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/doc-categories`),
        axios.get(`${API_BASE_URL}/doc-subcategories`),
        axios.get(`${API_BASE_URL}/doc-types`)
      ]);
      
      setCategories(categoriesRes.data.data.categories || []);
      setSubcategories(subcategoriesRes.data.data.subcategories || []);
      setDocTypes(docTypesRes.data.data.docTypes || []);
    } catch (error) {
      console.error('Error fetching classification structure:', error);
    } finally {
      setLoadingStructure(false);
    }
  };

  // Handle drawer open
  const handleOpenDrawer = () => {
    setDrawerOpen(true);
    fetchClassificationStructure();
  };

  // Handle category creation
  const handleCreateCategory = async (data: CategoryFormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final check before submitting
      const labelCheck = await checkCategoryLabelAvailability(data.label);
      
      if (!labelCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Category label already exists. Please choose a different label.',
        });
        setIsSubmitting(false);
        return;
      }

      // Map data to match backend expectations
      const categoryData = {
        label: data.label.trim(),
        description: data.description || null,
      };

      console.log('🚀 Creating category with data:', categoryData);
      await axios.post(`${API_BASE_URL}/doc-categories`, categoryData);
      
      setSubmitResult({
        type: 'success',
        message: 'Category created successfully!',
      });
      
      // Refresh data
      await fetchData();
      
      // Clear form
      categoryForm.reset({
        label: '',
        description: '',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('Error creating category:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to create category. Please try again.';
      
      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle subcategory creation
  const handleCreateSubcategory = async (data: SubcategoryFormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final check before submitting
      const labelCheck = await checkSubcategoryLabelAvailability(data.category_id, data.label);
      
      if (!labelCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Subcategory label already exists in this category. Please choose a different label.',
        });
        setIsSubmitting(false);
        return;
      }

      // Map data to match backend expectations
      const subcategoryData = {
        category_id: data.category_id,
        label: data.label.trim(),
        description: data.description || null,
      };

      console.log('🚀 Creating subcategory with data:', subcategoryData);
      await axios.post(`${API_BASE_URL}/doc-subcategories`, subcategoryData);
      
      setSubmitResult({
        type: 'success',
        message: 'Subcategory created successfully!',
      });
      
      // Refresh data
      await fetchData();
      
      // Clear form but keep selected category
      subcategoryForm.reset({
        category_id: data.category_id,
        label: '',
        description: '',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('Error creating subcategory:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to create subcategory. Please try again.';
      
      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle document type creation - UPDATED to include only_one_per_project
  const handleCreateDocType = async (data: DocTypeFormValues) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Final check before submitting
      const labelCheck = await checkDocTypeLabelAvailability(data.subcategory_id, data.label);
      
      if (!labelCheck.available) {
        setSubmitResult({
          type: 'error',
          message: 'Document type label already exists in this subcategory. Please choose a different label.',
        });
        setIsSubmitting(false);
        return;
      }

      // Map data to match backend expectations - INCLUDING only_one_per_project
      const docTypeData = {
        subcategory_id: data.subcategory_id,
        label: data.label.trim(),
        is_periodic: data.is_periodic,
        only_one_per_project: data.only_one_per_project,  // ADDED THIS FIELD
        entity_type: data.entity_type,
        native_format: data.native_format,
      };

      console.log('🚀 Creating document type with data:', docTypeData);
      await axios.post(`${API_BASE_URL}/doc-types`, docTypeData);
      
      setSubmitResult({
        type: 'success',
        message: 'Document type created successfully!',
      });
      
      // Refresh data
      await fetchData();
      
      // Clear form but keep selected subcategory
      docTypeForm.reset({
        subcategory_id: data.subcategory_id,
        label: '',
        is_periodic: false,
        only_one_per_project: false,  // ADDED THIS FIELD
        entity_type: '',
        native_format: '',
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('Error creating document type:', error);
      
      let errorMessage = error.response?.data?.message || 'Failed to create document type. Please try again.';
      
      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle close form with navigation
  const handleCloseForm = () => {
    if (onClose) {
      onClose();
    } else {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/doc-classification');
      }
    }
  };

  // Handle clear form for active tab
  const handleClearForm = () => {
    switch (activeTab) {
      case 'categories':
        categoryForm.reset({
          label: '',
          description: '',
        });
        setCategoryLabelState({ checking: false, available: null, message: '' });
        break;
      case 'subcategories':
        subcategoryForm.reset({
          category_id: categories.length > 0 ? categories[0].id : '',
          label: '',
          description: '',
        });
        setSubcategoryLabelState({ checking: false, available: null, message: '' });
        break;
      case 'doc-types':
        docTypeForm.reset({
          subcategory_id: subcategories.length > 0 ? subcategories[0].id : '',
          label: '',
          is_periodic: false,
          only_one_per_project: false,  // ADDED THIS FIELD
          entity_type: '',
          native_format: '',
        });
        setDocTypeLabelState({ checking: false, available: null, message: '' });
        break;
    }
    setSubmitResult(null);
  };

  // Handle delete functions
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all subcategories and document types under it.')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/doc-categories/${id}`);
      await fetchData();
      setSubmitResult({
        type: 'success',
        message: 'Category deleted successfully!',
      });
    } catch (error: any) {
      setSubmitResult({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete category',
      });
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subcategory? This will also delete all document types under it.')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/doc-subcategories/${id}`);
      await fetchData();
      setSubmitResult({
        type: 'success',
        message: 'Subcategory deleted successfully!',
      });
    } catch (error: any) {
      setSubmitResult({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete subcategory',
      });
    }
  };

  const handleDeleteDocType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document type?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/doc-types/${id}`);
      await fetchData();
      setSubmitResult({
        type: 'success',
        message: 'Document type deleted successfully!',
      });
    } catch (error: any) {
      setSubmitResult({
        type: 'error',
        message: error.response?.data?.message || 'Failed to delete document type',
      });
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

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-between items-center">
            <div className="flex-1" />
            <div>
              <CardTitle className="text-2xl">Document Classification</CardTitle>
              <CardDescription>
                Create and manage document categories, subcategories, and types
              </CardDescription>
            </div>
            <div className="flex-1 flex justify-end">
              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button 
        variant="default" 
        onClick={handleOpenDrawer}
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
      >
        <Eye className="h-4 w-4 mr-2" />
        View Classification
      </Button>
                </DrawerTrigger>
                <DrawerContent className="h-[85vh]">
                  <DrawerHeader>
                    <DrawerTitle>Document Classification Structure</DrawerTitle>
                    <DrawerDescription>
                      Complete hierarchy of document classifications with edit options
                    </DrawerDescription>
                  </DrawerHeader>
                  
                  <div className="px-4 py-2 overflow-y-auto flex-1">
                    {loadingStructure ? (
                      <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
                        <span className="ml-2">Loading structure...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center">
                            <FolderTree className="h-4 w-4 mr-1" />
                            <span>Categories: {categories.length}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span>Subcategories: {subcategories.length}</span>
                            <span>Document Types: {docTypes.length}</span>
                          </div>
                        </div>
                        
                        {/* Flat View with Edit Buttons */}
                        <div className="space-y-4">
                          {categories.map((category) => (
                            <Card key={category.id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <FolderTree className="h-5 w-5 mr-2 text-blue-600" />
                                    <CardTitle className="text-lg">{category.label}</CardTitle>
                                    {category.description && (
                                      <span className="text-sm text-gray-500 ml-2">
                                        - {category.description}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingCategory(category)}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleDeleteCategory(category.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2">
                                {subcategories
                                  .filter(sub => sub.category_id === category.id)
                                  .map((sub) => (
                                    <div key={sub.id} className="ml-6 mt-3 border-l-2 border-gray-200 pl-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                          <span className="font-medium">{sub.label}</span>
                                          {sub.description && (
                                            <span className="text-sm text-gray-500 ml-2">
                                              - {sub.description}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingSubcategory(sub)}
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDeleteSubcategory(sub.id)}
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Delete
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="ml-4 mt-2 space-y-2">
                                        {docTypes
                                          .filter(type => type.subcategory_id === sub.id)
                                          .map((type) => (
                                            <div key={type.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                              <div className="flex items-center flex-wrap gap-2">
                                                <span className="text-gray-400 mr-1">•</span>
                                                <span className="font-medium">{type.label}</span>
                                                {type.is_periodic && (
                                                  <Badge variant="secondary" className="text-xs">
                                                    Periodic
                                                  </Badge>
                                                )}
                                                {/* ADDED: Display only_one_per_project badge */}
                                                {type.only_one_per_project && (
                                                  <Badge variant="secondary" className="text-xs bg-purple-50">
                                                    Unique per project
                                                  </Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs bg-blue-50">
                                                  {type.entity_type}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs bg-green-50">
                                                  {type.native_format}
                                                </Badge>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2"
                                                  onClick={() => setEditingDocType(type)}
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                  onClick={() => handleDeleteDocType(type.id)}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        {docTypes.filter(type => type.subcategory_id === sub.id).length === 0 && (
                                          <div className="text-sm text-gray-400 italic ml-4">
                                            No document types defined
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                {subcategories.filter(sub => sub.category_id === category.id).length === 0 && (
                                  <div className="text-sm text-gray-400 italic ml-6">
                                    No subcategories defined
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button variant="outline">Close</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="subcategories">Subcategories</TabsTrigger>
              <TabsTrigger value="doc-types">Document Types</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories">
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit(handleCreateCategory)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Create Category</CardTitle>
                      <CardDescription>
                        First level document classification (e.g., Planning, Engineering, Procurement)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Category Label */}
                      <FormField
                        control={categoryForm.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category Label *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder="Engineering" 
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setCategoryLabelState({ checking: false, available: null, message: '' });
                                  }}
                                  className={
                                    categoryLabelState.checking ? 'border-yellow-500 pr-10' :
                                    categoryForm.formState.errors.label ? 'border-red-500 pr-10' :
                                    categoryLabelState.available === true ? 'border-green-500 pr-10' :
                                    categoryLabelState.available === false ? 'border-red-500 pr-10' :
                                    'pr-10'
                                  }
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  {categoryLabelState.checking && (
                                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                  )}
                                  {!categoryLabelState.checking && categoryLabelState.available === true && !categoryForm.formState.errors.label && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                  {!categoryLabelState.checking && (categoryLabelState.available === false || categoryForm.formState.errors.label) && (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </div>
                            </FormControl>
                            
                            {categoryLabelState.checking && (
                              <div className="flex items-center text-yellow-600 text-sm mt-1">
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                Checking category label availability...
                              </div>
                            )}
                            
                            {!categoryLabelState.checking && categoryLabelState.message && (
                              <div className={`flex items-center text-sm mt-1 ${
                                categoryLabelState.available === true ? 'text-green-600' : 
                                categoryLabelState.available === false ? 'text-red-600' : 
                                'text-gray-600'
                              }`}>
                                {categoryLabelState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                {categoryLabelState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                                {categoryLabelState.message}
                              </div>
                            )}
                            
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category Description */}
                      <FormField
                        control={categoryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Description of the document category"
                                className="resize-none"
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Optional description of the category's purpose
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !categoryForm.formState.isValid || categoryLabelState.available === false}
                      className="min-w-[200px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Category'
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClearForm}
                      disabled={isSubmitting}
                    >
                      Clear Form
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Subcategories Tab */}
            <TabsContent value="subcategories">
              <Form {...subcategoryForm}>
                <form onSubmit={subcategoryForm.handleSubmit(handleCreateSubcategory)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Create Subcategory</CardTitle>
                      <CardDescription>
                        Second level document classification, attached to a category
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Category Selection */}
                      <FormField
                        control={subcategoryForm.control}
                        name="category_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{category.label}</span>
                                      {category.description && (
                                        <span className="text-xs text-gray-500">
                                          {category.description.substring(0, 50)}
                                          {category.description.length > 50 ? '...' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select the parent category for this subcategory
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Subcategory Label */}
                      <FormField
                        control={subcategoryForm.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subcategory Label *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder="Drawing" 
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setSubcategoryLabelState({ checking: false, available: null, message: '' });
                                  }}
                                  className={
                                    subcategoryLabelState.checking ? 'border-yellow-500 pr-10' :
                                    subcategoryForm.formState.errors.label ? 'border-red-500 pr-10' :
                                    subcategoryLabelState.available === true ? 'border-green-500 pr-10' :
                                    subcategoryLabelState.available === false ? 'border-red-500 pr-10' :
                                    'pr-10'
                                  }
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  {subcategoryLabelState.checking && (
                                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                  )}
                                  {!subcategoryLabelState.checking && subcategoryLabelState.available === true && !subcategoryForm.formState.errors.label && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                  {!subcategoryLabelState.checking && (subcategoryLabelState.available === false || subcategoryForm.formState.errors.label) && (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </div>
                            </FormControl>
                            
                            {subcategoryLabelState.checking && (
                              <div className="flex items-center text-yellow-600 text-sm mt-1">
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                Checking subcategory label availability...
                              </div>
                            )}
                            
                            {!subcategoryLabelState.checking && subcategoryLabelState.message && (
                              <div className={`flex items-center text-sm mt-1 ${
                                subcategoryLabelState.available === true ? 'text-green-600' : 
                                subcategoryLabelState.available === false ? 'text-red-600' : 
                                'text-gray-600'
                              }`}>
                                {subcategoryLabelState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                {subcategoryLabelState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                                {subcategoryLabelState.message}
                              </div>
                            )}
                            
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Subcategory Description */}
                      <FormField
                        control={subcategoryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Description of the document subcategory"
                                className="resize-none"
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Optional description of the subcategory's purpose
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !subcategoryForm.formState.isValid || subcategoryLabelState.available === false}
                      className="min-w-[200px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Subcategory'
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClearForm}
                      disabled={isSubmitting}
                    >
                      Clear Form
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Document Types Tab - UPDATED with only_one_per_project checkbox */}
            <TabsContent value="doc-types">
              <Form {...docTypeForm}>
                <form onSubmit={docTypeForm.handleSubmit(handleCreateDocType)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Create Document Type</CardTitle>
                      <CardDescription>
                        Third level classification - specific document types with format rules
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Subcategory Selection */}
                      <FormField
                        control={docTypeForm.control}
                        name="subcategory_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subcategory *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a subcategory" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {subcategories.map((sub) => {
                                  const category = categories.find(c => c.id === sub.category_id);
                                  return (
                                    <SelectItem key={sub.id} value={sub.id}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{sub.label}</span>
                                        <span className="text-xs text-gray-500">
                                          {category?.label} • {sub.description?.substring(0, 30)}
                                          {sub.description && sub.description.length > 30 ? '...' : ''}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select the parent subcategory for this document type
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Document Type Label */}
                      <FormField
                        control={docTypeForm.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type Label *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder="Drawing - Mechanical" 
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setDocTypeLabelState({ checking: false, available: null, message: '' });
                                  }}
                                  className={
                                    docTypeLabelState.checking ? 'border-yellow-500 pr-10' :
                                    docTypeForm.formState.errors.label ? 'border-red-500 pr-10' :
                                    docTypeLabelState.available === true ? 'border-green-500 pr-10' :
                                    docTypeLabelState.available === false ? 'border-red-500 pr-10' :
                                    'pr-10'
                                  }
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  {docTypeLabelState.checking && (
                                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                  )}
                                  {!docTypeLabelState.checking && docTypeLabelState.available === true && !docTypeForm.formState.errors.label && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                  {!docTypeLabelState.checking && (docTypeLabelState.available === false || docTypeForm.formState.errors.label) && (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </div>
                            </FormControl>
                            
                            {docTypeLabelState.checking && (
                              <div className="flex items-center text-yellow-600 text-sm mt-1">
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                Checking document type label availability...
                              </div>
                            )}
                            
                            {!docTypeLabelState.checking && docTypeLabelState.message && (
                              <div className={`flex items-center text-sm mt-1 ${
                                docTypeLabelState.available === true ? 'text-green-600' : 
                                docTypeLabelState.available === false ? 'text-red-600' : 
                                'text-gray-600'
                              }`}>
                                {docTypeLabelState.available === true && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                {docTypeLabelState.available === false && <AlertCircle className="h-3 w-3 mr-2" />}
                                {docTypeLabelState.message}
                              </div>
                            )}
                            
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Is Periodic Checkbox */}
                      <FormField
                        control={docTypeForm.control}
                        name="is_periodic"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Periodic Document</FormLabel>
                              <FormDescription>
                                Check if documents of this type are periodic (e.g., weekly reports) rather than ad-hoc
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* ADDED: Only One Per Project Checkbox */}
                      <FormField
                        control={docTypeForm.control}
                        name="only_one_per_project"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Only One Per Project</FormLabel>
                              <FormDescription>
                                Check if only one document of this type is allowed per project
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Entity Type */}
                      <FormField
                        control={docTypeForm.control}
                        name="entity_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entity Type *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="schedule, report, drawing, specification, calculation, other" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              The type of entity for programmatic handling (e.g., schedule, report, drawing)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Native Format */}
                      <FormField
                        control={docTypeForm.control}
                        name="native_format"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Native Format *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder=".dwg,.pdf" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Comma-separated list of allowed file extensions (e.g., .xer,.xml,.pdf)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !docTypeForm.formState.isValid || docTypeLabelState.available === false}
                      className="min-w-[200px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create Document Type'
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClearForm}
                      disabled={isSubmitting}
                    >
                      Clear Form
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

          {/* Global Action Buttons */}
          <div className="flex gap-4 pt-4 justify-end">
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
            <Alert className={`mt-4 ${
              submitResult.type === 'success' 
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
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

      {/* Edit Dialogs */}
      {editingCategory && (
        <EditCategoryDialog
          category={editingCategory}
          open={!!editingCategory}
          onOpenChange={(open) => !open && setEditingCategory(null)}
          onUpdate={() => {
            fetchData();
            setEditingCategory(null);
          }}
        />
      )}

      {editingSubcategory && (
        <EditSubcategoryDialog
          subcategory={editingSubcategory}
          categories={categories}
          open={!!editingSubcategory}
          onOpenChange={(open) => !open && setEditingSubcategory(null)}
          onUpdate={() => {
            fetchData();
            setEditingSubcategory(null);
          }}
        />
      )}

      {editingDocType && (
        <EditDocTypeDialog
          docType={editingDocType}
          subcategories={subcategories}
          categories={categories}
          open={!!editingDocType}
          onOpenChange={(open) => !open && setEditingDocType(null)}
          onUpdate={() => {
            fetchData();
            setEditingDocType(null);
          }}
        />
      )}
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

export default CreateDocClassification;