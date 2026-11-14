export interface Subject {
  id: string;
  label: string;
  dataLabel: string;
  scriptExtension: string;
}

export const SUBJECTS: Subject[] = [
  {
    id: "sql",
    label: "SQL",
    dataLabel: "Databases",
    scriptExtension: ".sql",
  },
];

export const activeSubject: Subject = SUBJECTS[0];
