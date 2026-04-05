// dashboard/page.tsx
import { AppSidebar } from "@/components/Menu/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut, User, Shield } from "lucide-react"
import React, { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import PMSimplexLogo from "@/components/ui/PMSimplexLogo"

// Default content component for the home page (Welcome page with PMSimplex logo)
function DefaultContent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-8 text-center">
      <div className="max-w-2xl mx-auto">
        {/* PMSimplex Logo */}
        <div className="flex justify-center mb-6">
          <PMSimplexLogo 
            variant="default" 
            width={400} 
            height={100} 
            className="mb-4"
          />
        </div>
        
        {/* Main Message
        <p className="text-2xl text-gray-900 mb-6 leading-relaxed">
          Streamline your project lifecycle.
        </p> */}

        {/* Main Message */}
<p className="text-4xl text-gray-900 mb-6 leading-relaxed italic font-light">
  Streamline your project lifecycle.
</p>
        
        {/* What's Coming Soon */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            What's Coming Soon
          </h2>
          <p className="text-amber-700">
            PMSimplex will be built and scaled gradually. 
            The next versions will begin by opening basic project management business processes, 
            and we will systematically build up functionality from there. 
            Stay tuned for our official launch!
          </p>
        </div>
        
        {/* Contact/Update Info */}
        <div className="text-gray-500">
          <p>Check back soon for updates, or contact us if you have any questions.</p>
          <p>Connect with us via{' '}
            <a 
              href="https://www.linkedin.com/in/sid-ali-zahaf-29968631/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 underline"
            >
              LinkedIn DM
            </a>
          </p>
          <p className="text-sm mt-2">Version: V.07.01.26</p>
        </div>
      </div>
    </div>
  );
}

// Function to generate breadcrumb data based on current path
function getBreadcrumbData(pathname: string) {
  console.log('🔍 getBreadcrumbData - pathname:', pathname);
  
  const pathSegments = pathname.split('/').filter(segment => segment !== '')
  console.log('🔍 pathSegments:', pathSegments);
  
  if (pathSegments.length === 0) {
    console.log('🔍 No path segments, returning home');
    return {
      items: [
        { label: 'Home', href: '/', isPage: true }
      ]
    }
  }

  const items = []
  
  // Home breadcrumb (always present)
  items.push({ label: 'Home', href: '/', isPage: false })
  
  // Map routes to breadcrumb labels
  const routeLabels: { [key: string]: string } = {
    'main': 'Dashboard',
    'config-client': 'Company Configuration',
    'business-units': 'Business Units',
    'business-units/create': 'Create Business Unit',
    'users': 'Users',
    'users/create': 'Create User',
    'projects': 'Projects',
    'projects/create': 'Create Project',
    'projects/edit': 'Edit Project',
    'doc-classification/create': 'Document Classification',
    'emission-policies/create': 'Create Emission Policy',
  }

  // Build breadcrumb trail
  let currentPath = ''
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i]
    currentPath += `/${segment}`
    
    // Special handling for dynamic routes like edit/:id
    if (segment === 'edit' && pathSegments[i + 1]) {
      items.push({ label: 'Edit', href: currentPath, isPage: false })
      items.push({ label: pathSegments[i + 1], href: `/${pathSegments[i + 1]}`, isPage: true })
      break
    }
    
    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    const isLast = i === pathSegments.length - 1
    items.push({ label, href: currentPath, isPage: isLast })
  }
  
  console.log('🔍 Breadcrumb items:', items);
  return { items }
}

export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isSuperAdmin, logout, loading } = useAuth()
  const breadcrumbData = getBreadcrumbData(location.pathname)

  // Debug logs
  useEffect(() => {
    console.log('========================================');
    console.log('📊 DashboardLayout mounted/updated');
    console.log('📍 Current location:', location.pathname);
    console.log('👤 User object:', user);
    console.log('🔑 isSuperAdmin:', isSuperAdmin);
    console.log('⏳ loading:', loading);
    console.log('========================================');
  }, [location.pathname, user, isSuperAdmin, loading]);

  // Get user initials for avatar
  const getInitials = () => {
    if (!user) {
      console.log('⚠️ No user in getInitials');
      return 'U';
    }
    const initials = `${user.name?.charAt(0) || ''}${user.family_name?.charAt(0) || ''}`.toUpperCase();
    console.log('👤 User initials:', initials);
    return initials;
  }

  const handleLogout = () => {
    console.log('🚪 Logout clicked');
    logout()
    navigate('/login')
  }

  // Show loading state while auth is being checked
  if (loading) {
    console.log('⏳ DashboardLayout loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // If no user, don't render (should be redirected by ProtectedRoute)
  if (!user) {
    console.log('⚠️ No user in DashboardLayout, should be redirected');
    return null;
  }

  console.log('✅ DashboardLayout rendering with user:', user.email);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbData.items.map((item, index) => (
                  <React.Fragment key={index}>
                    <BreadcrumbItem className="hidden md:block">
                      {index < breadcrumbData.items.length - 1 ? (
                        <BreadcrumbLink href={item.href}>
                          {item.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>
                          {item.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbData.items.length - 1 && (
                      <BreadcrumbSeparator className="hidden md:block" />
                    )}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-700">
                    {getInitials()}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{user?.name} {user?.family_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {isSuperAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Show DefaultContent at root path, otherwise show nested routes */}
          {location.pathname === '/' ? <DefaultContent /> : <Outlet />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}