import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers for public pages. Admin pages use next/link directly.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
