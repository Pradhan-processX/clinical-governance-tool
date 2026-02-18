"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BatchJob } from "@/types";

interface BatchSelectorProps {
  batches: BatchJob[];
  selectedBatchId: string;
  onSelect: (batchId: string) => void;
}

export function BatchSelector({ batches, selectedBatchId, onSelect }: BatchSelectorProps) {
  if (batches.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500">Batch:</span>
      <Select value={selectedBatchId} onValueChange={onSelect}>
        <SelectTrigger className="w-80 h-9 text-sm">
          <SelectValue placeholder="Select batch..." />
        </SelectTrigger>
        <SelectContent>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {new Date(b.batchDate).toLocaleDateString("en-AU")} — {b.fileName} ({b.totalNotes} notes)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
