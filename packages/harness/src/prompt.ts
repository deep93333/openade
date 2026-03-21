import type { Runtime } from "./ids.js";

export type ModelRef = {
  runtime?: Runtime;
  model: string;
};

export type ImageSource =
  | { type: "base64"; mediaType: string; data: string }
  | { type: "path"; path: string }
  | { type: "url"; url: string };

export type Part =
  | { type: "text"; text: string }
  | { type: "image"; source: ImageSource }
  | { type: "file"; path: string };

export type PromptInput = {
  parts: Part[];
  model?: ModelRef;
  outputSchema?: unknown;
  noReply?: boolean;
};
