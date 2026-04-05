// utils/excelExport.ts - Simplified version
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string = 'export.xlsx', sheetName: string = 'Sheet1'): void => {
  try {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Simple column width calculation
    const columnWidths: number[] = [];
    data.forEach(row => {
      Object.values(row).forEach((value, index) => {
        const length = String(value || '').length;
        if (!columnWidths[index] || length > columnWidths[index]) {
          columnWidths[index] = length;
        }
      });
    });
    
    ws['!cols'] = columnWidths.map(width => ({ 
      wch: Math.min(width + 2, 50) 
    }));
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    
    console.log(`Excel file exported: ${fileName}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export Excel file. Please try again.');
  }
};

export const exportToCSV = (data: any[], fileName: string = 'export.csv'): void => {
  try {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`CSV file exported: ${fileName}`);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    alert('Failed to export CSV file. Please try again.');
  }
};