// src/utils/apiUtils.ts
import { apiClient } from '../services/api'; // Changed from apiHelper to apiClient
import { AxiosResponse } from 'axios';

/**
 * Generic API utility functions
 */
export class ApiUtils {
  /**
   * Handle API errors consistently
   */
  static handleApiError(error: any): {
    success: boolean;
    status: number;
    message: string;
    data?: any;
    error: any;
  } {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      return {
        success: false,
        status: error.response.status,
        message: error.response.data?.message || 'API Error',
        data: error.response.data,
        error: error
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        success: false,
        status: 0,
        message: 'No response from server',
        error: error
      };
    } else {
      // Something happened in setting up the request
      return {
        success: false,
        status: -1,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Retry API call with exponential backoff
   */
  static async retryApiCall<T>(
    apiCall: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, delay * Math.pow(2, i))
        );
        console.log(`Retry ${i + 1}/${maxRetries}`);
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Debounce API calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Check if API is reachable
   */
  static async checkApiHealth(): Promise<{
    online: boolean;
    data?: any;
    error?: string;
    timestamp: string;
  }> {
    try {
      const response = await apiClient.get('/health'); // Changed to apiClient
      return {
        online: true,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        online: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Format API query parameters
   */
  static formatQueryParams(params: Record<string, any> = {}): string {
    const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return new URLSearchParams(filteredParams).toString();
  }

  /**
   * Download file from API
   */
  static async downloadFile(url: string, filename: string): Promise<void> {
    const response = await apiClient.get(url, { responseType: 'blob' }); // Changed to apiClient
    
    // Create blob link to download
    const href = URL.createObjectURL(response.data);
    
    // Create "a" HTML element with href to file
    const link = document.createElement('a');
    link.href = href;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    // Clean up and remove the link
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }

  /**
   * Upload file with progress tracking - FIXED
   */
  static uploadFile(
    url: string, 
    file: File, 
    onProgress?: (progressEvent: any) => void
  ): Promise<AxiosResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    // FIX: Use apiClient directly instead of apiHelper.post
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    });
  }

  /**
   * Cache API responses - FIXED return type
   */
  static createCachedApiCall<T extends (...args: any[]) => Promise<any>>(
    apiCall: T,
    cacheKey: string,
    ttl = 60000
  ): (...args: Parameters<T>) => Promise<any> { // FIX: Changed ReturnType<T> to Promise<any>
    return async (...args: Parameters<T>): Promise<any> => {
      const now = Date.now();
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (now - timestamp < ttl) {
          return data;
        }
      }
      
      try {
        const result = await apiCall(...args);
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: now
        }));
        return result;
      } catch (error) {
        // If offline, try to return cached data
        if (cached && !navigator.onLine) {
          const { data } = JSON.parse(cached);
          return data;
        }
        throw error;
      }
    };
  }
}