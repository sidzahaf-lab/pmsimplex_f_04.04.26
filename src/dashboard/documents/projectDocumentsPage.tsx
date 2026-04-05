// src/dashboard/ProjectDocumentsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  FileText, 
  Download, 
  Eye, 
  Clock,
  AlertCircle,
  MoreHorizontal,
  RefreshCw,
  FileUp,
  History,
  Loader2,
  Calendar
} from 'lucide-react';
import CreateDocFlow from '@/components/documents/createDocFlow';
import { PeriodsListDrawer } from '@/components/documents/PeriodsListDrawer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import axios from 'axios';
import { format, isAfter, parseISO } from 'date-fns';
import { saveAs } from 'file-saver';

const API_BASE_URL = 'http://localhost:3001/api';

// Types
interface Project {
  id: string;
  name: string;
  code: string;
  health_status: string | null;
}

interface DocType {
  id: string;
  label: string;
  is_periodic: boolean;
  entity_type: string;
  native_format: string;
}

interface EmissionPolicy {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  anchor_date: string;
  description?: string;
}

interface User {
  id: string;
  name: string;
  family_name: string;
  email: string;
}

interface DocRevision {
  id: string;
  revision: number | null;
  revision_code?: string;
  revision_notes?: string;
  source_filename?: string | null;
  source_file_size?: number;
  source_file_path?: string;
  uploaded_at?: string | null;
  uploaded_by?: string;
  uploader?: User;
  period_label?: string;
  period_start?: string;
  period_end?: string;
  expected_at?: string;
  period_id?: string;
  status: 'pending' | 'received' | 'late';
}

interface ProjDoc {
  id: string;
  doc_number: string;
  title?: string;
  status: 'active' | 'superseded' | 'cancelled';
  created_at: string;
  doc_type: DocType;
  emission_policy?: EmissionPolicy;
  latest_revision?: DocRevision;
  revisions?: DocRevision[];
}

// Interface for period with upload status
interface PeriodWithStatus {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
  status: 'pending' | 'received' | 'late';
  revision: DocRevision | null;
  upload_active: boolean;
  upload_status_message: string;
  days_until_due: number | null;
}

