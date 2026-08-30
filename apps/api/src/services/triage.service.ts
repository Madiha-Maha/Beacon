import type {
  HapticPattern,
  NarrationTier,
  TriageInput,
  TriageOutput,
} from "@beacon/shared/types";

const HAZARD_KEYWORDS = [
  "stairs",
  "stair",
  "staircase",
  "curb",
  "curb cut",
  "vehicle",
  "car",
  "truck",
  "bus",
  "van",
  "motorcycle",
  "scooter",
  "bicycle",
  "bike",
  "obstacle",
  "wet floor",
  "slippery",
  "puddle",
  "ice",
  "hole",
  "pothole",
  "drop off",
  "drop-off",
  "dropoff",
  "cliff",
  "ledge",
  "construction",
  "cone",
  "barrier",
  "blocked ramp",
  "blocked sidewalk",
  "broken pavement",
  "debris",
  "trash can",
  "fire hydrant",
  "bench",
  "post",
  "pole",
  "sign pole",
  "tree",
  "branch",
  "door",
  "glass door",
  "low branch",
];

const CRITICAL_HAZARDS = [
  "stairs",
  "stair",
  "staircase",
  "drop off",
  "drop-off",
  "dropoff",
  "hole",
  "pothole",
  "cliff",
  "ledge",
  "vehicle",
  "car",
  "truck",
  "bus",
  "van",
  "motorcycle",
  "scooter",
  "wet floor",
  "slippery",
  "ice",
  "construction",
  "barrier",
];

const SOCIAL_KEYWORDS = [
  "person",
  "people",
  "face",
  "friend",
  "waving",
  "wave",
  "approaching",
  "walking toward",
  "walking towards",
  "coming toward",
  "coming towards",
  "smiling",
  "talking",
  "child",
  "baby",
  "dog",
  "service animal",
  "cat",
];

const HAZARD_PREFIXES_PROXIMAL = [
  "at your feet",
  "very close",
  "directly in front",
  "directly ahead",
  "half a meter",
  "0.5 meter",
  "1 meter",
  "one meter",
  "ahead, close",
  "immediately",
  "right in front",
];

const HAZARD_PREFIXES_APPROACHING = [
  "approaching",
  "coming toward",
  "coming towards",
  "moving toward",
  "moving towards",
  "heading toward",
  "heading towards",
  "oncoming",
  "getting closer",
];

interface TriageDecision {
  tier: NarrationTier;
  reason: string;
  matches: string[];
  proximityLevel: "near" | "approaching" | "normal";
}

function lowerAll(list: string[]): string[] {
  return list.map((s) => s.toLowerCase());
}

function detectMatches(haystacks: string[], needles: string[]): string[] {
  const matches = new Set<string>();
  for (const hay of haystacks) {
    const h = hay.toLowerCase();
    for (const needle of needles) {
      if (h.includes(needle)) {
        matches.add(needle);
      }
    }
  }
  return Array.from(matches);
}

function determineProximity(input: TriageInput): "near" | "approaching" | "normal" {
  const all = [
    input.sceneDescription,
    input.proximityHints ?? "",
    ...input.detectedObjects,
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  const joined = all.join(" ");
  if (HAZARD_PREFIXES_APPROACHING.some((p) => joined.includes(p))) {
    return "approaching";
  }
  if (HAZARD_PREFIXES_PROXIMAL.some((p) => joined.includes(p))) {
    return "near";
  }
  return "normal";
}

function scoreDecision(decision: TriageDecision): number {
  let score = 0;
  if (decision.tier === "hazard") score += 1000;
  if (decision.tier === "social") score += 500;
  if (decision.tier === "ambient") score += 100;
  const hasCritical = decision.matches.some((m) =>
    CRITICAL_HAZARDS.some((c) => m.includes(c) || c.includes(m))
  );
  if (hasCritical) score += 300;
  if (decision.proximityLevel === "near") score += 200;
  if (decision.proximityLevel === "approaching") score += 150;
  score += decision.matches.length * 10;
  return score;
}

function buildHazardText(
  input: TriageInput,
  hazardMatches: string[],
  proximityLevel: "near" | "approaching" | "normal"
): string {
  const subject = hazardMatches.length > 0 ? hazardMatches.slice(0, 2).join(", ") : "hazard";

  if (input.proximityHints) {
    const hint = input.proximityHints.replace(/\.$/, "");
    if (proximityLevel === "near") {
      return `Hazard ahead: ${subject}. ${hint}.`;
    }
    if (proximityLevel === "approaching") {
      return `Approaching: ${subject}. ${hint}.`;
    }
    return `Ahead: ${subject}. ${hint}.`;
  }

  if (proximityLevel === "near") {
    return `Hazard nearby: ${subject}.`;
  }
  if (proximityLevel === "approaching") {
    return `Approaching: ${subject}.`;
  }
  return `Noted: ${subject}.`;
}

function buildSocialText(
  input: TriageInput,
  socialMatches: string[]
): string {
  const subject =
    socialMatches.length > 0 ? socialMatches.slice(0, 2).join(", ") : "people nearby";
  if (input.proximityHints) {
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)}. ${input.proximityHints}.`;
  }
  return `${subject.charAt(0).toUpperCase() + subject.slice(1)} in the scene.`;
}

function buildAmbientText(input: TriageInput): string {
  const sentence = input.sceneDescription
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .find(Boolean);
  if (sentence) {
    return sentence.length > 140 ? sentence.slice(0, 140) + "…" : sentence;
  }
  if (input.detectedObjects.length > 0) {
    return "In view: " + input.detectedObjects.slice(0, 4).join(", ") + ".";
  }
  return "";
}

export function triageNarration(input: TriageInput): TriageOutput {
  const haystacks = lowerAll([
    input.sceneDescription,
    input.proximityHints ?? "",
    ...input.detectedObjects,
  ]);

  const hazardMatches = detectMatches(haystacks, HAZARD_KEYWORDS);
  const socialMatches = detectMatches(haystacks, SOCIAL_KEYWORDS);
  const proximityLevel = determineProximity(input);

  const decisions: TriageDecision[] = [];
  if (hazardMatches.length > 0) {
    decisions.push({
      tier: "hazard",
      reason: "matched hazard keywords",
      matches: hazardMatches,
      proximityLevel,
    });
  }
  if (socialMatches.length > 0) {
    decisions.push({
      tier: "social",
      reason: "matched social keywords",
      matches: socialMatches,
      proximityLevel,
    });
  }
  decisions.push({
    tier: "ambient",
    reason: "fallback ambient description",
    matches: [],
    proximityLevel,
  });

  decisions.sort((a, b) => scoreDecision(b) - scoreDecision(a));
  const winner = decisions[0];

  let text = "";
  let hapticPattern: HapticPattern | undefined;

  switch (winner.tier) {
    case "hazard": {
      text = buildHazardText(input, hazardMatches, proximityLevel);
      if (proximityLevel === "near") hapticPattern = "hazard-near";
      else if (proximityLevel === "approaching")
        hapticPattern = "hazard-approaching";
      break;
    }
    case "social": {
      text = buildSocialText(input, socialMatches);
      hapticPattern = "social-cue";
      break;
    }
    case "ambient":
    default: {
      text = buildAmbientText(input);
      break;
    }
  }

  text = text.trim().replace(/\s+/g, " ");
  if (!text.endsWith(".")) text += ".";

  return {
    tier: winner.tier,
    text,
    hapticPattern,
  };
}
