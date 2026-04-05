import * as React from "react"
import {
  Building,
  FolderKanban,
  Users,
  FileText,
  // LayoutTemplate,
  // PieChart,
  // BarChart3,
  Home,
  Bell,
  Search,
  Grid3X3,
  Clock,
  Star,
  HelpCircle,
  Send,
  // BookOpen
} from "lucide-react"

import { NavMain } from "@/components/Menu/nav-main"
import { NavStart } from "@/components/Menu/nav-start"
import { NavSecondary } from "@/components/Menu/nav-secondary"
import { SidebarOptInForm } from "@/components/Menu/sidebar-opt-in-form"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
        {
      title: "Client",
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
        },      ],
    },
        {
      title: "Contracting Partners",
      url: "#",
      icon: Building,
      items: [
                {
          title: "Companies",
          url: "companies",
        },
        {
          title: "Contracts",
          url: "#",
        },

      ],
    },
        {
      title: "Portfolio Management",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "Projects",
          url: "projects",
        },
        {
          title: "Document Classification",
          url: "doc-classification/create",
        },
        {
          title: "Create Emission Policy",
          url: "emission-policies/create",
        },
        {
          title: "Main Page",
          url: "main",
        },
      ],
    },
  ],
  navStart: [
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
  ],
  navSecondary: [
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
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar 
      collapsible="icon" 
      {...props}  // ✅ Removed defaultOpen={true}
    >
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-sm">
            <FolderKanban className="size-6" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">PmSimplex</span>
            {/* <span className="text-xs">V.14.11.25</span> */}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavStart items={data.navStart} />
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto group-data-[collapsible=icon]:hidden" />
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="p-1">
          <SidebarOptInForm />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}