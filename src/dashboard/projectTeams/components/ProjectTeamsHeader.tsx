// frontend/src/pages/ProjectTeams/components/ProjectTeamsHeader.tsx
import React from 'react';
import { Download, RefreshCw, AlertTriangle } from 'lucide-react';

interface ProjectTeamsHeaderProps {
  userRole: string;
  onExport: () => void;
  onRefresh: () => void;
  understaffedCount: number;
  totalBUs: number;
  onUnderstaffedClick: () => void;
  canExport?: boolean;  // ✅ Ajouté
}

export const ProjectTeamsHeader: React.FC<ProjectTeamsHeaderProps> = ({
  userRole,
  onExport,
  onRefresh,
  understaffedCount,
  totalBUs,
  onUnderstaffedClick,
  canExport = true,  // ✅ Par défaut true pour compatibilité
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">Project Teams</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {userRole}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor project team assignments across all business units
          </p>
        </div>
        <div className="flex space-x-2">
          {/* ✅ Export button conditionnel */}
          {canExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </button>
          )}
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Understaffed indicator - inchangé */}
      {understaffedCount > 0 && (
        <div className="mt-4">
          <button
            onClick={onUnderstaffedClick}
            className="inline-flex items-center px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-sm font-medium text-yellow-800">
              {understaffedCount} project{understaffedCount !== 1 ? 's' : ''} understaffed across {totalBUs} BUs
            </span>
          </button>
        </div>
      )}
    </div>
  );
};