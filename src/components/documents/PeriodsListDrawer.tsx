// src/components/documents/PeriodsListDrawer.tsx
import React, { useState, useRef } from 'react';
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
  File,
  User,
  Info,
  Image,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  RefreshCw,
  X,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatFileSize, isAllowedFileType, getFileExtension } from '@/lib/utils';

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
    id: string;
    label: string;
    is_periodic: boolean;
    native_format?: string;
  };
  emission_policy?: {
    id: string;
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
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

// File validation function
const validateFile = (
  file: File,
  allowedFormats: string = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'
): { isValid: boolean; message: string } => {
  const allowedFormatsList = allowedFormats
    .split(',')
    .map((f) => f.trim().toLowerCase());
  
  const isValid = isAllowedFileType(file.name, allowedFormatsList);

  if (!isValid) {
    return {
      isValid: false,
      message: `File type not allowed. Allowed formats: ${allowedFormats}`,
    };
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      message: 'File size must not exceed 50MB',
    };
  }

  return { isValid: true, message: 'File is valid' };
};

// Get file icon based on type
const getFileIcon = (filename: string) => {
  const ext = getFileExtension(filename).toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (['pdf'].includes(ext)) {
    return <File className="h-4 w-4 text-red-500" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  }
  if (['doc', 'docx'].includes(ext)) {
    return <File className="h-4 w-4 text-blue-700" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="h-4 w-4 text-yellow-600" />;
  }
  if (['js', 'ts', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-purple-500" />;
  }
  return <File className="h-4 w-4 text-gray-500" />;
};

// Inline upload form component
interface InlineUploadFormProps {
  period: Period;
  document: Document;
  onUpload: (file: File, revisionCode?: string, revisionNotes?: string) => Promise<void>;
  onCancel: () => void;
  isUploading: boolean;
}

const InlineUploadForm: React.FC<InlineUploadFormProps> = ({
  period,
  document,
  onUpload,
  onCancel,
  isUploading
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<{ isValid: boolean; message: string }>({
    isValid: true,
    message: ''
  });
  const [revisionCode, setRevisionCode] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file, document.doc_type.native_format);

    setFileValidation(validation);
    setUploadError(null);
    
    if (validation.isValid) {
      setSelectedFile(file);
      setUploadProgress(0);
      setUploadSuccess(false);
    } else {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileValidation({ isValid: true, message: '' });
    setUploadProgress(0);
    setUploadSuccess(false);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileValidation({
        isValid: false,
        message: 'Please select a file to upload'
      });
      return;
    }

    if (!fileValidation.isValid) return;

    setUploadError(null);
    setUploadProgress(10);
    
    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      await onUpload(selectedFile, revisionCode || undefined, revisionNotes || undefined);
      clearInterval(interval);
      setUploadProgress(100);
      setUploadSuccess(true);
      
      // Auto close after 2 seconds on success
      setTimeout(() => {
        onCancel();
      }, 2000);
      
    } catch (error: any) {
      clearInterval(interval);
      setUploadProgress(0);
      setUploadSuccess(false);
      setUploadError(error.message || 'Upload failed. Please try again.');
    }
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            {period.revision ? 'Upload New Revision' : 'Upload Document'}
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Period Info Summary */}
        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-600 mb-1">Uploading for:</div>
          <div className="font-mono font-medium text-xs">
            {document.doc_number}_{period.period_label}
          </div>
          {period.revision && (
            <div className="text-xs text-gray-600 mt-1">
              Current revision: Rev {period.revision.revision}
              {period.revision.revision_code && ` (${period.revision.revision_code})`}
            </div>
          )}
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600 text-xs">
              File uploaded successfully! Closing...
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : selectedFile
              ? fileValidation.isValid
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={document.doc_type.native_format
              ?.split(',')
              .map(f => f.trim())
              .join(',') || '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'}
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {getFileIcon(selectedFile.name)}
                <span className="font-medium text-xs truncate max-w-[150px]">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">({formatFileSize(selectedFile.size)})</span>
              </div>

              {!fileValidation.isValid && (
                <p className="text-xs text-red-600">{fileValidation.message}</p>
              )}

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div 
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadProgress === 100 && !uploadSuccess && (
                <p className="text-xs text-green-600">Processing...</p>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 text-xs"
                disabled={isUploading}
              >
                <X className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <Upload className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-xs font-medium">
                {isDragging ? 'Drop file here' : 'Drag & drop or click'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Max 50MB • {document.doc_type.native_format || 'PDF, DOC, XLS, JPG, PNG'}
              </p>
            </div>
          )}
        </div>

        {/* Revision Code */}
        <div className="space-y-1">
          <Label htmlFor="revision-code" className="text-xs">Revision Code (Optional)</Label>
          <Input
            id="revision-code"
            placeholder={period.revision ? "e.g., R2, B3" : "e.g., R0, B1"}
            value={revisionCode}
            onChange={(e) => setRevisionCode(e.target.value)}
            disabled={isUploading || uploadSuccess}
            className="h-7 text-xs"
          />
        </div>

        {/* Revision Notes */}
        <div className="space-y-1">
          <Label htmlFor="revision-notes" className="text-xs">Notes (Optional)</Label>
          <Textarea
            id="revision-notes"
            placeholder={period.revision 
              ? "Reason for new revision..."
              : "Additional notes..."}
            rows={2}
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            disabled={isUploading || uploadSuccess}
            className="text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isUploading || !selectedFile || !fileValidation.isValid || uploadSuccess}
            className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Uploading...
              </>
            ) : uploadSuccess ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Uploaded
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

