"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/batch", label: "Batch Upload" },
  { href: "/evaluate", label: "Evaluate" },
  { href: "/history", label: "History" },
  { href: "/ai-trace", label: "AI Trace" },
  { href: "/api/docs", label: "API Docs" },
  { href: "/admin/scenarios", label: "Scenarios" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-sm text-slate-800">
              Clinical Governance Evaluator
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname === link.href
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
