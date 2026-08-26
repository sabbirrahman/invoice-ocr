"use client";

import { GalleryVerticalEndIcon, FileIcon } from "lucide-react";
import * as React from "react";

import {
  SidebarMenuButton,
  SidebarGroupLabel,
  SidebarMenuItem,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarRail,
  SidebarMenu,
  Sidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

const dummyUser = {
  name: "John Doe",
  email: "john.doe@acme.com",
  avatar: "/avatars/shadcn.jpg",
};
const menuItems = [
  {
    name: "Invoice Intake",
    url: "#",
    icon: <FileIcon />,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem></SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GalleryVerticalEndIcon />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Acme Inc.</span>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    {item.icon}
                    <span>{item.name}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={dummyUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
