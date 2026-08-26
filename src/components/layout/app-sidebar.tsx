"use client";

import { FileIcon, GalleryVerticalEndIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const dummyUser = {
  name: "John Doe",
  email: "john.doe@acme.com",
  avatar: "/avatars/shadcn.jpg",
};

const menuItems = [
  {
    name: "Invoice Intake",
    url: "/dashboard",
    icon: <FileIcon />,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          asChild
        >
          <Link href="/dashboard">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GalleryVerticalEndIcon />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Sample Trading</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={pathname === item.url}>
                  <Link href={item.url}>
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
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
