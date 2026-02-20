import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  try {
    const pool = await getPool();

    // Create Scenarios table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Scenarios' AND xtype='U')
      CREATE TABLE Scenarios (
        Id NVARCHAR(50) PRIMARY KEY,
        Code NVARCHAR(50) NOT NULL UNIQUE,
        Name NVARCHAR(200) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Description NVARCHAR(MAX),
        ClassificationHints NVARCHAR(MAX),
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
      )
    `);

    // Create ChecklistItems table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChecklistItems' AND xtype='U')
      CREATE TABLE ChecklistItems (
        Id NVARCHAR(50) PRIMARY KEY,
        ScenarioId NVARCHAR(50) NOT NULL REFERENCES Scenarios(Id) ON DELETE CASCADE,
        ItemCode NVARCHAR(50) NOT NULL,
        ItemText NVARCHAR(500) NOT NULL,
        Mandatory BIT DEFAULT 1,
        SortOrder INT NOT NULL,
        Keywords NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_Scenario_ItemCode UNIQUE (ScenarioId, ItemCode)
      )
    `);

    // Create BatchJobs table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BatchJobs' AND xtype='U')
      CREATE TABLE BatchJobs (
        Id NVARCHAR(50) PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL,
        BatchDate DATE NOT NULL,
        TotalNotes INT NOT NULL,
        ProcessedNotes INT DEFAULT 0,
        FailedNotes INT DEFAULT 0,
        SkippedNotes INT DEFAULT 0,
        Status NVARCHAR(20) DEFAULT 'pending',
        ErrorMessage NVARCHAR(MAX),
        StartedAt DATETIME2,
        CompletedAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETDATE()
      )
    `);

    // Create Evaluations table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Evaluations' AND xtype='U')
      CREATE TABLE Evaluations (
        Id NVARCHAR(50) PRIMARY KEY,
        BatchId NVARCHAR(50) REFERENCES BatchJobs(Id) ON DELETE CASCADE,
        BatchDate DATE NOT NULL,
        RoomNumber NVARCHAR(20),
        ResidentName NVARCHAR(100),
        NoteDate NVARCHAR(50),
        NoteTime NVARCHAR(10),
        EventType NVARCHAR(50),
        ProgressNoteText NVARCHAR(MAX) NOT NULL,
        SourceRowIndex INT,
        ClassifiedScenarioCode NVARCHAR(50),
        Confidence FLOAT,
        EvaluationStatus NVARCHAR(20),
        TotalItems INT,
        DocumentedItems INT,
        MissingMandatoryCount INT,
        GapsSummary NVARCHAR(MAX),
        AiResponseRaw NVARCHAR(MAX),
        ModelUsed NVARCHAR(50),
        PromptTokens INT,
        CompletionTokens INT,
        LatencyMs INT,
        CreatedByName NVARCHAR(100),
        PromptSent NVARCHAR(MAX),
        SystemPromptSent NVARCHAR(MAX),
        EvaluatedAt DATETIME2 DEFAULT GETDATE()
      )
    `);

    // Create ItemResults table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItemResults' AND xtype='U')
      CREATE TABLE ItemResults (
        Id NVARCHAR(50) PRIMARY KEY,
        EvaluationId NVARCHAR(50) NOT NULL REFERENCES Evaluations(Id) ON DELETE CASCADE,
        ItemCode NVARCHAR(50) NOT NULL,
        ItemText NVARCHAR(500) NOT NULL,
        Mandatory BIT NOT NULL,
        IsDocumented BIT NOT NULL,
        Evidence NVARCHAR(MAX) DEFAULT '',
        Gap NVARCHAR(MAX) DEFAULT ''
      )
    `);

    // Migrate existing tables — safe to re-run
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'LatencyMs')
        ALTER TABLE Evaluations ADD LatencyMs INT;
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'CreatedByName')
        ALTER TABLE Evaluations ADD CreatedByName NVARCHAR(100);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'PromptSent')
        ALTER TABLE Evaluations ADD PromptSent NVARCHAR(MAX);
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Evaluations') AND name = 'SystemPromptSent')
        ALTER TABLE Evaluations ADD SystemPromptSent NVARCHAR(MAX);
    `);

    // Create indexes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_BatchDate')
        CREATE INDEX IX_Evaluations_BatchDate ON Evaluations(BatchDate);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_BatchId')
        CREATE INDEX IX_Evaluations_BatchId ON Evaluations(BatchId);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_Status')
        CREATE INDEX IX_Evaluations_Status ON Evaluations(EvaluationStatus);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ItemResults_EvaluationId')
        CREATE INDEX IX_ItemResults_EvaluationId ON ItemResults(EvaluationId);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ChecklistItems_ScenarioId')
        CREATE INDEX IX_ChecklistItems_ScenarioId ON ChecklistItems(ScenarioId);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_EvaluatedAt')
        CREATE INDEX IX_Evaluations_EvaluatedAt ON Evaluations(EvaluatedAt DESC);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_ResidentName')
        CREATE INDEX IX_Evaluations_ResidentName ON Evaluations(ResidentName);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_RoomNumber')
        CREATE INDEX IX_Evaluations_RoomNumber ON Evaluations(RoomNumber);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Evaluations_Status_BatchDate')
        CREATE INDEX IX_Evaluations_Status_BatchDate ON Evaluations(EvaluationStatus, BatchDate DESC);
    `);

    // Seed data
    await seedDatabase();

    return NextResponse.json({
      success: true,
      message: "Database setup complete. Tables created and seed data inserted.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
