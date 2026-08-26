"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  Fragment,
} from "react";

import * as BreadcrumbComponents from "@/components/ui//breadcrumb";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface BreadcrumbItemType {
  label: string;
  link: string;
}
interface BreadcrumbContextType {
  defaultBreadCrumbItems: BreadcrumbItemType[];

  breadCrumbItems: BreadcrumbItemType[];
  setBreadcrumbItems: React.Dispatch<
    React.SetStateAction<BreadcrumbItemType[]>
  >;
}

export const toTitleCase = (text: string): string => {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const generateBreadcrumbItems = (pathname: string): BreadcrumbItemType[] => {
  const segments = decodeURI(pathname).split("/").filter(Boolean);

  return segments.map((segment, index) => ({
    label: toTitleCase(segment.replace(/-/g, " ")),
    link: `/${segments.slice(0, index + 1).join("/")}`,
  }));
};

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(
  undefined,
);
export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [breadCrumbItems, setBreadcrumbItems] = useState<BreadcrumbItemType[]>(
    [],
  );
  const pathname = usePathname();
  const defaultItems = generateBreadcrumbItems(pathname);

  const value = {
    defaultBreadCrumbItems: defaultItems,
    breadCrumbItems: breadCrumbItems.length ? breadCrumbItems : defaultItems,
    setBreadcrumbItems,
  };

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(): BreadcrumbContextType {
  const context = useContext(BreadcrumbContext);

  if (!context) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  }

  return context;
}

export function usePageBreadcrumb({
  label,
  link = "",
  index = 2,
}: {
  label: string;
  link?: string;
  index?: number;
}): void {
  const { defaultBreadCrumbItems, setBreadcrumbItems } = useBreadcrumb();

  useEffect(() => {
    if (label) {
      const items = [...defaultBreadCrumbItems];
      items.splice(index, 1, { label, link });
      setBreadcrumbItems(items);
    }

    return () => setBreadcrumbItems([]);
  }, [label]);
}

export function Breadcrumb() {
  const { breadCrumbItems } = useBreadcrumb();

  return (
    <BreadcrumbComponents.Breadcrumb>
      <BreadcrumbComponents.BreadcrumbList>
        {breadCrumbItems.map((item, index) => (
          <Fragment key={item.label}>
            {index !== 0 && (
              <BreadcrumbComponents.BreadcrumbSeparator className="hidden md:block" />
            )}

            {index !== breadCrumbItems.length - 1 ? (
              <BreadcrumbComponents.BreadcrumbItem className="hidden max-w-60 truncate md:block">
                <BreadcrumbComponents.BreadcrumbLink asChild>
                  <Link href={item.link}>{item.label}</Link>
                </BreadcrumbComponents.BreadcrumbLink>
              </BreadcrumbComponents.BreadcrumbItem>
            ) : (
              <BreadcrumbComponents.BreadcrumbItem>
                <BreadcrumbComponents.BreadcrumbPage className="max-w-60 truncate">
                  {item.label}
                </BreadcrumbComponents.BreadcrumbPage>
              </BreadcrumbComponents.BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbComponents.BreadcrumbList>
    </BreadcrumbComponents.Breadcrumb>
  );
}
