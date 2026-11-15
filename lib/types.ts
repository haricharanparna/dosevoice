export type Scan = {
  isMedicationLabel: boolean;
  drugName: string;
  strength: string;
  instructions: string;
  suggestedTimes: string[];
  warnings: string[];
  plainSummary: string;
  /** Key fields not readable in any photo, e.g. ["directions"]. */
  missing: ("name" | "strength" | "directions")[];
  /** What to photograph next when something is missing. */
  retakeHint: string;
  confidence: "high" | "medium" | "low";
};

export type Med = {
  _id: string;
  drugName: string;
  strength: string;
  instructions: string;
  summary: string;
  warnings: string[];
  times: string[];
  createdAt?: string;
};

export type DoseStatus = "taken" | "skipped";
export type Dose = { medId: string; date: string; time: string; status: DoseStatus; at?: string };

export type Settings = {
  size: "normal" | "large" | "xl";
  theme: "system" | "light" | "dark";
  contrast: boolean;
  rate: number;
  autoRead: boolean;
};

export type Interaction = {
  drugs: string[];
  severity: "major" | "moderate" | "minor";
  explanation: string;
  questionForPharmacist: string;
};
export type InteractionReport = { summary: string; interactions: Interaction[] };
