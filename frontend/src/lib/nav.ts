export type DataTab = "jobs" | "invoices" | "quotes" | "messages" | "customers";
export type View = "home" | "chat" | "summaries" | "settings" | DataTab;

const DATA_TABS: DataTab[] = ["jobs", "invoices", "quotes", "messages", "customers"];

/** Derive the active view id from a URL pathname. */
export function viewFromPath(pathname: string): View {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (seg === "") return "home";
  if (seg === "chat" || seg === "settings" || seg === "summaries") return seg;
  if (DATA_TABS.includes(seg as DataTab)) return seg as View;
  return "home";
}

/** Map a view id to its route path. */
export const pathForView = (v: View): string => (v === "home" ? "/" : `/${v}`);
