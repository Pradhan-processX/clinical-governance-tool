"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ChecklistEditor } from "./checklist-editor";
import { Loader2, Trash2 } from "lucide-react";
import type { ScenarioWithItems } from "@/types";

interface ScenarioEditorProps {
  scenario: ScenarioWithItems;
  onSaved: () => void;
  onDeleted: () => void;
}

export function ScenarioEditor({ scenario, onSaved, onDeleted }: ScenarioEditorProps) {
  const [name, setName] = useState(scenario.name);
  const [category, setCategory] = useState(scenario.category);
  const [description, setDescription] = useState(scenario.description ?? "");
  const [hints, setHints] = useState(scenario.classificationHints ?? "");
  const [isActive, setIsActive] = useState(scenario.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(scenario.name);
    setCategory(scenario.category);
    setDescription(scenario.description ?? "");
    setHints(scenario.classificationHints ?? "");
    setIsActive(scenario.isActive);
    setConfirmDelete(false);
  }, [scenario.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/scenarios/${scenario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, description, classificationHints: hints, isActive }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/scenarios/${scenario.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">Code</label>
        <Input value={scenario.code} disabled className="h-8 text-sm bg-slate-50" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm min-h-[60px]"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">
          Classification Hints (keywords for AI)
        </label>
        <Textarea
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          className="text-sm min-h-[60px]"
          placeholder="e.g. fall, found on floor, witnessed, head strike..."
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <label className="text-sm text-slate-600">Active</label>
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</> : "Save Changes"}
        </Button>
        <Button
          onClick={handleDelete}
          disabled={deleting}
          variant={confirmDelete ? "destructive" : "ghost"}
          size="sm"
          className="text-red-500 hover:text-red-600"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <><Trash2 className="h-3.5 w-3.5 mr-1" />{confirmDelete ? "Confirm Delete" : "Delete"}</>
          )}
        </Button>
      </div>

      <Separator />

      <ChecklistEditor
        scenarioId={scenario.id}
        items={scenario.checklistItems}
        onChanged={onSaved}
      />
    </div>
  );
}
