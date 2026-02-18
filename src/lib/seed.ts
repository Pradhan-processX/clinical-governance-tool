import { getPool, sql } from "./db";

interface ScenarioSeed {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  classificationHints: string;
  sortOrder: number;
  items: {
    id: string;
    itemCode: string;
    itemText: string;
    mandatory: boolean;
    sortOrder: number;
  }[];
}

const SEED_SCENARIOS: ScenarioSeed[] = [
  {
    id: "FALL_WITNESSED_NO_HEADSTRIKE",
    code: "FALL_WITNESSED_NO_HEADSTRIKE",
    name: "Witnessed Fall - No Head Strike",
    category: "FALL",
    description: "Resident witnessed falling without head strike or suspected head injury.",
    classificationHints:
      "fall, fell, found on floor, witnessed, observed falling, no head strike, no head injury, no loss of consciousness",
    sortOrder: 1,
    items: [
      { id: "WF_01", itemCode: "WF_01_TIME", itemText: "Date and time of fall documented", mandatory: true, sortOrder: 1 },
      { id: "WF_02", itemCode: "WF_02_WITNESS", itemText: "Who witnessed the fall", mandatory: true, sortOrder: 2 },
      { id: "WF_03", itemCode: "WF_03_LOCATION", itemText: "Location of fall documented", mandatory: true, sortOrder: 3 },
      { id: "WF_04", itemCode: "WF_04_ACTIVITY", itemText: "What resident was doing at time of fall", mandatory: true, sortOrder: 4 },
      { id: "WF_05", itemCode: "WF_05_INJURIES", itemText: "Injuries assessed and documented", mandatory: true, sortOrder: 5 },
      { id: "WF_06", itemCode: "WF_06_VITALS", itemText: "Post-fall vitals taken (BP, HR, O2)", mandatory: true, sortOrder: 6 },
      { id: "WF_07", itemCode: "WF_07_PAIN", itemText: "Pain assessment completed", mandatory: true, sortOrder: 7 },
      { id: "WF_08", itemCode: "WF_08_NOTIFY_GP", itemText: "GP or doctor notified", mandatory: true, sortOrder: 8 },
      { id: "WF_09", itemCode: "WF_09_NOTIFY_NOK", itemText: "Family or next of kin notified", mandatory: false, sortOrder: 9 },
      { id: "WF_10", itemCode: "WF_10_INCIDENT_REPORT", itemText: "Incident report completed", mandatory: false, sortOrder: 10 },
      { id: "WF_11", itemCode: "WF_11_FALLS_RISK", itemText: "Falls risk reassessment completed", mandatory: true, sortOrder: 11 },
      { id: "WF_12", itemCode: "WF_12_CARE_PLAN", itemText: "Care plan updated", mandatory: false, sortOrder: 12 },
    ],
  },
  {
    id: "FALL_WITNESSED_HEADSTRIKE",
    code: "FALL_WITNESSED_HEADSTRIKE",
    name: "Witnessed Fall - With Head Strike",
    category: "FALL",
    description: "Resident witnessed falling with head strike, suspected head injury, or loss of consciousness.",
    classificationHints:
      "fall, fell, witnessed, head strike, hit head, head injury, loss of consciousness, LOC, neuro obs, neurological observations",
    sortOrder: 2,
    items: [
      { id: "WFH_01", itemCode: "WFH_01_TIME", itemText: "Date and time of fall documented", mandatory: true, sortOrder: 1 },
      { id: "WFH_02", itemCode: "WFH_02_WITNESS", itemText: "Who witnessed the fall", mandatory: true, sortOrder: 2 },
      { id: "WFH_03", itemCode: "WFH_03_LOCATION", itemText: "Location of fall documented", mandatory: true, sortOrder: 3 },
      { id: "WFH_04", itemCode: "WFH_04_NEURO_OBS", itemText: "Neurological observations commenced", mandatory: true, sortOrder: 4 },
      { id: "WFH_05", itemCode: "WFH_05_INJURIES", itemText: "Injuries assessed and documented", mandatory: true, sortOrder: 5 },
      { id: "WFH_06", itemCode: "WFH_06_VITALS", itemText: "Post-fall vitals taken", mandatory: true, sortOrder: 6 },
      { id: "WFH_07", itemCode: "WFH_07_NOTIFY_GP", itemText: "GP or doctor notified immediately", mandatory: true, sortOrder: 7 },
      { id: "WFH_08", itemCode: "WFH_08_INCIDENT_REPORT", itemText: "Incident report completed", mandatory: true, sortOrder: 8 },
    ],
  },
  {
    id: "FALL_UNWITNESSED",
    code: "FALL_UNWITNESSED",
    name: "Unwitnessed Fall",
    category: "FALL",
    description: "Resident found on the floor with no witness to the fall event.",
    classificationHints:
      "found on floor, unwitnessed, discovered on floor, found lying, found fallen, no witness to fall",
    sortOrder: 3,
    items: [
      { id: "UWF_01", itemCode: "UWF_01_INCIDENT_REPORT", itemText: "Incident report completed", mandatory: true, sortOrder: 1 },
      { id: "UWF_02", itemCode: "UWF_02_POST_FALL_ASSESSMENT", itemText: "Post-fall assessment completed (head-to-toe, ROM, pain, skin)", mandatory: true, sortOrder: 2 },
      { id: "UWF_03", itemCode: "UWF_03_TIME_FOUND", itemText: "Time resident was found documented", mandatory: true, sortOrder: 3 },
      { id: "UWF_04", itemCode: "UWF_04_WHO_FOUND", itemText: "Who found the resident documented", mandatory: true, sortOrder: 4 },
      { id: "UWF_05", itemCode: "UWF_05_POSITION_FOUND", itemText: "Position resident was found in documented", mandatory: true, sortOrder: 5 },
      { id: "UWF_06", itemCode: "UWF_06_LOCATION", itemText: "Location where resident was found", mandatory: true, sortOrder: 6 },
      { id: "UWF_07", itemCode: "UWF_07_VITALS", itemText: "Post-fall vitals taken (BP, HR, O2)", mandatory: true, sortOrder: 7 },
      { id: "UWF_08", itemCode: "UWF_08_PAIN", itemText: "Pain assessment completed", mandatory: true, sortOrder: 8 },
      { id: "UWF_09", itemCode: "UWF_09_INJURIES", itemText: "Injuries assessed and documented", mandatory: true, sortOrder: 9 },
      { id: "UWF_10", itemCode: "UWF_10_NOTIFY_GP", itemText: "GP or doctor notified", mandatory: true, sortOrder: 10 },
      { id: "UWF_11", itemCode: "UWF_11_NEURO_OBS", itemText: "Neurological observations commenced as precaution", mandatory: true, sortOrder: 11 },
      { id: "UWF_12", itemCode: "UWF_12_FALLS_RISK", itemText: "Falls risk reassessment completed", mandatory: true, sortOrder: 12 },
    ],
  },
];

