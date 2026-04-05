// frontend/src/pages/ProjectTeams/components/ProjectFilters.tsx
import React from 'react';
import { Search, X } from 'lucide-react';
import { BusinessUnit } from '../../../types';

interface ProjectFiltersProps {
  filters: {
    businessUnitId: string;
    healthStatus: string;
    phase: string;
    staffingStatus: string;
    search: string;
  };
  onFilterChange: (filters: any) => void;
  businessUnits: BusinessUnit[];
}

const HEALTH_STATUSES = [
  { value: '', label: 'All' },
  { value: 'good', label: 'Good' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const PHASES = [
  { value: '', label: 'All' },
  { value: 'FEED', label: 'FEED' },
  { value: 'Detailed Engineering', label: 'Detailed Engineering' },
  { value: 'Procurement', label: 'Procurement' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Pre-Commissioning', label: 'Pre-Commissioning' },
  { value: 'Commissioning', label: 'Commissioning' },
  { value: 'Close-out', label: 'Close-out' },
];

const STAFFING_STATUSES = [
  { value: '', label: 'All' },
  { value: 'fully_staffed', label: 'Fully Staffed' },
  { value: 'partially_staffed', label: 'Partially Staffed' },
  { value: 'unstaffed', label: 'Unstaffed' },
];

export const ProjectFilters: React.FC<ProjectFiltersProps> = ({
  filters,
  onFilterChange,
  businessUnits,
}) => {
  const handleFilterChange = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      businessUnitId: '',
      healthStatus: '',
      phase: '',
      staffingStatus: '',
      search: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 sticky top-0 z-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Business Unit Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business Unit
          </label>
          <select
            value={filters.businessUnitId}
            onChange={(e) => handleFilterChange('businessUnitId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All BUs</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </select>
        </div>

        {/* Health Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Health Status
          </label>
          <select
            value={filters.healthStatus}
            onChange={(e) => handleFilterChange('healthStatus', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {HEALTH_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Phase Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phase
          </label>
          <select
            value={filters.phase}
            onChange={(e) => handleFilterChange('phase', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {PHASES.map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>
        </div>

        {/* Staffing Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staffing Status
          </label>
          <select
            value={filters.staffingStatus}
            onChange={(e) => handleFilterChange('staffingStatus', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {STAFFING_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Project code, name, or member..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};