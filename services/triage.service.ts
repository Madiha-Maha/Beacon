/**
 * Beacon — Real-Time AI Sight Companion
 * Triage Engine Service
 *
 * Implements strict hierarchical triage:
 * 1. Immediate Physical Hazard (curbs, drop-offs, stairs, oncoming vehicles, wet floors)
 * 2. Moving Objects / Dynamic Threats
 * 3. Social Cues (approaching person, waving, eye-contact)
 * 4. Static Scene Details & Ambient Context
 */

import { HapticPattern, NarrationTier, TriageInput, TriageOutput } from "../src/types.ts";

// High-risk obstacle & hazard keyword taxonomy
const CRITICAL_HAZARD_KEYWORDS = [
  "stairs", "step", "curb", "drop-off", "drop", "hole", "pothole",
  "vehicle", "car", "bus", "truck", "van", "motorcycle", "scooter",
  "cyclist", "bike", "bicycle", "wet floor", "slippery", "spill", "ice",
  "construction", "scaffolding", "barrier", "cordon", "trench",
  "low overhang", "branch", "pole", "bollard", "glass door", "edge",
  "crosswalk", "red light", "traffic", "train", "tram", "blind corner"
];

const SOCIAL_KEYWORDS = [
  "person", "friend", "man", "woman", "child", "pedestrian",
  "waving", "approaching", "looking", "smiling", "nodding",
  "gesturing", "holding door", "reaching", "waiting"
];

export class TriageEngine {
  /**
   * Prioritize input into one actionable narration item
   */
  public static triage(input: TriageInput, location?: { lat: number; lng: number }): TriageOutput {
    const rawObjects = input.detectedObjects.map((o) => o.toLowerCase());
    const descLower = (input.sceneDescription || "").toLowerCase();
    const proximity = (input.proximityHints || "").toLowerCase();

    // 1. Check for physical hazards
    const detectedHazards = CRITICAL_HAZARD_KEYWORDS.filter(
      (keyword) =>
        rawObjects.some((obj) => obj.includes(keyword)) ||
        descLower.includes(keyword)
    );

    const isNear = proximity.includes("close") || proximity.includes("near") || proximity.includes("immediate") || proximity.includes("1m") || proximity.includes("2m");
    const isApproaching = proximity.includes("approaching") || proximity.includes("moving toward") || input.motionDetected;

    if (detectedHazards.length > 0) {
      let hapticPattern: HapticPattern = isNear ? "hazard-near" : "hazard-approaching";
      const primaryHazard = detectedHazards[0];

      // Format clean, short, imperative hazard sentence (<= 10-12 words for fastest TTS playback)
      let hazardText = this.formatHazardSpeech(primaryHazard, proximity, input.sceneDescription);

      return {
        id: `narration-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tier: "hazard",
        text: hazardText,
        hapticPattern,
        timestamp: Date.now(),
        detectedObjects: input.detectedObjects,
        confidence: input.confidenceScore ?? 0.95,
        location,
      };
    }

    // 2. Check for Social Cues
    const detectedSocial = SOCIAL_KEYWORDS.filter(
      (keyword) =>
        rawObjects.some((obj) => obj.includes(keyword)) ||
        descLower.includes(keyword)
    );

    if (detectedSocial.length > 0) {
      const socialText = this.formatSocialSpeech(input.sceneDescription, rawObjects);
      return {
        id: `narration-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tier: "social",
        text: socialText,
        hapticPattern: "social-cue",
        timestamp: Date.now(),
        detectedObjects: input.detectedObjects,
        confidence: input.confidenceScore ?? 0.88,
        location,
      };
    }

    // 3. Ambient scene description
    const ambientText = this.formatAmbientSpeech(input.sceneDescription);
    return {
      id: `narration-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tier: "ambient",
      text: ambientText,
      timestamp: Date.now(),
      detectedObjects: input.detectedObjects,
      confidence: input.confidenceScore ?? 0.82,
      location,
    };
  }

  private static formatHazardSpeech(hazard: string, proximity: string, fullDesc: string): string {
    const p = proximity || "ahead";
    // Check if fullDesc is already a punchy hazard sentence
    if (fullDesc && fullDesc.length < 50 && (fullDesc.includes("caution") || fullDesc.includes("watch") || fullDesc.includes("ahead"))) {
      return fullDesc;
    }

    if (hazard.includes("stairs") || hazard.includes("step")) {
      return `Caution: steps detected ${p}. Watch your footing.`;
    }
    if (hazard.includes("curb")) {
      return `Curb ${p}. Step down carefully.`;
    }
    if (hazard.includes("vehicle") || hazard.includes("car") || hazard.includes("cyclist") || hazard.includes("traffic")) {
      return `Warning: moving ${hazard} ${p}. Hold position.`;
    }
    if (hazard.includes("wet") || hazard.includes("slippery")) {
      return `Caution: slippery or wet surface directly ${p}.`;
    }
    if (hazard.includes("construction") || hazard.includes("scaffolding") || hazard.includes("barrier")) {
      return `Attention: construction barrier blocking path ${p}.`;
    }
    if (hazard.includes("pole") || hazard.includes("bollard") || hazard.includes("overhang")) {
      return `Obstacle detected ${p}: ${hazard}.`;
    }

    return `Alert: ${hazard} ${p}. Proceed with care.`;
  }

  private static formatSocialSpeech(desc: string, objects: string[]): string {
    if (desc && desc.length < 70 && (desc.includes("waving") || desc.includes("approaching") || desc.includes("person"))) {
      return desc;
    }
    if (desc.includes("waving")) {
      return "Someone ahead is waving towards you.";
    }
    if (desc.includes("approaching") || desc.includes("walking toward")) {
      return "A pedestrian is walking toward you on your path.";
    }
    return `Person nearby ${objects.includes("door") ? "holding the door" : "in your vicinity"}.`;
  }

  private static formatAmbientSpeech(desc: string): string {
    if (!desc || desc.trim().length === 0) {
      return "Clear path ahead. Level sidewalk.";
    }
    // Limit length to keep ambient narration calm and brief
    const sentences = desc.split(/[.!?]+/).filter(Boolean);
    return sentences[0] ? sentences[0].trim() + "." : "Surroundings stable and unobstructed.";
  }
}
