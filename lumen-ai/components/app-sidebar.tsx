"use client";

import type { ComponentProps, ComponentType } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiHome6Fill, RiSettingsFill, RiUserSmileFill } from "@remixicon/react";
import { Workflow } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navigationItems: Array<{
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: RiHome6Fill,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: RiSettingsFill,
  },
];

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="floating" className="border-white/8" {...props}>
      <SidebarHeader className="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 rounded-2xl text-white hover:bg-white/10 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
            >
              <div className="flex size-9 shrink-0 items-center justify-center">
                <Image
                  src="/logo-light.svg"
                  alt="LumenAI"
                  width={36}
                  height={36}
                />
              </div>
              <div className="flex flex-1 items-center text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-base font-semibold">
                  LumenAI
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarMenu className="gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname === item.href;

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className="h-12 rounded-2xl text-zinc-400 hover:bg-white/8 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
                >
                  <Link href={item.href}>
                    <Icon className="!size-5" />
                    <span className="text-[15px]">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Profile"
              className="h-12 rounded-2xl text-zinc-400 hover:bg-white/8 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
            >
              <RiUserSmileFill className="!size-5 shrink-0" />
              <span className="text-[15px] group-data-[collapsible=icon]:hidden">
                Profile
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
