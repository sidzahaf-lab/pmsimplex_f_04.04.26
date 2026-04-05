// src/components/documents/PeriodsListDrawer.tsx
import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Download, 
  FileText, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Upload,
  History,
  File,
  User,
  Info,
  ChevronRight,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { PeriodUploadForm } from './PeriodUploadForm';

interface PeriodRevision {
  id: string;
  revision: number | null;
  revision_code?: string;
  revision_notes?: string;
  source_filename?: string | null;
  source_file_size?: number;
  uploaded_at?: string | null;
  uploader?: {
    name: string;
    family_name: string;
    email: string;
  };
}

interface Period {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  expected_at: string;
  status: 'pending' | 'received' | 'late';
  revision: PeriodRevision | null;
  upload_active: boolean;
  upload_status_message: string;
  days_until_due: number | null;
}

interface Document {
  id: string;
  doc_number: string;
  title?: string;
  doc_type: {
    label: string;
    is_periodic: boolean;
  };
  emission_policy?: {
    frequency: string;
    anchor_date: string;
  };
}

interface PeriodsListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  periods: Period[];
  onDownload: (revision: PeriodRevision) => void;
  onUpload: (period: Period, file: File, revisionCode?: string, revisionNotes?: string) => Promise<void>;
  downloadingId: string | null;
  uploadingId: string | null;
}

const PeriodsListDrawer: React.FC<PeriodsListDrawerProps> = ({
  open,
  onOpenChange,
  document,
  periods,
  onDownload,
  onUpload,
  downloadingId,
  uploadingId
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const sortedPeriods = React.useMemo(() => {
    return [...periods].sort((a, b) => {
      if (a.period_start && b.period_start) {
        return new Date(a.period_start).getTime() - new Date(b.period_start).getTime();
      }
      return 0;
    });
  }, [periods]);

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

  const handleUploadClick = (period: Period) => {
    setSelectedPeriod(period);
    setShowUploadForm(true);
  };

  const handleUploadSubmit = async (file: File, revisionCode?: string, revisionNotes?: string) => {
    if (!selectedPeriod) return;
    await onUpload(selectedPeriod, file, revisionCode, revisionNotes);
    setShowUploadForm(false);
    setSelectedPeriod(null);
  };

  const handleBackToList = () => {
    setShowUploadForm(false);
    setSelectedPeriod(null);
  };

  const getStatusBadge = (periodItem: Period) => {
    if (periodItem.revision) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Received
        </Badge>
      );
    }
    if (periodItem.status === 'late') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Late
        </Badge>
      );
    }
    if (periodItem.upload_active) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Due Now
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-50">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  if (!document) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader className="border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2 text-xl">
                <Calendar className="h-5 w-5" />
                {showUploadForm ? 'Upload Document' : `Periods for ${document.doc_number}`}
              </DrawerTitle>
              <DrawerDescription className="text-base">
                {!showUploadForm && (
                  <>
                    {document.doc_type.label} • {document.emission_policy?.frequency || 'N/A'} • {periods.length} periods total
                  </>
                )}
              </DrawerDescription>
            </div>
            {showUploadForm && (
              <Button variant="ghost" size="sm" onClick={handleBackToList} className="gap-2">
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to periods
              </Button>
            )}
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-6">
          {showUploadForm && selectedPeriod ? (
            <PeriodUploadForm
              document={document}
              period={selectedPeriod}
              onSubmit={handleUploadSubmit}
              onCancel={handleBackToList}
              isUploading={uploadingId === selectedPeriod.id}
            />
          ) : (
            <div className="space-y-4">
              {periods.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-semibold">No periods found</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    This document has no periods defined yet.
                  </p>
                </div>
              ) : (
                sortedPeriods.map((periodItem) => (
                  <div
                    key={periodItem.id}
                    className={`border rounded-lg overflow-hidden transition-all hover:shadow-md ${
                      periodItem.revision
                        ? 'border-green-200 hover:border-green-300'
                        : periodItem.upload_active
                        ? 'border-yellow-200 hover:border-yellow-300'
                        : periodItem.status === 'late'
                        ? 'border-red-200 hover:border-red-300'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`p-5 ${
                      periodItem.revision
                        ? 'bg-green-50/50'
                        : periodItem.upload_active
                        ? 'bg-yellow-50/50'
                        : periodItem.status === 'late'
                        ? 'bg-red-50/50'
                        : 'bg-gray-50/50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="font-mono font-semibold text-lg">
                              {document.doc_number}_{periodItem.period_label}
                            </span>
                            {getStatusBadge(periodItem)}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-500 text-xs">Period</span>
                              <div className="font-medium">
                                {formatDate(periodItem.period_start)} - {formatDate(periodItem.period_end)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Due Date</span>
                              <div className={`font-medium ${periodItem.upload_active ? 'text-red-600' : ''}`}>
                                {formatDate(periodItem.expected_at)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Status</span>
                              <div className="font-medium capitalize">{periodItem.status}</div>
                            </div>
                            {periodItem.revision && (
                              <div>
                                <span className="text-gray-500 text-xs">Latest Revision</span>
                                <div className="font-medium">
                                  Rev {periodItem.revision.revision}
                                  {periodItem.revision.revision_code && ` (${periodItem.revision.revision_code})`}
                                </div>
                              </div>
                            )}
                          </div>

                          {periodItem.revision?.source_filename && (
                            <div className="flex items-center gap-2 text-sm bg-white/80 p-2 rounded border border-green-100">
                              <File className="h-4 w-4 text-green-600" />
                              <span className="text-gray-700 truncate flex-1">{periodItem.revision.source_filename}</span>
                              {periodItem.revision.source_file_size && (
                                <span className="text-xs text-gray-500">
                                  ({(periodItem.revision.source_file_size / 1024).toFixed(0)} KB)
                                </span>
                              )}
                              {periodItem.revision.uploaded_at && (
                                <span className="text-xs text-gray-500 ml-2">
                                  {formatDateTime(periodItem.revision.uploaded_at)}
                                </span>
                              )}
                            </div>
                          )}

                          {periodItem.upload_status_message && (
                            <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-1">
                              <Info className="h-4 w-4" />
                              {periodItem.upload_status_message}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4 min-w-[120px]">
                          {periodItem.revision ? (
                            <>
                              <Button
                                size="default"
                                onClick={() => onDownload(periodItem.revision!)}
                                disabled={downloadingId === periodItem.revision.id}
                                variant="outline"
                                className="w-full bg-white"
                              >
                                {downloadingId === periodItem.revision.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Download
                              </Button>
                              
                              {periodItem.upload_active && (
                                <Button
                                  size="default"
                                  onClick={() => handleUploadClick(periodItem)}
                                  disabled={uploadingId === periodItem.id}
                                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {uploadingId === periodItem.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Upload className="h-4 w-4 mr-2" />
                                  )}
                                  New Revision
                                </Button>
                              )}
                            </>
                          ) : periodItem.upload_active ? (
                            <Button
                              size="default"
                              onClick={() => handleUploadClick(periodItem)}
                              disabled={uploadingId === periodItem.id}
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                              {uploadingId === periodItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Upload
                            </Button>
                          ) : (
                            <Badge variant="outline" className="py-2 text-center whitespace-nowrap bg-white">
                              Available {formatDate(periodItem.expected_at)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full" size="lg">
            Close
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PeriodsListDrawer;