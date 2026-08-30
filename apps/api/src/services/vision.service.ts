import type { VisionAnalysis, VisionProviderName } from "@beacon/shared/types";

export interface VisionProvider {
  readonly name: VisionProviderName;
  analyzeFrame(frameBase64: string): Promise<VisionAnalysis>;
}

class MockVisionProvider implements VisionProvider {
  readonly name: VisionProviderName = "mock";

  private sampleScenes = [
    {
      detectedObjects: ["sidewalk", "curb", "tree", "person walking ahead"],
      proximityHints: "curb is 2 meters ahead",
      sceneDescription:
        "Outdoor sidewalk scene. A concrete curb is about 2 meters ahead. A person is walking further ahead. A large tree is to the right.",
    },
    {
      detectedObjects: ["stairs", "handrail", "landing"],
      proximityHints: "stairs are very close, at your feet",
      sceneDescription:
        "A set of concrete stairs going down, with a metal handrail on the left. You are at the top of the stairs.",
    },
    {
      detectedObjects: ["wet floor sign", "tile floor"],
      proximityHints: "sign is 1 meter ahead on the floor",
      sceneDescription:
        "Indoor tile floor. A yellow wet floor caution sign is on the ground about 1 meter ahead. The floor appears damp.",
    },
    {
      detectedObjects: ["chair", "table", "person waving", "lamp"],
      proximityHints: "person is 3 meters away and moving toward you",
      sceneDescription:
        "A room with a table and chairs. A person across the table is waving in your direction and appears to be walking over.",
    },
    {
      detectedObjects: ["car", "crosswalk", "traffic light", "bicycle"],
      proximityHints: "car is approaching from left, 10 meters away",
      sceneDescription:
        "Street scene at a crosswalk. A car is approaching from the left. A bicycle is parked on the right sidewalk. The traffic light is red.",
    },
    {
      detectedObjects: ["door", "doorknob", "wall"],
      proximityHints: "door is directly in front of you, half a meter away",
      sceneDescription:
        "A closed interior door directly in front of you. Round doorknob on the right side. Light-colored wall around the door frame.",
    },
  ];

  async analyzeFrame(_frameBase64: string): Promise<VisionAnalysis> {
    await new Promise((r) => setTimeout(r, 250));
    const scene = this.sampleScenes[Math.floor(Math.random() * this.sampleScenes.length)];
    return { ...scene };
  }
}

class OpenAIVisionProvider implements VisionProvider {
  readonly name: VisionProviderName = "openai";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeFrame(frameBase64: string): Promise<VisionAnalysis> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "You are the vision backend for Beacon, a real-time narration tool for blind and low-vision users.",
              "Return STRICT JSON only with the shape:",
              "{",
              '  "detectedObjects": string[],',
              '  "proximityHints": string | null,',
              '  "sceneDescription": string',
              "}",
              "detectedObjects: short labels for objects/entities in view.",
              "proximityHints: anything that is close, at your feet, or approaching, else null.",
              "sceneDescription: one or two sentence plain-English summary of what's in view.",
              "Prioritize hazards: curbs, stairs, drops, vehicles, obstacles, wet floor signs, holes.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${frameBase64}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }
    const data = (await response.json()) as any;
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    } catch {
      parsed = {
        detectedObjects: [],
        proximityHints: null,
        sceneDescription: raw,
      };
    }
    return {
      detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects : [],
      proximityHints: typeof parsed.proximityHints === "string" ? parsed.proximityHints : undefined,
      sceneDescription: typeof parsed.sceneDescription === "string" ? parsed.sceneDescription : "",
      rawResponse: data,
    };
  }
}

class AnthropicVisionProvider implements VisionProvider {
  readonly name: VisionProviderName = "anthropic";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeFrame(frameBase64: string): Promise<VisionAnalysis> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 300,
        temperature: 0.2,
        system: [
          "You are the vision backend for Beacon, a real-time narration tool for blind and low-vision users.",
          "Return STRICT JSON only with the shape:",
          "{",
          '  "detectedObjects": string[],',
          '  "proximityHints": string | null,',
          '  "sceneDescription": string',
          "}",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: frameBase64,
                },
              },
              {
                type: "text",
                text: "Analyze this frame. Return ONLY strict JSON with detectedObjects, proximityHints (null if nothing close or approaching), and sceneDescription.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}`);
    }
    const data = (await response.json()) as any;
    const raw = data.content?.[0]?.text ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    } catch {
      parsed = {
        detectedObjects: [],
        proximityHints: null,
        sceneDescription: raw,
      };
    }
    return {
      detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects : [],
      proximityHints: typeof parsed.proximityHints === "string" ? parsed.proximityHints : undefined,
      sceneDescription: typeof parsed.sceneDescription === "string" ? parsed.sceneDescription : "",
      rawResponse: data,
    };
  }
}

export function createVisionProvider(): VisionProvider {
  const providerName = (process.env.VISION_PROVIDER ?? "mock") as VisionProviderName;
  const apiKey = process.env.VISION_PROVIDER_API_KEY ?? "";

  switch (providerName) {
    case "openai":
      if (!apiKey) {
        console.warn(
          "[vision.service] VISION_PROVIDER=openai but VISION_PROVIDER_API_KEY not set; falling back to mock"
        );
        return new MockVisionProvider();
      }
      return new OpenAIVisionProvider(apiKey);
    case "anthropic":
      if (!apiKey) {
        console.warn(
          "[vision.service] VISION_PROVIDER=anthropic but VISION_PROVIDER_API_KEY not set; falling back to mock"
        );
        return new MockVisionProvider();
      }
      return new AnthropicVisionProvider(apiKey);
    case "mock":
    default:
      console.info("[vision.service] Using mock vision provider");
      return new MockVisionProvider();
  }
}