export async function seedDatabase(): Promise<void> {
  const pool = await getPool();

  for (const scenario of SEED_SCENARIOS) {
    // Check if scenario already exists
    const existing = await pool.request()
      .input("id", sql.NVarChar, scenario.id)
      .query("SELECT Id FROM Scenarios WHERE Id = @id");

    if (existing.recordset.length > 0) {
      console.log(`Scenario ${scenario.code} already exists, skipping.`);
      continue;
    }

    // Insert scenario
    const sr = pool.request();
    sr.input("id", sql.NVarChar, scenario.id);
    sr.input("code", sql.NVarChar, scenario.code);
    sr.input("name", sql.NVarChar, scenario.name);
    sr.input("category", sql.NVarChar, scenario.category);
    sr.input("description", sql.NVarChar, scenario.description);
    sr.input("classificationHints", sql.NVarChar, scenario.classificationHints);
    sr.input("sortOrder", sql.Int, scenario.sortOrder);

    await sr.query(`
      INSERT INTO Scenarios (Id, Code, Name, Category, Description, ClassificationHints, IsActive, SortOrder)
      VALUES (@id, @code, @name, @category, @description, @classificationHints, 1, @sortOrder)
    `);

    // Insert checklist items
    for (const item of scenario.items) {
      const ir = pool.request();
      ir.input("id", sql.NVarChar, item.id);
      ir.input("scenarioId", sql.NVarChar, scenario.id);
      ir.input("itemCode", sql.NVarChar, item.itemCode);
      ir.input("itemText", sql.NVarChar, item.itemText);
      ir.input("mandatory", sql.Bit, item.mandatory ? 1 : 0);
      ir.input("sortOrder", sql.Int, item.sortOrder);

      await ir.query(`
        INSERT INTO ChecklistItems (Id, ScenarioId, ItemCode, ItemText, Mandatory, SortOrder)
        VALUES (@id, @scenarioId, @itemCode, @itemText, @mandatory, @sortOrder)
      `);
    }

    console.log(`Seeded scenario: ${scenario.code}`);
  }
}
