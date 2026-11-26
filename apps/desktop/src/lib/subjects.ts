export type SubjectId =
  | "sql"
  | "dsa"
  | "computer-networking"
  | "os"
  | "system-design";

export type ServiceState = "available" | "coming";

export interface SubjectFeatureFlags {
  editor: boolean;
  databases: boolean;
  schema: boolean;
  dataHub: boolean;
  practice: boolean;
  notes: boolean;
  progress: boolean;
}

export interface SubjectDefinition {
  id: SubjectId;
  label: string;
  shortLabel: string;
  summary: string;
  state: ServiceState;
  routePrefix: string;
  href: string;
  scriptExtension: string;
  features: SubjectFeatureFlags;
}

export interface Subject {
  id: string;
  label: string;
  scriptExtension: string;
}

export interface LearningService {
  id: string;
  label: string;
  summary: string;
  state: ServiceState;
  href?: string;
}

export const SUBJECT_REGISTRY: SubjectDefinition[] = [
  {
    id: "sql",
    label: "SQL",
    shortLabel: "SQL",
    summary:
      "Query, aggregate and shape real datasets. Graded exercises, hints, notes and an ER diagram of every relation.",
    state: "available",
    routePrefix: "/playground",
    href: "/learn",
    scriptExtension: ".sql",
    features: {
      editor: true,
      databases: true,
      schema: true,
      dataHub: true,
      practice: true,
      notes: true,
      progress: true,
    },
  },
  {
    id: "dsa",
    label: "Data Structures & Algorithms",
    shortLabel: "DSA",
    summary:
      "Complexity, arrays, graphs and dynamic programming with runnable test cases.",
    state: "coming",
    routePrefix: "/dsa",
    href: "/dsa",
    scriptExtension: ".ts",
    features: {
      editor: true,
      databases: false,
      schema: false,
      dataHub: false,
      practice: true,
      notes: true,
      progress: true,
    },
  },
  {
    id: "computer-networking",
    label: "Computer Networking",
    shortLabel: "Networking",
    summary:
      "Protocols, packet flow and layered models traced through interactive traces.",
    state: "coming",
    routePrefix: "/networking",
    href: "/networking",
    scriptExtension: ".txt",
    features: {
      editor: false,
      databases: false,
      schema: false,
      dataHub: false,
      practice: true,
      notes: true,
      progress: true,
    },
  },
  {
    id: "os",
    label: "Operating Systems",
    shortLabel: "OS",
    summary:
      "Scheduling, memory and concurrency visualised on a live simulated kernel.",
    state: "coming",
    routePrefix: "/os",
    href: "/os",
    scriptExtension: ".c",
    features: {
      editor: true,
      databases: false,
      schema: false,
      dataHub: false,
      practice: true,
      notes: true,
      progress: true,
    },
  },
  {
    id: "system-design",
    label: "System Design",
    shortLabel: "Systems",
    summary:
      "Architecture reviews, capacity estimates and trade-off drills for real systems.",
    state: "coming",
    routePrefix: "/systems",
    href: "/systems",
    scriptExtension: ".md",
    features: {
      editor: false,
      databases: false,
      schema: true,
      dataHub: false,
      practice: true,
      notes: true,
      progress: true,
    },
  },
];

export const SUBJECTS: Subject[] = SUBJECT_REGISTRY.filter(
  (subject) => subject.state === "available",
).map(({ id, label, scriptExtension }) => ({ id, label, scriptExtension }));

export const activeSubject: Subject = SUBJECTS[0];

export const LEARNING_SERVICES: LearningService[] = SUBJECT_REGISTRY.map(
  (subject) => ({
    id: subject.id,
    label: subject.label,
    summary: subject.summary,
    state: subject.state,
    href: subject.state === "available" ? subject.href : undefined,
  }),
);

export function getSubjectById(id: string): SubjectDefinition | undefined {
  return SUBJECT_REGISTRY.find((subject) => subject.id === id);
}

export function getAvailableSubjects(): SubjectDefinition[] {
  return SUBJECT_REGISTRY.filter((subject) => subject.state === "available");
}
