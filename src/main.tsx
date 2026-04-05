// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query' // ✅ Ajouté
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SuperAdminRoute } from './components/SuperAdminRoute'
import { Login } from './dashboard/Login'
import DashboardLayout from './dashboard/HomePage'
import { ConfigClient } from './dashboard/client/config-client'
import { BusinessUnitList } from './dashboard/businessUnits/BusinessUnitsList'
import { CreateBusinessUnit } from './dashboard/businessUnits/CreateBusinessUnit'
import { UsersList } from './dashboard/users/UsersList'
import { CreateUser } from './dashboard/users/CreateUser'
import { ProjectsList } from './dashboard/projects/ProjectsList'
import { CreateProject } from './dashboard/projects/CreateProject'
import { EditProject } from './dashboard/projects/EditProject'
import { CreateDocClassification } from './dashboard/documents/CreateDocumentClassification'
import { ProjectDocumentsPage } from './dashboard/documents/projectDocumentsPage'
import { MainPage } from './dashboard/documents/DocumentsList'
import { CreateEmissionPolicy } from './dashboard/documents/CreateEmissionPolicy'
import { GanttView } from './dashboard/projects/GanttView'
import { ProjectTeams } from './dashboard/projectTeams/projectTeams'

// Toast notifications
import { Toaster } from 'react-hot-toast'

// ✅ Créer une instance de QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}> {/* ✅ Ajouté */}
      <BrowserRouter>
        <AuthProvider>
          {/* Toast notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                style: {
                  background: '#10b981',
                  color: '#fff',
                },
              },
              error: {
                duration: 4000,
                style: {
                  background: '#ef4444',
                  color: '#fff',
                },
              },
            }}
          />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes - All require authentication */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Index route - redirect to main dashboard */}
              <Route index element={<Navigate to="/main" replace />} />
              
              {/* Main dashboard */}
              <Route path="main" element={<MainPage />} />
              
              {/* Client Configuration - Super Admin only */}
              <Route path="config-client" element={
                <SuperAdminRoute>
                  <ConfigClient />
                </SuperAdminRoute>
              } />
              
              {/* Business Units - Super Admin only */}
              <Route path="business-units" element={
                <SuperAdminRoute>
                  <BusinessUnitList />
                </SuperAdminRoute>
              } />
              <Route path="business-units/create" element={
                <SuperAdminRoute>
                  <CreateBusinessUnit />
                </SuperAdminRoute>
              } />
              
              {/* Users Management - Super Admin only */}
              <Route path="users" element={
                <SuperAdminRoute>
                  <UsersList />
                </SuperAdminRoute>
              } />
              <Route path="users/create" element={
                <SuperAdminRoute>
                  <CreateUser />
                </SuperAdminRoute>
              } />
              
              {/* Projects Management */}
              <Route path="projects" element={<ProjectsList />} />
              <Route path="projects/create" element={<CreateProject />} />
              <Route path="projects/edit/:id" element={<EditProject />} />
              <Route path="projects/:projectId/documents" element={<ProjectDocumentsPage />} />
              
              {/* Project Teams - Accessible to Super Admin, BU Manager, BU Admin, and PMs */}
              <Route path="project-teams" element={<ProjectTeams />} />
              
              {/* Document Management */}
              <Route path="doc-classification/create" element={<CreateDocClassification />} />
              <Route path="emission-policies/create" element={<CreateEmissionPolicy />} />
              
              {/* Gantt View */}
              <Route path="gantt-view" element={<GanttView />} />
            </Route>
            
            {/* 404 Page - Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider> {/* ✅ Fermeture du provider */}
  </StrictMode>,
);

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <a href="/" className="text-blue-600 hover:text-blue-800 underline">
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}