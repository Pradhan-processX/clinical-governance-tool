import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Clinical Governance Tool API",
      version: "1.0.0",
      description: "API docs for batch upload, evaluation, dashboard, and scenario management.",
    },
    servers: [{ url: origin }],
    tags: [
      { name: "Setup" },
      { name: "Evaluate" },
      { name: "Evaluations" },
      { name: "Dashboard" },
      { name: "Batch" },
      { name: "Scenarios" },
    ],
    paths: {
      "/api/setup": {
        post: {
          tags: ["Setup"],
          summary: "Initialize database schema and seed data",
          responses: {
            "200": { description: "Setup completed" },
            "500": { description: "Setup failed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          },
        },
      },
      "/api/evaluate": {
        post: {
          tags: ["Evaluate"],
          summary: "Evaluate a single progress note with AI",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleEvaluateRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Evaluation result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SingleEvaluateResponse" },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/api/evaluations": {
        get: {
          tags: ["Evaluations"],
          summary: "List evaluations with pagination and filters",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "pageSize", schema: { type: "integer", default: 50, maximum: 100 } },
            { in: "query", name: "batchId", schema: { type: "string" } },
            { in: "query", name: "batchDate", schema: { type: "string", format: "date" } },
            { in: "query", name: "status", schema: { type: "string" } },
            { in: "query", name: "scenario", schema: { type: "string" } },
            { in: "query", name: "search", schema: { type: "string" } },
            { in: "query", name: "dateFrom", schema: { type: "string", format: "date" } },
            { in: "query", name: "dateTo", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": {
              description: "Evaluations page",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EvaluationsListResponse" },
                },
              },
            },
            "500": {
              description: "Server error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/api/evaluations/summary": {
        get: {
          tags: ["Evaluations"],
          summary: "Get compliance summary for a batch/date",
          parameters: [
            { in: "query", name: "batchId", schema: { type: "string" } },
            { in: "query", name: "batchDate", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": {
              description: "Summary stats",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SummaryResponse" },
                },
              },
            },
          },
        },
      },
      "/api/evaluations/{id}": {
        get: {
          tags: ["Evaluations"],
          summary: "Get evaluation detail by id (includes aiResponseRaw)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Evaluation detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EvaluationDetailResponse" },
                },
              },
            },
            "404": { description: "Evaluation not found" },
          },
        },
      },
      "/api/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Get batches, active batch evaluations, and summary",
          parameters: [{ in: "query", name: "batchId", schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Dashboard payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DashboardResponse" },
                },
              },
            },
          },
        },
      },
      "/api/batch/list": {
        get: {
          tags: ["Batch"],
          summary: "List completed batch jobs",
          responses: {
            "200": {
              description: "Completed batches",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/BatchJob" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/batch/upload": {
        post: {
          tags: ["Batch"],
          summary: "Upload progress notes Excel file",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Batch created" },
            "400": { description: "Validation or parsing error" },
            "500": { description: "Upload failed" },
          },
        },
      },
      "/api/batch/{id}/start": {
        post: {
          tags: ["Batch"],
          summary: "Start asynchronous batch processing",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Processing started" },
            "500": { description: "Failed to start" },
          },
        },
      },
      "/api/batch/{id}/status": {
        get: {
          tags: ["Batch"],
          summary: "Get batch processing status and live counts",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Batch status", content: { "application/json": { schema: { $ref: "#/components/schemas/BatchStatusResponse" } } } },
            "404": { description: "Batch not found" },
          },
        },
      },
      "/api/batch/{id}/download": {
        get: {
          tags: ["Batch"],
          summary: "Download enriched results Excel for a batch",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Excel file",
              content: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "404": { description: "Batch/file not found" },
          },
        },
      },
      "/api/scenarios": {
        get: {
          tags: ["Scenarios"],
          summary: "List all scenarios and checklist items",
          responses: {
            "200": {
              description: "Scenario list",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Scenario" } },
                },
              },
            },
          },
        },
        post: {
          tags: ["Scenarios"],
          summary: "Create a scenario",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateScenarioRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Created" },
            "400": { description: "Bad request" },
          },
        },
      },
      "/api/scenarios/{id}": {
        put: {
          tags: ["Scenarios"],
          summary: "Update scenario",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateScenarioRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Bad request" },
          },
        },
        delete: {
          tags: ["Scenarios"],
          summary: "Delete scenario",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted" },
            "500": { description: "Server error" },
          },
        },
      },
      "/api/scenarios/{id}/items": {
        post: {
          tags: ["Scenarios"],
          summary: "Create checklist item for scenario",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateChecklistItemRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Created" },
            "400": { description: "Bad request" },
          },
        },
      },
      "/api/scenarios/{id}/items/{itemId}": {
        put: {
          tags: ["Scenarios"],
          summary: "Update checklist item",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "itemId", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateChecklistItemRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Bad request" },
          },
        },
        delete: {
          tags: ["Scenarios"],
          summary: "Delete checklist item",
          parameters: [
            { in: "path", name: "id", required: true, schema: { type: "string" } },
            { in: "path", name: "itemId", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Deleted" },
            "500": { description: "Server error" },
          },
        },
      },
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        ItemResult: {
          type: "object",
          properties: {
            id: { type: "string" },
            evaluationId: { type: "string" },
            itemCode: { type: "string" },
            itemText: { type: "string" },
            mandatory: { type: "boolean" },
            isDocumented: { type: "boolean" },
            evidence: { type: "string" },
            gap: { type: "string" },
          },
        },
        Evaluation: {
          type: "object",
          properties: {
            id: { type: "string" },
            batchId: { type: "string", nullable: true },
            batchDate: { type: "string" },
            roomNumber: { type: "string", nullable: true },
            residentName: { type: "string", nullable: true },
            noteDate: { type: "string", nullable: true },
            noteTime: { type: "string", nullable: true },
            eventType: { type: "string", nullable: true },
            createdByName: { type: "string", nullable: true },
            clinicalRiskCategory: { type: "string", nullable: true },
            classifiedScenarioCode: { type: "string", nullable: true },
            confidence: { type: "number", nullable: true },
            evaluationStatus: { type: "string", nullable: true },
            totalItems: { type: "integer", nullable: true },
            documentedItems: { type: "integer", nullable: true },
            missingMandatoryCount: { type: "integer", nullable: true },
            gapsSummary: { type: "string", nullable: true },
            modelUsed: { type: "string", nullable: true },
            promptTokens: { type: "integer", nullable: true },
            completionTokens: { type: "integer", nullable: true },
            latencyMs: { type: "integer", nullable: true },
            evaluatedAt: { type: "string", nullable: true },
          },
        },
        EvaluationDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/Evaluation" },
            {
              type: "object",
              properties: {
                progressNoteText: { type: "string" },
                aiResponseRaw: { type: "string", nullable: true, description: "Raw AI JSON response string." },
                promptSent: { type: "string", nullable: true },
                systemPromptSent: { type: "string", nullable: true, description: "Full system prompt passed to AI." },
                itemResults: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ItemResult" },
                },
              },
            },
          ],
        },
        SummaryResponse: {
          type: "object",
          properties: {
            total: { type: "integer" },
            compliant: { type: "integer" },
            partial: { type: "integer" },
            nonCompliant: { type: "integer" },
            notApplicable: { type: "integer" },
            compliantPct: { type: "integer" },
            partialPct: { type: "integer" },
            nonCompliantPct: { type: "integer" },
          },
        },
        BatchJob: {
          type: "object",
          properties: {
            id: { type: "string" },
            fileName: { type: "string" },
            batchDate: { type: "string" },
            totalNotes: { type: "integer" },
            processedNotes: { type: "integer" },
            failedNotes: { type: "integer" },
            skippedNotes: { type: "integer" },
            status: { type: "string" },
            createdAt: { type: "string" },
          },
        },
        BatchStatusResponse: {
          allOf: [
            { $ref: "#/components/schemas/BatchJob" },
            {
              type: "object",
              properties: {
                errorMessage: { type: "string", nullable: true },
                startedAt: { type: "string", nullable: true },
                completedAt: { type: "string", nullable: true },
                liveCounts: {
                  type: "object",
                  properties: {
                    compliant: { type: "integer" },
                    partial: { type: "integer" },
                    nonCompliant: { type: "integer" },
                    notApplicable: { type: "integer" },
                  },
                },
              },
            },
          ],
        },
        ScenarioItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            scenarioId: { type: "string" },
            itemCode: { type: "string" },
            itemText: { type: "string" },
            mandatory: { type: "boolean" },
            sortOrder: { type: "integer" },
            keywords: { type: "string", nullable: true },
            createdAt: { type: "string" },
          },
        },
        Scenario: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            description: { type: "string", nullable: true },
            classificationHints: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            sortOrder: { type: "integer" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
            checklistItems: {
              type: "array",
              items: { $ref: "#/components/schemas/ScenarioItem" },
            },
          },
        },
        DashboardResponse: {
          type: "object",
          properties: {
            batches: {
              type: "array",
              items: { $ref: "#/components/schemas/BatchJob" },
            },
            evaluations: {
              type: "array",
              items: { $ref: "#/components/schemas/Evaluation" },
            },
            summary: { $ref: "#/components/schemas/SummaryResponse" },
            activeBatchId: { type: "string", nullable: true },
          },
        },
        EvaluationsListResponse: {
          type: "object",
          properties: {
            evaluations: {
              type: "array",
              items: { $ref: "#/components/schemas/Evaluation" },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            totalTokens: { type: "integer" },
          },
        },
        SingleEvaluateRequest: {
          type: "object",
          required: ["noteText"],
          properties: {
            noteText: { type: "string" },
            residentName: { type: "string", nullable: true },
            eventType: { type: "string", nullable: true },
            createdByName: { type: "string", nullable: true },
            forcedScenarioCode: { type: "string", nullable: true },
          },
        },
        SingleEvaluateResponse: {
          type: "object",
          properties: {
            evaluationId: { type: "string" },
            scenarioCode: { type: "string" },
            scenarioName: { type: "string" },
            confidence: { type: "number" },
            evaluationStatus: { type: "string" },
            totalItems: { type: "integer" },
            documentedItems: { type: "integer" },
            missingMandatoryCount: { type: "integer" },
            gapsSummary: { type: "string" },
            aiResponseRaw: { type: "string" },
            modelUsed: { type: "string" },
            promptTokens: { type: "integer" },
            completionTokens: { type: "integer" },
            latencyMs: { type: "integer" },
            promptSent: { type: "string" },
            systemPromptSent: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  itemCode: { type: "string" },
                  itemText: { type: "string" },
                  mandatory: { type: "boolean" },
                  isDocumented: { type: "boolean" },
                  evidence: { type: "string" },
                  gap: { type: "string" },
                },
              },
            },
          },
        },
        CreateScenarioRequest: {
          type: "object",
          required: ["id", "code", "name", "category", "isActive", "sortOrder"],
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            description: { type: "string", nullable: true },
            classificationHints: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            sortOrder: { type: "integer" },
          },
        },
        UpdateScenarioRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            description: { type: "string", nullable: true },
            classificationHints: { type: "string", nullable: true },
            isActive: { type: "boolean" },
            sortOrder: { type: "integer" },
          },
        },
        CreateChecklistItemRequest: {
          type: "object",
          required: ["id", "itemCode", "itemText", "mandatory", "sortOrder"],
          properties: {
            id: { type: "string" },
            itemCode: { type: "string" },
            itemText: { type: "string" },
            mandatory: { type: "boolean" },
            sortOrder: { type: "integer" },
            keywords: { type: "string", nullable: true },
          },
        },
        UpdateChecklistItemRequest: {
          type: "object",
          properties: {
            itemText: { type: "string" },
            mandatory: { type: "boolean" },
            sortOrder: { type: "integer" },
            keywords: { type: "string", nullable: true },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
