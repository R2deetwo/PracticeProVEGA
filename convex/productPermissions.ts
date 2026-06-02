export type ProductType = "legal" | "property" | "unified";

export interface ModulePermission {
  id: string;
  name: string;
  product: ProductType;
}

export const MODULES: ModulePermission[] = [
  // Legal Modules
  { id: "cases", name: "Case Management", product: "legal" },
  { id: "billing", name: "Billing", product: "legal" },
  { id: "research", name: "Legal Research", product: "legal" },
  { id: "documents", name: "Documents", product: "legal" },
  
  // Property Modules
  { id: "properties", name: "Property Portfolio", product: "property" },
  { id: "rent", name: "Rent Tracker", product: "property" },
  { id: "maintenance", name: "Maintenance", product: "property" },
  { id: "tenants", name: "Tenants", product: "property" },
  
  // Unified / Shared Modules
  { id: "contacts", name: "Contacts", product: "unified" },
  { id: "tasks", name: "Tasks", product: "unified" },
  { id: "reports", name: "Reports", product: "unified" },
];

export function getAllowedModules(product: ProductType | undefined): ModulePermission[] {
  const currentProduct = product || "unified";
  return MODULES.filter(m => 
    m.product === "unified" || 
    currentProduct === "unified" || 
    m.product === currentProduct
  );
}
