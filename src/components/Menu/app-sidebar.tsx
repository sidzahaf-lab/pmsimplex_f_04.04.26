// components/Menu/app-sidebar.tsx
import * as React from "react"
import {
  Building,
  FolderKanban,
  Users,
  Users2,  // ✅ Ajouté pour l'icône Project Teams
  FileText,
  Home,
  Bell,
  Search,
  Grid3X3,
  Clock,
  Star,
  HelpCircle,
  Send,
  Settings,
  Shield,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { NavMain } from "@/components/Menu/nav-main"
import { NavStart } from "@/components/Menu/nav-start"
import { NavSecondary } from "@/components/Menu/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import { PMSimplexLogo } from "@/components/ui/PMSimplexLogo"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isSuperAdmin, user } = useAuth()

  // Base navigation for all authenticated users
  const baseNavMain = [
    {
      title: "Project Management",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Portfolio",
          url: "projects",
        },
        {
          title: "Gantt View Level 0",
          url: "gantt-view",
        },
        {
          title: "Project Teams",  // ✅ Modifié: de "Project Team" à "Project Teams"
          url: "project-teams",    // ✅ Modifié: lien vers la nouvelle page
        },
        {
          title: "Contracts",
          url: "#",
        },
        {
          title: "Schedules",
          url: "#",
        },
        {
          title: "Project Monitoring & Control",
          url: "#",
        },
        {
          title: "Warnings & Notifications",
          url: "#",
        },
        {
          title: "Daily Reports",
          url: "#",
        },
        {
          title: "Resource Management",
          url: "#",
        },
        {
          title: "Procurement Management",
          url: "#",
        },
        {
          title: "Materials Management",
          url: "#",
        },
      ],
    },
    {
      title: "Corporate Dashboards",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Progress & KPI",
          url: "#",
        },
        {
          title: "Financials",
          url: "#",
        },
        {
          title: "Reporting & Analytics",
          url: "#",
        },
      ],
    },
  ]

  // Super Admin only navigation
  const superAdminNavMain = [
    {
      title: "Client Organization",
      url: "#",
      icon: Users,
      items: [
        {
          title: "Company",
          url: "config-client",
        },
        {
          title: "Business Units",
          url: "business-units",
        },
        {
          title: "Users",
          url: "users",
        },
      ],
    },
    {
      title: "Document Management",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Classification System",
          url: "doc-classification/create",
        },
        {
          title: "Periodics Procedures",
          url: "emission-policies/create",
        },
        {
          title: "Projects Documents",
          url: "main",
        },
      ],
    },
  ]

  // Combine navigation based on role
  const navMain = isSuperAdmin 
    ? [...superAdminNavMain, ...baseNavMain]
    : baseNavMain

  const navStart = [
    {
      title: "Home",
      url: "/",
      icon: Home,
    },
    {
      title: "Notifications",
      url: "#",
      icon: Bell,
    },
    {
      title: "Search",
      url: "#",
      icon: Search,
    },
    {
      title: "Browse",
      url: "#",
      icon: Grid3X3,
    },
    {
      title: "Recents",
      url: "#",
      icon: Clock,
    },
    {
      title: "Favorites",
      url: "#",
      icon: Star,
    },
  ]

  const navSecondary = [
    {
      title: "Help",
      url: "#",
      icon: HelpCircle,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
    ...(isSuperAdmin
      ? [
          {
            title: "Admin Settings",
            url: "admin",
            icon: Settings,
          },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="group-data-[collapsible=icon]:block hidden">
            <PMSimplexLogo 
              variant="icon" 
              height={32} 
              width={32}
              secondaryColor="#B87333"
              primaryColor="#E8E8EA"
            />
          </div>
          
          <div className="group-data-[collapsible=icon]:hidden flex items-center gap-2">
            <PMSimplexLogo 
              variant="default" 
              width={120} 
              height={32}
              secondaryColor="#B87333"
              primaryColor="#E8E8EA"
              accentColor="#8B9DAF"
            />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavStart items={navStart} />
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto group-data-[collapsible=icon]:hidden" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}