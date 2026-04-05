// frontend/src/pages/ProjectTeams/components/ColumnSelector.tsx
import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface ColumnSelectorProps {
  availableRoles: string[];
  selectedColumns: string[];
  onToggleColumn: (roleName: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  availableRoles,
  selectedColumns,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Grouper les rôles par catégorie
  const coreRoles = ['Project Manager', 'Deputy PM', 'Planning Engineer', 'Cost Engineer', 'Document Controller'];
  const technicalRoles = ['QA/QC', 'HSE', 'Engineer'];
  const otherRoles = availableRoles.filter(role => 
    !coreRoles.includes(role) && !technicalRoles.includes(role)
  );

  const getRoleCategory = (roleName: string): string => {
    if (coreRoles.includes(roleName)) return 'Core PMT Roles';
    if (technicalRoles.includes(roleName)) return 'Technical & Support';
    return 'Other Roles';
  };

  const groupedRoles = availableRoles.reduce((acc, role) => {
    const category = getRoleCategory(role);
    if (!acc[category]) acc[category] = [];
    acc[category].push(role);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="relative mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Settings className="w-4 h-4 mr-2" />
        Select Columns ({selectedColumns.length}/{availableRoles.length})
        {isOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Select Columns to Display</span>
              <div className="flex space-x-2">
                <button
                  onClick={onSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={onDeselectAll}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedRoles).map(([category, roles]) => (
              <div key={category} className="mb-3">
                <div className="px-2 py-1 bg-gray-100 rounded">
                  <span className="text-xs font-semibold text-gray-600">{category}</span>
                </div>
                <div className="mt-1 space-y-1">
                  {roles.map(roleName => (
                    <label
                      key={roleName}
                      className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(roleName)}
                        onChange={() => onToggleColumn(roleName)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{roleName}</span>
                      {selectedColumns.includes(roleName) && (
                        <Check className="w-3 h-3 text-green-600 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};