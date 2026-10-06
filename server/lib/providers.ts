export type Provider = {
  name: string;
  chatUrl: string;
  transcribeUrl: string;
  chatModel: string;
  visionModel: string;
  transcribeModel: string;
  key: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

function groq(): Provider | null {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return null;
  return {
    name: "Groq",
    chatUrl: "https://api.groq.com/openai/v1/chat/completions",
    transcribeUrl: "https://api.groq.com/openai/v1/audio/transcriptions",
    chatModel: "openai/gpt-oss-20b",
    visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    transcribeModel: "whisper-large-v3-turbo",
    key,
    extraBody: {
      reasoning_effort: "low",
      max_completion_tokens: 2048,
    },
  };
}

function openrouter(): Provider | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  return {
    name: "OpenRouter",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    transcribeUrl: "",
    chatModel: "openai/gpt-oss-20b:free",
    visionModel: "meta-llama/llama-4-scout:free",
    transcribeModel: "",
    key,
    extraHeaders: {
      "HTTP-Referer": "https://github.com/Chromick/ShapeAI",
      "X-Title": "Shape",
    },
  };
}

function openai(): Provider | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return {
    name: "OpenAI",
    chatUrl: "https://api.openai.com/v1/chat/completions",
    transcribeUrl: "https://api.openai.com/v1/audio/transcriptions",
    chatModel: "gpt-4o-mini",
    visionModel: "gpt-4o-mini",
    transcribeModel: "whisper-1",
    key,
  };
}

export function providers(): Provider[] {
  return [groq(), openrouter(), openai()].filter((item): item is Provider => Boolean(item));
}
