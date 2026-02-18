"use client";

import { useState, useEffect } from "react";
import { EvaluateForm } from "@/components/evaluate/evaluate-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioWithItems } from "@/types";

export default function EvaluatePage() {
  const [scenarios, setScenarios] = useState<ScenarioWithItems[]>([]);

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setScenarios(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-800 mb-5">Single Note Evaluation</h1>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evaluate a Progress Note</CardTitle>
        </CardHeader>
        <CardContent>
          <EvaluateForm scenarios={scenarios} />
        </CardContent>
      </Card>
    </div>
  );
}
