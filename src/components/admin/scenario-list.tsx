"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScenarioWithItems } from "@/types";

interface ScenarioListProps {
  scenarios: ScenarioWithItems[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ScenarioList({ scenarios, selectedId, onSelect, onAdd }: ScenarioListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Scenarios</h2>
        <Button size="sm" onClick={onAdd} className="h-8 text-xs">
          + Add
        </Button>
      </div>
      <div className="space-y-1 overflow-y-auto flex-1">
        {scenarios.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "rounded-md p-3 cursor-pointer border transition-colors",
              selectedId === s.id
                ? "border-blue-200 bg-blue-50"
                : "border-transparent hover:border-slate-200 hover:bg-slate-50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-800 truncate">{s.name}</p>
                <p className="text-xs text-slate-400">{s.code}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {!s.isActive && (
                  <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>
                )}
                <span className="text-xs text-slate-400">{s.checklistItems.length} items</span>
              </div>
            </div>
          </div>
        ))}
        {scenarios.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No scenarios yet</p>
        )}
      </div>
    </div>
  );
}
