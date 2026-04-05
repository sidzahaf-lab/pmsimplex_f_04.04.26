// DeleteScheduleDialog.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, Trash2, FileText, AlertTriangle } from "lucide-react";
import { Schedule } from "./SchedulesList";
import { Badge } from "@/components/ui/badge";

interface DeleteScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  onConfirm: () => void;
  loading: boolean;
}

export function DeleteScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onConfirm,
  loading,
}: DeleteScheduleDialogProps) {
  if (!schedule) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Delete Schedule
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Warning: This action cannot be undone
              </div>
              <p className="text-sm text-red-600">
                This will permanently delete the schedule and all associated data.
              </p>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-500">Schedule Code</p>
                  <p className="font-medium font-mono">{schedule.code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Schedule Name</p>
                  <p className="font-medium">{schedule.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <Badge variant="outline" className="mt-1">
                    {schedule.type.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Revision</p>
                  <p className="font-medium">
                    {schedule.current_revision?.revision_number || "No revision"}
                  </p>
                </div>
              </div>

              {schedule.workpackage && (
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-500 mb-1">Work Package</p>
                  <p className="font-medium">
                    {schedule.workpackage.code} - {schedule.workpackage.name}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Trash2 className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-800">What will be deleted:</p>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                    <li>The schedule record from the database</li>
                    <li>All schedule revisions ({schedule.revision_count || 0} total)</li>
                    <li>All XER files stored in Backblaze B2</li>
                    <li>All schedule-related data and metadata</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to delete this schedule? This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Schedule
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteScheduleDialog;