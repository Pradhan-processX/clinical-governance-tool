"use client";

import { useState } from "react";
import { FileUpload } from "@/components/batch/file-upload";
import { ProcessingProgress } from "@/components/batch/processing-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileSpreadsheet, Loader2 } from "lucide-react";

interface UploadResult {
  totalNotes: number;
  fileName: string;
  headers: string[];
  preview: string[][];
  warnings: string[];
}

export default function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = (f: File) => {
    setFile(f);
    setUploadResult(null);
    setBatchId(null);
    setStarted(false);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/batch/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleStart = async () => {
    if (!uploadResult || !file) return;
    setProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/batch/start", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      setBatchId(data.batchId);
      setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start processing");
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">Batch Upload</h1>

      {!started && (
        <>
          <FileUpload onFileSelected={handleFileSelected} />

          {file && !uploadResult && (
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-500" />
              <span className="text-sm text-slate-600">{file.name}</span>
              <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
              <Button onClick={handleUpload} disabled={uploading} size="sm" className="ml-auto">
                {uploading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Uploading...</>
                ) : (
                  "Upload & Preview"
                )}
              </Button>
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {uploadResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Preview — {uploadResult.totalNotes} notes detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {uploadResult.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 space-y-1">
                    {uploadResult.warnings.map((w, i) => (
                      <p key={i}><AlertCircle className="inline h-3.5 w-3.5 mr-1" />{w}</p>
                    ))}
                  </div>
                )}

                {/* Preview table */}
                <div className="overflow-x-auto rounded border">
                  <table className="text-xs w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {uploadResult.headers.map((h, i) => (
                          <th key={i} className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uploadResult.preview.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button onClick={handleStart} disabled={processing} className="w-full">
                  {processing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting...</>
                  ) : (
                    `Start Evaluation (${uploadResult.totalNotes} notes)`
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {started && uploadResult && batchId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Processing: {uploadResult.fileName}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessingProgress
              batchId={batchId}
              totalNotes={uploadResult.totalNotes}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