const PeriodsListDrawer: React.FC<PeriodsListDrawerProps> = ({
  open,
  onOpenChange,
  document,
  periods,
  onDownload,
  onUpload,
  downloadingId,
  uploadingId,
  loading = false,
  error = null,
  onRefresh
}) => {
  const [uploadingPeriodId, setUploadingPeriodId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Log when periods change
  React.useEffect(() => {
    if (periods.length > 0) {
      console.log('📥 Periods received in drawer:', periods.map(p => ({
        label: p.period_label,
        status: p.status,
        hasRevision: !!p.revision,
        revisionId: p.revision?.id,
        upload_active: p.upload_active
      })));
    }
  }, [periods]);

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

  const formatShortDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yy');
    } catch {
      return dateString;
    }
  };

  const handleUploadClick = (period: Period) => {
    setUploadingPeriodId(period.id);
    setSuccessMessage(null);
  };

  const handleUploadCancel = () => {
    setUploadingPeriodId(null);
    setSuccessMessage(null);
  };

  const handleUploadSubmit = async (period: Period, file: File, revisionCode?: string, revisionNotes?: string) => {
    try {
      await onUpload(period, file, revisionCode, revisionNotes);
      setSuccessMessage(`Successfully uploaded ${period.revision ? 'new revision for' : ''} period ${period.period_label}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      // Error is handled in parent
    }
  };

  const getStatusBadge = (periodItem: Period) => {
    // Force received status if there's a revision
    if (periodItem.revision) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 h-5 text-xs whitespace-nowrap">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Received
        </Badge>
      );
    }
    
    // Check status from props
    if (periodItem.status === 'late') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 h-5 text-xs whitespace-nowrap">
          <AlertCircle className="h-3 w-3 mr-1" />
          Late
        </Badge>
      );
    }
    
    // Check if upload is active
    if (periodItem.upload_active) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 h-5 text-xs whitespace-nowrap">
          <Clock className="h-3 w-3 mr-1" />
          Due Now
        </Badge>
      );
    }
    
    // Default to pending
    return (
      <Badge variant="outline" className="bg-gray-50 h-5 text-xs whitespace-nowrap">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getDueIndicator = (periodItem: Period) => {
    // Don't show due indicator if period has been received
    if (periodItem.revision) {
      return null;
    }
    
    if (periodItem.days_until_due === null) return null;
    
    if (periodItem.days_until_due < 0) {
      return <span className="text-xs text-red-600 font-medium whitespace-nowrap">{Math.abs(periodItem.days_until_due)}d overdue</span>;
    }
    if (periodItem.days_until_due === 0) {
      return <span className="text-xs text-red-600 font-medium whitespace-nowrap">Due today</span>;
    }
    if (periodItem.days_until_due <= 7) {
      return <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">{periodItem.days_until_due}d left</span>;
    }
    return <span className="text-xs text-gray-500 whitespace-nowrap">{periodItem.days_until_due}d left</span>;
  };

  if (!document) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] flex flex-col">
        <DrawerHeader className="border-b sticky top-0 bg-white z-10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Periods for {document.doc_number}
              </DrawerTitle>
              <DrawerDescription className="text-sm">
                {document.doc_type.label} • {document.emission_policy?.frequency || 'N/A'} • {periods.length} periods
              </DrawerDescription>
            </div>
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRefresh}
                disabled={loading}
                className="h-8 w-8 p-0"
                title="Refresh periods"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </DrawerHeader>

        {/* Success Message Banner */}
        {successMessage && (
          <div className="mx-3 mt-3">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600 text-sm">
                {successMessage}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Error Message Banner */}
        {error && (
          <div className="mx-3 mt-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Scrollable area with vertical scrollbar */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-sm text-gray-600">Loading periods...</span>
              </div>
            ) : periods.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">No periods found</p>
              </div>
            ) : (
              sortedPeriods.map((periodItem) => (
                <div key={periodItem.id}>
                  {/* Main row - all in one line */}
                  <div
                    className={`border rounded-md overflow-hidden ${
                      periodItem.revision
                        ? 'border-green-200'
                        : periodItem.upload_active
                        ? 'border-yellow-200'
                        : periodItem.status === 'late'
                        ? 'border-red-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center px-3 py-2 gap-2 bg-white">
                      {/* Period label and status */}
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <span className="font-mono text-sm font-medium truncate">
                          {periodItem.period_label}
                        </span>
                        {getStatusBadge(periodItem)}
                      </div>

                      {/* Dates compact */}
                      <div className="flex items-center gap-1 text-xs text-gray-600 min-w-[130px]">
                        <span>{formatShortDate(periodItem.period_start)}</span>
                        <span>→</span>
                        <span>{formatShortDate(periodItem.period_end)}</span>
                      </div>

                      {/* Due date */}
                      <div className="min-w-[70px] text-xs">
                        <span className={periodItem.upload_active ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {formatShortDate(periodItem.expected_at)}
                        </span>
                      </div>

                      {/* Due indicator - hidden when status is received */}
                      <div className="min-w-[60px]">
                        {getDueIndicator(periodItem)}
                      </div>

                      {/* File info if exists */}
                      {periodItem.revision?.source_filename ? (
                        <div className="flex items-center gap-1 text-xs min-w-[120px]">
                          {getFileIcon(periodItem.revision.source_filename)}
                          <span className="truncate max-w-[60px]">
                            Rev {periodItem.revision.revision}
                          </span>
                          {periodItem.revision.uploader && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-gray-500 truncate max-w-[50px]">
                                {periodItem.revision.uploader.name}
                              </span>
                            </>
                          )}
                          {periodItem.revision.revision_code && (
                            <span className="text-gray-400 text-xs">
                              ({periodItem.revision.revision_code})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="min-w-[120px] text-xs text-gray-400 italic">
                          No file
                        </div>
                      )}

                      {/* Action buttons - always visible with proper enabled/disabled states */}
                      <div className="flex items-center gap-1 ml-auto">
                        {/* Download button - ENABLED only if revision exists */}
                        {periodItem.revision ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDownload(periodItem.revision!)}
                            disabled={downloadingId === periodItem.revision.id}
                            className="h-7 px-2 text-xs min-w-[60px]"
                            title="Download current revision"
                          >
                            {downloadingId === periodItem.revision.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            DL
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="h-7 px-2 text-xs min-w-[60px] opacity-50 cursor-not-allowed"
                            title="No file available to download"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            DL
                          </Button>
                        )}

                        {/* New Revision button - ALWAYS show if period has a revision, regardless of due date */}
                        {periodItem.revision ? (
                          <Button
                            size="sm"
                            onClick={() => handleUploadClick(periodItem)}
                            disabled={uploadingPeriodId !== null}
                            className="h-7 px-2 text-xs min-w-[60px] bg-blue-600 hover:bg-blue-700 text-white"
                            title="Upload new revision"
                          >
                            {uploadingId === periodItem.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            New
                          </Button>
                        ) : periodItem.upload_active ? (
                          // First upload button - for new documents (ENABLED)
                          <Button
                            size="sm"
                            onClick={() => handleUploadClick(periodItem)}
                            disabled={uploadingPeriodId !== null}
                            className="h-7 px-2 text-xs min-w-[60px] bg-green-600 hover:bg-green-700 text-white"
                            title="Upload document (period is due)"
                          >
                            {uploadingId === periodItem.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Upload className="h-3 w-3 mr-1" />
                            )}
                            Up
                          </Button>
                        ) : (
                          // Upload button - DISABLED (period not due yet)
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="h-7 px-2 text-xs min-w-[60px] opacity-50 cursor-not-allowed"
                            title={`Upload available from ${formatDate(periodItem.expected_at)}`}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Up
                          </Button>
                        )}

                        {/* File info icon if notes exist */}
                        {periodItem.revision?.revision_notes && (
                          <div className="relative group">
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded hidden group-hover:block z-20">
                              {periodItem.revision.revision_notes}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Upload Form */}
                  {uploadingPeriodId === periodItem.id && (
                    <InlineUploadForm
                      period={periodItem}
                      document={document}
                      onUpload={(file, revisionCode, revisionNotes) => 
                        handleUploadSubmit(periodItem, file, revisionCode, revisionNotes)
                      }
                      onCancel={handleUploadCancel}
                      isUploading={uploadingId === periodItem.id}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 sticky bottom-0 bg-white flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full" size="sm">
            Close
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export { PeriodsListDrawer };
export default PeriodsListDrawer;