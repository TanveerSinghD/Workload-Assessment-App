export type ResponseGroup = "concise" | "standard" | "detailed" | "coach" | "mathHeavy";

export type ResponseBank = {
  concise: string[];
  standard: string[];
  detailed: string[];
  coach?: string[];
  mathHeavy?: string[];
};

export type Intent = {
  id: string;
  category?: string;
  userPromptExamples: string[];
  responseBank: ResponseBank;
  selectionNotes?: string;
};

export type LibraryType = "main" | "greet";

export type MatchCandidate = {
  intent: Intent;
  score: number;
};

export type MatchResult = {
  top: MatchCandidate | null;
  top3: MatchCandidate[];
};

export type SelectionContext = {
  userMessage: string;
  preferredGroup?: ResponseGroup;
  library: LibraryType;
  allowDebug?: boolean;
};

export type SelectedResponse = {
  text: string;
  group: ResponseGroup;
  index: number;
  intentId: string;
  library: LibraryType;
};
