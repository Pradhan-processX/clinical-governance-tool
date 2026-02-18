import { NextRequest, NextResponse } from "next/server";
import { processBatch } from "@/lib/batch-processor";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Start processing asynchronously (don't await)
    processBatch(params.id).catch((err) => {
      console.error(`Batch ${params.id} processing failed:`, err);
    });

    return NextResponse.json({ success: true, batchId: params.id, message: "Processing started" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
