// src/hooks/useDocClassification.ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { DocCategory, DocSubcategory, DocType } from '@/types/docTypes';

const API_BASE_URL = 'http://localhost:3001/api';

export const useCategories = () => {
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/doc-categories`);
        setCategories(response.data.data.categories || []);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load categories');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
};

export const useSubcategories = (categoryId?: string) => {
  const [subcategories, setSubcategories] = useState<DocSubcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!categoryId) return;
      
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/doc-subcategories/by-category/${categoryId}`);
        setSubcategories(response.data.data.subcategories || []);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load subcategories');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubcategories();
  }, [categoryId]);

  return { subcategories, loading, error };
};

export const useDocTypes = (subcategoryId?: string) => {
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocTypes = async () => {
      if (!subcategoryId) return;
      
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/doc-types/by-subcategory/${subcategoryId}`);
        setDocTypes(response.data.data.docTypes || []);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load document types');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocTypes();
  }, [subcategoryId]);

  return { docTypes, loading, error };
};

// NOUVEAU HOOK : Récupérer TOUS les types de documents
export const useAllDocTypes = () => {
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllDocTypes = async () => {
      try {
        setLoading(true);
        console.log('📥 Fetching ALL document types...');
        
        // Récupérer tous les types sans filtre
        const response = await axios.get(`${API_BASE_URL}/doc-types?limit=1000&include=subcategory.category`);
        
        console.log('📦 API Response:', response.data);
        
        let types: DocType[] = [];
        
        // Adapter selon la structure de réponse
        if (response.data?.data?.docTypes) {
          types = response.data.data.docTypes;
        } else if (response.data?.data) {
          types = response.data.data;
        } else if (Array.isArray(response.data)) {
          types = response.data;
        } else if (response.data?.docTypes) {
          types = response.data.docTypes;
        }
        
        console.log(`✅ Loaded ${types.length} document types`);
        setDocTypes(types);
        setError(null);
      } catch (err: any) {
        console.error('❌ Error fetching all doc types:', err);
        setError(err.response?.data?.message || 'Failed to load document types');
      } finally {
        setLoading(false);
      }
    };

    fetchAllDocTypes();
  }, []);

  return { docTypes, loading, error };
};

export const useSubcategoriesWithDocTypes = (categoryId: string) => {
  const [subcategories, setSubcategories] = useState<(DocSubcategory & { doc_types: DocType[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;

    const fetchSubcategoriesWithTypes = async () => {
      try {
        setLoading(true);
        
        // Fetch subcategories for this category
        const subResponse = await axios.get(`${API_BASE_URL}/doc-subcategories/by-category/${categoryId}`);
        const subcategoriesList = subResponse.data.data.subcategories || [];
        
        // For each subcategory, fetch its doc types
        const subcategoriesWithTypes = await Promise.all(
          subcategoriesList.map(async (sub: DocSubcategory) => {
            try {
              const typesResponse = await axios.get(`${API_BASE_URL}/doc-types/by-subcategory/${sub.id}`);
              const docTypes = typesResponse.data.data.docTypes || [];
              return {
                ...sub,
                doc_types: docTypes.sort((a: DocType, b: DocType) => 
                  (a.order_index || 0) - (b.order_index || 0)
                )
              };
            } catch (err) {
              console.error(`Failed to load doc types for subcategory ${sub.id}`, err);
              return { ...sub, doc_types: [] };
            }
          })
        );

        setSubcategories(subcategoriesWithTypes);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load subcategories');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubcategoriesWithTypes();
  }, [categoryId]);

  return { subcategories, loading, error };
};

export const useDocTypeDetails = (docTypeId: string | null) => {
  const [docType, setDocType] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docTypeId) return;

    const fetchDocType = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/doc-types/${docTypeId}`);
        setDocType(response.data.data.docType || response.data.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load document type details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocType();
  }, [docTypeId]);

  return { docType, loading, error };
};