"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ChecklistItem } from "@/types";

interface ChecklistEditorProps {
  scenarioId: string;
  items: ChecklistItem[];
  onChanged: () => void;
}

export function ChecklistEditor({ scenarioId, items, onChanged }: ChecklistEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMandatory, setNewMandatory] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleAddItem = async () => {
    if (!newText.trim() || !newCode.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/scenarios/${scenarioId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: uuidv4(),
          itemCode: newCode.trim().toUpperCase(),
          itemText: newText.trim(),
          mandatory: newMandatory,
          sortOrder: (items[items.length - 1]?.sortOrder ?? 0) + 1,
        }),
      });
      setNewText("");
      setNewCode("");
      setNewMandatory(true);
      setAdding(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    await fetch(`/api/scenarios/${scenarioId}/items/${itemId}`, { method: "DELETE" });
    onChanged();
  };

  const handleToggleMandatory = async (item: ChecklistItem) => {
    await fetch(`/api/scenarios/${scenarioId}/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandatory: !item.mandatory }),
    });
    onChanged();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Checklist Items ({items.length})
        </p>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />Add Item
        </Button>
      </div>

      <div className="space-y-1 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 p-2 rounded border border-slate-100 text-sm hover:bg-slate-50 group">
            <span className="font-mono text-xs text-slate-400 w-40 shrink-0 truncate">{item.itemCode}</span>
            <span className="flex-1 text-slate-700">{item.itemText}</span>
            <button
              onClick={() => handleToggleMandatory(item)}
              className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                item.mandatory
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {item.mandatory ? "Mandatory" : "Optional"}
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">No checklist items yet</p>
        )}
      </div>

      {adding && (
        <div className="border rounded-md p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-medium text-slate-600">New Item</p>
          <Input
            placeholder="Item code (e.g. UWF_13_EXAMPLE)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            className="h-8 text-xs font-mono"
          />
          <Input
            placeholder="Item description"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newMandatory}
              onChange={(e) => setNewMandatory(e.target.checked)}
              id="mandatory-check"
            />
            <label htmlFor="mandatory-check" className="text-sm text-slate-600">Mandatory</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddItem} disabled={saving} className="h-7 text-xs">
              {saving ? "Saving..." : "Add"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
