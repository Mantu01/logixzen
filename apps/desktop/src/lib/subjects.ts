export interface Subject {
  id: string;
  label: string;
  scriptExtension: string;
}

const SUBJECTS: Subject[] = [
  {
    id: "sql",
    label: "SQL",
    scriptExtension: ".sql",
  },
];

export const activeSubject: Subject = SUBJECTS[0];

type ServiceState = "available" | "coming";

export interface LearningService {
  id: string;
  label: string;
  summary: string;
  state: ServiceState;
  href?: string;
}

export const LEARNING_SERVICES: LearningService[] = [
  {
    id: "sql",
    label: "SQL",
    summary:
      "Query, aggregate and shape real datasets. Graded exercises, hints, notes and an ER diagram of every relation.",
    state: "available",
    href: "/learn",
  },
  {
    id: "dsa",
    label: "Data Structures & Algorithms",
    summary:
      "Complexity, arrays, graphs and dynamic programming with runnable test cases.",
    state: "coming",
  },
  {
    id: "computer-networking",
    label: "Computer Networking",
    summary:
      "Protocols, packet flow and layered models traced through interactive traces.",
    state: "coming",
  },
  {
    id: "os",
    label: "Operating Systems",
    summary:
      "Scheduling, memory and concurrency visualised on a live simulated kernel.",
    state: "coming",
  },
  {
    id: "system-design",
    label: "System Design",
    summary:
      "Architecture reviews, capacity estimates and trade-off drills for real systems.",
    state: "coming",
  },
];
