// src/components/documents/CreateDocFlow.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAllDocTypes } from '@/hooks/useDocClassification';
import { DocType } from '@/types/docTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  FileText,
  Calendar,
  Shield,
  DollarSign,
  Wrench,
  Truck,
  HardHat,
  Mail,
  Users,
  AlertCircle,
  PenTool,
  FileCheck,
  ScrollText,
  Building2,
  Star,
  Repeat,
  X,
  Clock,
  FolderTree,
  Hash,
  Sparkles,
  Loader2
} from 'lucide-react';
import FormAdHoc from './FormAdHoc';
import FormPeriodic from './FormPeriodic';

interface CreateDocFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'search' | 'form';

const getDocTypeIcon = (entityType: string, className = "h-5 w-5") => {
  const iconMap: Record<string, React.ReactNode> = {
    'schedule_baseline': <Calendar className={`${className} text-blue-500`} />,
    'schedule_current': <Clock className={`${className} text-blue-500`} />,
    'contract': <FileText className={`${className} text-green-500`} />,
    'financial': <DollarSign className={`${className} text-yellow-500`} />,
    'procurement': <Truck className={`${className} text-orange-500`} />,
    'technical': <Wrench className={`${className} text-indigo-500`} />,
    'construction': <HardHat className={`${className} text-amber-500`} />,
    'hse': <Shield className={`${className} text-red-500`} />,
    'quality': <FileCheck className={`${className} text-cyan-500`} />,
    'correspondence': <Mail className={`${className} text-pink-500`} />,
    'hr': <Users className={`${className} text-teal-500`} />,
    'legal': <ScrollText className={`${className} text-gray-500`} />,
    'it': <Building2 className={`${className} text-violet-500`} />,
  };
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (entityType?.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return <FileText className={`${className} text-gray-400`} />;
};

const groupBySubcategory = (docTypes: DocType[]) => {
  return docTypes.reduce((groups, docType) => {
    const subcatLabel = docType.subcategory?.label || 'Other';
    if (!groups[subcatLabel]) {
      groups[subcatLabel] = [];
    }
    groups[subcatLabel].push(docType);
    return groups;
  }, {} as Record<string, DocType[]>);
};

const quickSearchSuggestions = [
  { label: '📊 Baseline', query: 'baseline' },
  { label: '📈 Progress', query: 'progress' },
  { label: '💰 Invoice', query: 'invoice' },
  { label: '📋 Report', query: 'report' },
  { label: '🔒 HSE', query: 'hse' },
  { label: '📝 Contract', query: 'contract' },
  { label: '📅 Schedule', query: 'schedule' },
  { label: '📐 Drawing', query: 'drawing' },
];

const CreateDocFlow: React.FC<CreateDocFlowProps> = ({ open, onOpenChange, onSuccess }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const [step, setStep] = useState<Step>('search');
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Utiliser le hook pour tous les types
  const { docTypes, loading, error } = useAllDocTypes();

  // Debug
  useEffect(() => {
    if (open) {
      console.log('🔍 CreateDocFlow opened');
      console.log('📦 Total docTypes:', docTypes.length);
      console.log('⚡ Loading:', loading);
      console.log('❌ Error:', error);
    }
  }, [open, docTypes, loading, error]);

  // Filtrer les types de documents
  const filteredDocTypes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = docTypes.filter(docType => {
      const searchableFields = [
        docType.label,
        docType.entity_type,
        docType.subcategory?.label,
        docType.subcategory?.category?.label,
        docType.native_format,
        docType.doc_number
      ].filter(Boolean).map(field => field.toLowerCase());
      
      return searchableFields.some(field => field.includes(query));
    });
    
    console.log(`🔍 Search "${query}" found ${filtered.length} results`);
    return filtered;
  }, [docTypes, searchQuery]);

  const groupedResults = useMemo(() => {
    return groupBySubcategory(filteredDocTypes);
  }, [filteredDocTypes]);

  const handleSelectDocType = (docType: DocType) => {
    console.log('✅ Selected doc type:', docType.label);
    setSelectedDocType(docType);
    setStep('form');
    
    // Sauvegarder la recherche récente
    if (searchQuery && !recentSearches.includes(searchQuery)) {
      setRecentSearches(prev => [searchQuery, ...prev].slice(0, 5));
    }
  };

  const handleBack = () => {
    setStep('search');
    setSelectedDocType(null);
  };

  const handleClose = () => {
    setStep('search');
    setSelectedDocType(null);
    setSearchQuery('');
    onOpenChange(false);
  };

  const handleSuccess = () => {
    handleClose();
    if (onSuccess) onSuccess();
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Rendu de la recherche
  const renderSearch = () => (
    <div className="space-y-6">
      {/* Barre de recherche principale */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="🔍 Type to search...  &quot;baseline&quot;, &quot;invoice&quot;, &quot;report&quot;"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Suggestions rapides */}
      {!searchQuery && !loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Sparkles className="h-4 w-4" />
            <span>Quick suggestions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickSearchSuggestions.map((suggestion) => (
              <Button
                key={suggestion.query}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSearch(suggestion.query)}
                className="bg-gray-50 hover:bg-gray-100"
              >
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* État de chargement */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Erreur */}
      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Résultats de recherche */}
      {!loading && !error && searchQuery && filteredDocTypes.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700">No results found</h3>
          <p className="text-sm text-gray-500 mt-1">
            Try different keywords
          </p>
        </div>
      )}

      {!loading && !error && searchQuery && filteredDocTypes.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="bg-primary/5">
              <Hash className="h-3 w-3 mr-1" />
              {filteredDocTypes.length} result{filteredDocTypes.length > 1 ? 's' : ''}
            </Badge>
          </div>

          <ScrollArea className="max-h-[500px] pr-4">
            {Object.entries(groupedResults).map(([subcategory, types]) => (
              <div key={subcategory} className="mb-6">
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white py-2">
                  <FolderTree className="h-4 w-4 text-gray-400" />
                  <h3 className="font-medium text-gray-700">{subcategory}</h3>
                  <Badge variant="outline" className="ml-auto">
                    {types.length}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {types.map((docType) => {
                    const highlightMatch = searchQuery;
                    
                    return (
                      <Card
                        key={docType.id}
                        className="cursor-pointer hover:shadow-md transition-all hover:border-primary group"
                        onClick={() => handleSelectDocType(docType)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-primary/5">
                              {getDocTypeIcon(docType.entity_type, "h-6 w-6")}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {highlightMatch ? (
                                    <>
                                      {docType.label.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                                          <mark key={i} className="bg-yellow-100 px-0.5 rounded">{part}</mark>
                                        ) : part
                                      )}
                                    </>
                                  ) : docType.label}
                                </span>
                                
                                {docType.only_one_per_project && (
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                    <Star className="h-3 w-3 mr-1" />
                                    Unique
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Badge variant="outline" className="bg-blue-50">
                                  {docType.entity_type}
                                </Badge>
                                {docType.is_periodic && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                    <Repeat className="h-3 w-3 mr-1" />
                                    Periodic
                                  </Badge>
                                )}
                                <span className="text-gray-400">•</span>
                                <span className="font-mono">{docType.native_format}</span>
                              </div>
                              
                              {docType.subcategory?.category && (
                                <p className="text-xs text-gray-400">
                                  Category: {docType.subcategory.category.label}
                                </p>
                              )}
                            </div>
                            
                            <Badge 
                              variant="outline" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Select →
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Message initial quand aucun texte de recherche */}
      {!loading && !error && !searchQuery && docTypes.length > 0 && (
        <div className="text-center py-16">
          <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl p-8 max-w-md mx-auto">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Search for any document type
            </h3>
            <p className="text-gray-500 mb-4">
              Type to instantly find the document you need
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
              <div className="p-2 border rounded-lg">📊 baseline</div>
              <div className="p-2 border rounded-lg">💰 invoice</div>
              <div className="p-2 border rounded-lg">📋 report</div>
              <div className="p-2 border rounded-lg">🔒 hse</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Rendu du formulaire
  const renderForm = () => {
    if (!selectedDocType) return null;
    
    return selectedDocType.is_periodic ? (
      <FormPeriodic
        projectId={projectId!}
        docType={selectedDocType}
        onSuccess={handleSuccess}
        onCancel={handleBack}
      />
    ) : (
      <FormAdHoc
        projectId={projectId!}
        docType={selectedDocType}
        onSuccess={handleSuccess}
        onCancel={handleBack}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step === 'form' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="px-2"
                >
                  ← Back to search
                </Button>
              )}
              <div>
                <DialogTitle className="text-xl">
                  {step === 'search' ? 'Create New Document' : selectedDocType?.label}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {step === 'search' 
                    ? 'Search and select the document type you want to create'
                    : 'Fill in the document details'
                  }
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 p-6 max-h-[calc(90vh-120px)]">
          {step === 'search' && renderSearch()}
          {step === 'form' && renderForm()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDocFlow;