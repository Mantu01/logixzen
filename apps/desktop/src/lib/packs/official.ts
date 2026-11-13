export interface OfficialPack {
  kind: "databases" | "questions" | "notes";
  label: string;
  fileName: string;
  description: string;
  url: string;
}

export const OFFICIAL_PACK_BASE_URL = "";

export const OFFICIAL_PACKS: OfficialPack[] = [
  {
    kind: "databases",
    label: "Databases",
    fileName: "databases.json",
    description: "Schemas, setup SQL and seed data needed to run every exercise.",
    url: OFFICIAL_PACK_BASE_URL,
  },
  {
    kind: "questions",
    label: "Questions",
    fileName: "questions.json",
    description: "Question bank with descriptions, test cases, hints and solutions.",
    url: OFFICIAL_PACK_BASE_URL,
  },
  {
    kind: "notes",
    label: "Notes",
    fileName: "notes.json",
    description: "SQL study notes grouped by category.",
    url: OFFICIAL_PACK_BASE_URL,
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
