export interface OfficialPack {
  kind: "databases" | "questions" | "notes";
  label: string;
  fileName: string;
  description: string;
  url: string;
}

export const OFFICIAL_PACK_BASE_URL =
  "https://raw.githubusercontent.com/Mantu01/logixzen/main/docs/desktop/data";

export const OFFICIAL_PACKS: OfficialPack[] = [
  {
    kind: "databases",
    label: "Databases",
    fileName: "sample-databases.sql",
    description: "Schema, tables and seed data needed to run every exercise, as one .sql file.",
    url: `${OFFICIAL_PACK_BASE_URL}/sample-databases.sql`,
  },
  {
    kind: "questions",
    label: "Questions",
    fileName: "sample-questions.json",
    description: "Question bank with descriptions, test cases, hints and solutions.",
    url: `${OFFICIAL_PACK_BASE_URL}/sample-questions.json`,
  },
  {
    kind: "notes",
    label: "Notes",
    fileName: "sample-notes.json",
    description: "Study notes grouped by category.",
    url: `${OFFICIAL_PACK_BASE_URL}/sample-notes.json`,
  },
];

export function isConfigured(pack: OfficialPack): boolean {
  return pack.url.length > 0;
}

export async function fetchOfficialPack(pack: OfficialPack): Promise<string> {
  const response = await fetch(pack.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  return response.text();
}
