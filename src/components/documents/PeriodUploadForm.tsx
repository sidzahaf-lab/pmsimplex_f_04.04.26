// src/components/documents/PeriodUploadForm.tsx
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Upload, 
  X, 
  Check, 
  AlertCircle,
  File,
  Image,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Info
} from 'lucide-react';
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
    label: string;
    is_periodic: boolean;
    native_format?: string;
  };
}

interface PeriodUploadFormProps {
  document: Document;
  period: Period;
  onSubmit: (file: File, revisionCode?: string, revisionNotes?: string) => Promise<void>;
  onCancel: () => void;
  isUploading: boolean;
}

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

const getFileIcon = (filename: string) => {
  const ext = getFileExtension(filename).toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return <Image className="h-5 w-5 text-blue-500" />;
  }
  if (['pdf'].includes(ext)) {
    return <File className="h-5 w-5 text-red-500" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (['doc', 'docx'].includes(ext)) {
    return <File className="h-5 w-5 text-blue-700" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-yellow-600" />;
  }
  if (['js', 'ts', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-purple-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
};

export const PeriodUploadForm: React.FC<PeriodUploadFormProps> = ({
  document,
  period,
  onSubmit,
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file, document.doc_type.native_format);

    setFileValidation(validation);
    
    if (validation.isValid) {
      setSelectedFile(file);
      setUploadProgress(0);
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

    await onSubmit(selectedFile, revisionCode || undefined, revisionNotes || undefined);
  };

  const nextRevisionNumber = period.revision ? period.revision.revision + 1 : 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Info */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Upload Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-600 text-xs">Document</span>
            <div className="font-medium">{document.doc_number}</div>
          </div>
          <div>
            <span className="text-blue-600 text-xs">Period</span>
            <div className="font-medium">{period.period_label}</div>
          </div>
          <div>
            <span className="text-blue-600 text-xs">Period Dates</span>
            <div className="font-medium">
              {new Date(period.period_start).toLocaleDateString()} - {new Date(period.period_end).toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className="text-blue-600 text-xs">Revision</span>
            <div className="font-medium">
              {period.revision ? (
                <>New revision (currently Rev {period.revision.revision}) → Rev {nextRevisionNumber}</>
              ) : (
                <>First revision (Rev 1)</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div>
        <Label htmlFor="file-upload" className="text-base font-medium mb-2 block">
          Document File *
        </Label>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
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
            id="file-upload"
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
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <div className={`p-3 rounded-full ${fileValidation.isValid ? 'bg-green-100' : 'bg-red-100'}`}>
                  {fileValidation.isValid ? (
                    <Check className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {getFileIcon(selectedFile.name)}
                <span className="font-medium text-lg">{selectedFile.name}</span>
              </div>

              <div className="text-sm text-gray-500">
                {formatFileSize(selectedFile.size)}
              </div>

              {!fileValidation.isValid && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fileValidation.message}</AlertDescription>
                </Alert>
              )}

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Remove file
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop file here' : 'Drag & drop or click to select'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Max 50MB • Allowed formats: {document.doc_type.native_format || 'PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Revision Code */}
      <div className="space-y-2">
        <Label htmlFor="revision-code">Revision Code (Optional)</Label>
        <Input
          id="revision-code"
          placeholder={period.revision ? "R1, B2, C3, etc." : "R0, B1, C2, etc."}
          value={revisionCode}
          onChange={(e) => setRevisionCode(e.target.value)}
          disabled={isUploading}
        />
        <p className="text-sm text-gray-500">
          Optional revision identifier for this {period.revision ? 'new revision' : 'first revision'}
        </p>
      </div>

      {/* Revision Notes */}
      <div className="space-y-2">
        <Label htmlFor="revision-notes">Revision Notes (Optional)</Label>
        <Textarea
          id="revision-notes"
          placeholder={period.revision 
            ? "Reason for this new revision or changes made"
            : "Reason for this revision or additional notes"}
          rows={4}
          value={revisionNotes}
          onChange={(e) => setRevisionNotes(e.target.value)}
          disabled={isUploading}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isUploading}
          className="flex-1 py-6"
          size="lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isUploading || !selectedFile || !fileValidation.isValid}
          className="flex-1 py-6 bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              Upload {period.revision ? 'New Revision' : 'Document'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};