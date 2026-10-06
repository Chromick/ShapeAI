export type ChatPayload = {
  messages: unknown[];
  tools?: unknown[];
  tool_choice?: string;
  response_format?: { type: string };
  vision?: boolean;
};

type Provider = {
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
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim();
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
  const key = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
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
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
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

export function llmProviders(): Provider[] {
  return [groq(), openrouter(), openai()].filter((item): item is Provider => Boolean(item));
}

export function missingLlmText(): string {
  return "O GitHub Models saiu do ar em julho de 2026. O tutor grátis agora usa a Groq: cria a chave em https://console.groq.com/keys e coloca EXPO_PUBLIC_GROQ_API_KEY no .env. OpenRouter (modelos :free) e OpenAI continuam como reserva no mesmo arquivo.";
}

export async function chatCompletions(payload: ChatPayload): Promise<{ data: any; provider: string } | { error: string }> {
  const list = llmProviders();
  if (!list.length) return { error: missingLlmText() };
  let last = "Nenhum provedor respondeu.";
  for (const provider of list) {
    const model = payload.vision ? provider.visionModel : provider.chatModel;
    const body: Record<string, unknown> = {
      model,
      messages: payload.messages,
      ...(provider.extraBody ?? {}),
    };
    if (payload.tools) {
      body.tools = payload.tools;
      body.tool_choice = payload.tool_choice ?? "auto";
    }
    if (payload.response_format) body.response_format = payload.response_format;
    try {
      const response = await fetch(provider.chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.key}`,
          ...(provider.extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        last = `${provider.name}: ${data?.error?.message || response.status}`;
        continue;
      }
      return { data, provider: provider.name };
    } catch {
      last = `${provider.name}: rede.`;
    }
  }
  return { error: last };
}

export async function transcribeWithLlm(uri: string): Promise<string> {
  const list = llmProviders().filter((item) => item.transcribeUrl);
  if (!list.length) throw new Error("missing-key");
  let last = "Falha no áudio.";
  for (const provider of list) {
    const form = new FormData();
    form.append("file", {
      uri,
      name: "refeicao.m4a",
      type: "audio/m4a",
    } as unknown as Blob);
    form.append("model", provider.transcribeModel);
    form.append("language", "pt");
    const response = await fetch(provider.transcribeUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}` },
      body: form,
    });
    const data = await response.json();
    if (!response.ok) {
      last = data?.error?.message || `${provider.name} áudio`;
      continue;
    }
    return String(data.text ?? "").trim();
  }
  throw new Error(last);
}
