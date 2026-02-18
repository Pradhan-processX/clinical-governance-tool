"use client";

import { useState, useEffect, useCallback } from "react";
import { ScenarioList } from "@/components/admin/scenario-list";
import { ScenarioEditor } from "@/components/admin/scenario-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ScenarioWithItems } from "@/types";

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioWithItems[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const loadScenarios = useCallback(async () => {
    const res = await fetch("/api/scenarios");
    const data = await res.json();
    if (Array.isArray(data)) setScenarios(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const selected = scenarios.find((s) => s.id === selectedId) ?? null;

  const handleAdd = () => setAddingNew(true);

  const handleCreateNew = async () => {
    if (!newName.trim() || !newCode.trim() || !newCategory.trim()) return;
    setSaving(true);
    const id = newCode.trim().toUpperCase().replace(/\s+/g, "_");
    await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        code: id,
        name: newName.trim(),
        category: newCategory.trim().toUpperCase(),
        isActive: true,
        sortOrder: scenarios.length + 1,
      }),
    });
    setNewName("");
    setNewCode("");
    setNewCategory("");
    setAddingNew(false);
    setSaving(false);
    await loadScenarios();
    setSelectedId(id);
  };

  const handleSaved = async () => {
    await loadScenarios();
  };

  const handleDeleted = async () => {
    setSelectedId(null);
    await loadScenarios();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Scenario Administration</h1>

      <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)]">
        {/* Left panel */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 h-full">
            <ScenarioList
              scenarios={scenarios}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={handleAdd}
            />
          </CardContent>
        </Card>

        {/* Right panel */}
        <Card className="overflow-y-auto">
          <CardContent className="p-5">
            {addingNew ? (
              <div className="space-y-3 max-w-md">
                <h2 className="font-semibold text-slate-800">New Scenario</h2>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Name</label>
                  <Input
                    placeholder="e.g. Witnessed Fall - No Head Strike"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Code (unique ID)</label>
                  <Input
                    placeholder="e.g. FALL_WITNESSED_NO_HEADSTRIKE"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
                  <Input
                    placeholder="e.g. FALL, MEDICATION, BEHAVIOUR"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateNew} disabled={saving} size="sm">
                    {saving ? "Creating..." : "Create Scenario"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAddingNew(false)}>Cancel</Button>
                </div>
              </div>
            ) : selected ? (
              <ScenarioEditor
                scenario={selected}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-24">
                <p className="text-sm">Select a scenario to edit it</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