// Cache pour les périodes déjà chargées
const periodsCache = new Map<string, { 
  periods: PeriodWithStatus[], 
  timestamp: number,
  latestPeriod: { periodLabel: string, revision: DocRevision | null } | null 
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const ProjectDocumentsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodsDrawerOpen, setPeriodsDrawerOpen] = useState(false);
  const [selectedDocForPeriods, setSelectedDocForPeriods] = useState<ProjDoc | null>(null);
  const [periods, setPeriods] = useState<PeriodWithStatus[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [periodsError, setPeriodsError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [periodsRefreshKey, setPeriodsRefreshKey] = useState(0);
  const [loadingAllPeriods, setLoadingAllPeriods] = useState(false);
  const [loadedDocsCount, setLoadedDocsCount] = useState(0);

  // Store the latest period info for each document
  const [documentLatestPeriod, setDocumentLatestPeriod] = useState<Map<string, { periodLabel: string, revision: DocRevision | null }>>(new Map());

  // Charger les détails du projet
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
        setProject(response.data.data.project);
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };
    fetchProject();
  }, [projectId]);

  // 🔥 Fonction optimisée pour traiter les données de périodes
  const processPeriodsData = useCallback((periodsData: any[], policyId: string): PeriodWithStatus[] => {
    return periodsData.map((period: any) => {
      const dueDate = period.expected_at ? parseISO(period.expected_at) : null;
      const today = new Date();
      const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      const hasRevision = period.revision || period.revisions?.length > 0;
      const revision = period.revision || (period.revisions?.[0]);
      
      return {
        id: period.id,
        period_label: period.period_label || `${format(parseISO(period.period_start), 'MMM yyyy')}`,
        period_start: period.period_start,
        period_end: period.period_end,
        expected_at: period.expected_at,
        status: hasRevision ? 'received' : (dueDate && dueDate < today ? 'late' : 'pending'),
        revision: revision || null,
        upload_active: !hasRevision && dueDate ? dueDate <= today : false,
        upload_status_message: hasRevision 
          ? 'Document received' 
          : dueDate 
          ? dueDate <= today 
            ? 'This period is due now' 
            : `Due in ${daysUntilDue} days`
          : 'No due date set',
        days_until_due: daysUntilDue
      };
    });
  }, []);

  // 🔥 Fonction pour extraire la période la plus récente
  const extractLatestPeriod = useCallback((periods: PeriodWithStatus[]): { periodLabel: string, revision: DocRevision | null } | null => {
    const periodsWithRevision = periods.filter(p => p.revision !== null);
    
    if (periodsWithRevision.length === 0) {
      return null;
    }
    
    const sortedPeriods = [...periodsWithRevision].sort((a, b) => {
      if (a.period_end && b.period_end) {
        return new Date(b.period_end).getTime() - new Date(a.period_end).getTime();
      }
      return 0;
    });
    
    const latest = sortedPeriods[0];
    return {
      periodLabel: latest.period_label,
      revision: latest.revision
    };
  }, []);

  // 🔥 Charger les périodes pour tous les documents périodiques en parallèle
  const loadAllPeriodicDocuments = useCallback(async (docs: ProjDoc[]) => {
    const periodicDocs = docs.filter(doc => doc.doc_type.is_periodic && doc.emission_policy?.id);
    
    if (periodicDocs.length === 0) {
      console.log('📭 Aucun document périodique trouvé');
      return;
    }
    
    console.log(`📊 Chargement des périodes pour ${periodicDocs.length} documents périodiques`);
    setLoadingAllPeriods(true);
    setLoadedDocsCount(0);
    
    const newDocumentPeriods = new Map<string, { periodLabel: string, revision: DocRevision | null }>();
    
    // Vérifier le cache d'abord
    const docsToLoad: ProjDoc[] = [];
    const now = Date.now();
    
    periodicDocs.forEach(doc => {
      const cacheKey = doc.emission_policy!.id;
      const cached = periodsCache.get(cacheKey);
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Utiliser le cache
        if (cached.latestPeriod) {
          newDocumentPeriods.set(doc.id, cached.latestPeriod);
        }
        setLoadedDocsCount(prev => prev + 1);
      } else {
        // À charger
        docsToLoad.push(doc);
      }
    });
    
    if (docsToLoad.length === 0) {
      // Tout était en cache
      setDocumentLatestPeriod(newDocumentPeriods);
      setLoadingAllPeriods(false);
      console.log('✅ Toutes les périodes chargées depuis le cache');
      return;
    }
    
    // Charger en parallèle avec Promise.all
    const promises = docsToLoad.map(async (doc) => {
      try {
        const cacheKey = doc.emission_policy!.id;
        const endpoint = `${API_BASE_URL}/emission-policies/${cacheKey}/periods/revision-status`;
        
        const response = await axios.get(endpoint, { timeout: 8000 });
        
        const periodsData = response.data?.data || response.data || [];
        
        if (Array.isArray(periodsData) && periodsData.length > 0) {
          const processedPeriods = processPeriodsData(periodsData, cacheKey);
          const latestPeriod = extractLatestPeriod(processedPeriods);
          
          // Mettre en cache
          periodsCache.set(cacheKey, {
            periods: processedPeriods,
            timestamp: Date.now(),
            latestPeriod
          });
          
          if (latestPeriod) {
            newDocumentPeriods.set(doc.id, latestPeriod);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${doc.doc_number}:`, error);
      } finally {
        setLoadedDocsCount(prev => prev + 1);
      }
    });
    
    // Attendre que tous les chargements soient terminés
    await Promise.all(promises);
    
    setDocumentLatestPeriod(prev => {
      // Fusionner avec les données du cache
      const merged = new Map(prev);
      newDocumentPeriods.forEach((value, key) => {
        merged.set(key, value);
      });
      return merged;
    });
    
    setLoadingAllPeriods(false);
    console.log('✅ Chargement de toutes les périodes terminé');
  }, [processPeriodsData, extractLatestPeriod]);

  // 🔥 Mettre à jour quand les documents sont chargés
  useEffect(() => {
    if (documents.length > 0) {
      loadAllPeriodicDocuments(documents);
    }
  }, [documents, loadAllPeriodicDocuments]);

  // 🔥 Obtenir la révision de la période la plus récente pour un document
  const getLatestPeriodRevision = useCallback((docId: string): DocRevision | null => {
    return documentLatestPeriod.get(docId)?.revision || null;
  }, [documentLatestPeriod]);

  // 🔥 Obtenir le label de la période la plus récente pour un document
  const getLatestPeriodLabel = useCallback((docId: string): string | null => {
    return documentLatestPeriod.get(docId)?.periodLabel || null;
  }, [documentLatestPeriod]);

  // 🔥 Fonction pour déterminer la dernière révision globale (pour les documents non-périodiques)
  const getLatestGlobalRevision = useCallback((doc: ProjDoc): DocRevision | undefined => {
    if (!doc.revisions || doc.revisions.length === 0) {
      return doc.latest_revision;
    }
    
    const uploadedRevisions = doc.revisions.filter(r => r.revision !== null);
    const sortedRevisions = [...uploadedRevisions].sort((a, b) => (b.revision || 0) - (a.revision || 0));
    return sortedRevisions[0] || undefined;
  }, []);

  // 🔥 Fonction pour charger les périodes d'un document (pour le drawer) - utilise le cache
  const loadPeriods = useCallback(async (doc: ProjDoc) => {
    if (!doc.id || !doc.emission_policy?.id) {
      console.log('❌ No emission policy found for document');
      setPeriodsError('No emission policy found for this document');
      return;
    }
    
    setLoadingPeriods(true);
    setPeriodsError(null);
    
    const cacheKey = doc.emission_policy.id;
    const cached = periodsCache.get(cacheKey);
    
    // Utiliser le cache si disponible et pas trop vieux
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📦 Utilisation du cache pour ${doc.doc_number}`);
      setPeriods(cached.periods);
      setLoadingPeriods(false);
      return;
    }
    
    try {
      console.log(`📅 Getting periods for policy: ${doc.emission_policy.id}`);
      const endpoint = `${API_BASE_URL}/emission-policies/${doc.emission_policy.id}/periods/revision-status`;
      
      const response = await axios.get(endpoint, { timeout: 10000 });
      const periodsData = response.data?.data || response.data || [];
      
      if (!Array.isArray(periodsData)) {
        console.error('Periods data is not an array:', periodsData);
        setPeriodsError('Invalid periods data received');
        setLoadingPeriods(false);
        return;
      }
      
      const processedPeriods = processPeriodsData(periodsData, cacheKey);
      const latestPeriod = extractLatestPeriod(processedPeriods);
      
      // Mettre en cache
      periodsCache.set(cacheKey, {
        periods: processedPeriods,
        timestamp: Date.now(),
        latestPeriod
      });
      
      // Mettre à jour le documentLatestPeriod si nécessaire
      if (latestPeriod) {
        setDocumentLatestPeriod(prev => {
          const newMap = new Map(prev);
          newMap.set(doc.id, latestPeriod);
          return newMap;
        });
      }
      
      setPeriods(processedPeriods);
      
    } catch (error: any) {
      console.error('Error loading periods:', error);
      setPeriodsError(error.message || 'Failed to load periods');
    } finally {
      setLoadingPeriods(false);
    }
  }, [processPeriodsData, extractLatestPeriod]);

  // 🔥 Fonction pour ouvrir le drawer des périodes
  const handleViewPeriods = useCallback(async (doc: ProjDoc) => {
    console.log('📂 Opening periods for document:', doc.doc_number);
    setSelectedDocForPeriods(doc);
    setPeriods([]);
    setPeriodsError(null);
    await loadPeriods(doc);
    setPeriodsDrawerOpen(true);
  }, [loadPeriods]);

  // 🔥 Fonction pour fermer le drawer
  const handleCloseDrawer = useCallback(() => {
    setPeriodsDrawerOpen(false);
    setTimeout(() => {
      setSelectedDocForPeriods(null);
      setPeriods([]);
      setPeriodsError(null);
    }, 300);
  }, []);

  // 🔥 Fonction pour rafraîchir les périodes
  const refreshPeriods = useCallback(async () => {
    if (selectedDocForPeriods) {
      console.log('🔄 Refreshing periods...');
      // Invalider le cache
      if (selectedDocForPeriods.emission_policy?.id) {
        periodsCache.delete(selectedDocForPeriods.emission_policy.id);
      }
      await loadPeriods(selectedDocForPeriods);
      await fetchDocuments();
      setPeriodsRefreshKey(prev => prev + 1);
    }
  }, [selectedDocForPeriods, loadPeriods]);

  // 🔥 Fonction pour gérer l'upload
  const handlePeriodUpload = useCallback(async (
    period: PeriodWithStatus,
    file: File,
    revisionCode?: string,
    revisionNotes?: string
  ) => {
    if (!selectedDocForPeriods) return;
    
    setUploadingId(period.id);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (revisionCode) formData.append('revision_code', revisionCode);
      if (revisionNotes) formData.append('revision_notes', revisionNotes);
      formData.append('period_id', period.id);

      const endpoint = `${API_BASE_URL}/doc-revisions/projdocs/${selectedDocForPeriods.id}/revisions`;
      
      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      console.log('✅ Upload successful');
      alert(`✅ File uploaded successfully!`);
      
      // Invalider le cache
      if (selectedDocForPeriods.emission_policy?.id) {
        periodsCache.delete(selectedDocForPeriods.emission_policy.id);
      }
      
      await refreshPeriods();
      
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      alert(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  }, [selectedDocForPeriods, refreshPeriods]);

  // Charger les documents du projet
  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/projdocs/project/${projectId}?includeRevisions=true`, {
        timeout: 10000
      });
      
      let docs: ProjDoc[] = [];
      if (response.data?.data?.docs) {
        docs = response.data.data.docs;
      } else if (response.data?.docs) {
        docs = response.data.docs;
      } else if (Array.isArray(response.data)) {
        docs = response.data;
      }
      
      setDocuments(docs);
      
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      setError(error.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Rafraîchir la liste
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Vider le cache
    periodsCache.clear();
    await fetchDocuments();
    setRefreshing(false);
  }, [fetchDocuments]);

  // Fonction de téléchargement
  const handleDownload = useCallback(async (revision: DocRevision) => {
    if (!revision.id) return;

    setDownloadingId(revision.id);
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/doc-revisions/${revision.id}/download`,
        { responseType: 'blob', timeout: 30000 }
      );
      
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      
      saveAs(blob, revision.source_filename || 'document.bin');
      
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // Filtrer les documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchTerm === '' || 
      doc.doc_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      doc.doc_type.label.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'periodic') return matchesSearch && doc.doc_type.is_periodic;
    if (activeTab === 'adhoc') return matchesSearch && !doc.doc_type.is_periodic;
    if (activeTab === 'active') return matchesSearch && doc.status === 'active';
    
    return matchesSearch;
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case 'superseded':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Superseded</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculer la progression du chargement
  const loadingProgress = documents.length > 0 
    ? Math.round((loadedDocsCount / documents.filter(d => d.doc_type.is_periodic && d.emission_policy?.id).length) * 100) 
    : 0;

  return (
    <div className="container mx-auto py-6">
      {/* En-tête */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {project ? project.name : 'Loading...'} - Documents
          </h1>
          {project && (
            <p className="text-sm text-gray-500">
              Project Code: {project.code} • {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={loading || refreshing || loadingAllPeriods}
          >
            {(refreshing || loadingAllPeriods) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Dialogue de création */}
      <CreateDocFlow
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleRefresh}
      />

      {/* Drawer des périodes */}
      <PeriodsListDrawer
        key={periodsRefreshKey}
        open={periodsDrawerOpen}
        onOpenChange={handleCloseDrawer}
        document={selectedDocForPeriods}
        periods={periods}
        onDownload={handleDownload}
        onUpload={handlePeriodUpload}
        downloadingId={downloadingId}
        uploadingId={uploadingId}
        loading={loadingPeriods}
        error={periodsError}
        onRefresh={refreshPeriods}
      />

      {/* Filtres et recherche */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by document number, title or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="periodic">Periodic</TabsTrigger>
              <TabsTrigger value="adhoc">Ad-hoc</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Liste des documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Project Documents</CardTitle>
          <CardDescription>
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
            {searchTerm && ` matching "${searchTerm}"`}
            {loadingAllPeriods && (
              <span className="ml-2 text-blue-600">
                (Loading periods... {loadingProgress}%)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
              <p className="text-sm text-gray-500 mt-2">
                {searchTerm || activeTab !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Get started by creating your first document'}
              </p>
              {!searchTerm && activeTab === 'all' && (
                <Button onClick={() => setDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => {
                    const isPeriodic = doc.doc_type.is_periodic;
                    const latestPeriodRevision = isPeriodic ? getLatestPeriodRevision(doc.id) : null;
                    const globalLatestRevision = !isPeriodic ? getLatestGlobalRevision(doc) : null;
                    const displayRevision = isPeriodic ? latestPeriodRevision : globalLatestRevision;
                    const latestPeriodLabel = isPeriodic ? getLatestPeriodLabel(doc.id) : null;
                    
                    // Afficher un placeholder pendant le chargement
                    if (isPeriodic && loadingAllPeriods && !latestPeriodLabel) {
                      return (
                        <TableRow key={doc.id}>
                          <TableCell colSpan={7}>
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <span className="text-sm text-gray-600">
                                Loading periods for {doc.doc_number}...
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium font-mono">
                          <div className="flex items-center gap-2">
                            {doc.doc_number}
                            {isPeriodic && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                <Clock className="h-3 w-3 mr-1" />
                                {doc.emission_policy?.frequency}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{doc.doc_type.label}</TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {doc.title || <span className="text-gray-400 italic">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>
                          {displayRevision?.source_filename ? (
                            <div>
                              <div className="font-medium text-sm truncate max-w-[200px]" title={displayRevision.source_filename}>
                                {displayRevision.source_filename}
                              </div>
                              {displayRevision.revision && (
                                <div className="text-xs text-gray-500">
                                  Rev: {displayRevision.revision}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No file</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPeriodic ? (
                            // Pour les documents périodiques: afficher juste le numéro de période
                            latestPeriodLabel ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Calendar className="h-3 w-3 mr-1" />
                                {latestPeriodLabel}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">No file</span>
                            )
                          ) : (
                            // Pour les documents adhoc: afficher juste la date d'upload (sans uploader)
                            displayRevision?.uploaded_at ? (
                              <span className="text-sm text-gray-600">
                                {formatDate(displayRevision.uploaded_at)}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {displayRevision?.source_filename ? (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleDownload(displayRevision)}
                                disabled={downloadingId === displayRevision.id}
                                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[90px]"
                              >
                                {downloadingId === displayRevision.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="opacity-50 cursor-not-allowed min-w-[90px]"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(`/projdocs/${doc.id}`, '_blank')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                
                                {displayRevision?.source_filename && (
                                  <DropdownMenuItem onClick={() => handleDownload(displayRevision)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Latest
                                  </DropdownMenuItem>
                                )}
                                
                                {isPeriodic ? (
                                  <DropdownMenuItem 
                                    onClick={() => handleViewPeriods(doc)}
                                    disabled={loadingPeriods}
                                  >
                                    {loadingPeriods && selectedDocForPeriods?.id === doc.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Calendar className="h-4 w-4 mr-2" />
                                    )}
                                    View All Periods
                                  </DropdownMenuItem>
                                ) : (
                                  doc.revisions && doc.revisions.length > 0 && (
                                    <DropdownMenuItem onClick={() => window.open(`/projdocs/${doc.id}/revisions`, '_blank')}>
                                      <History className="h-4 w-4 mr-2" />
                                      View All Revisions ({doc.revisions.length})
                                    </DropdownMenuItem>
                                  )
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDocumentsPage;