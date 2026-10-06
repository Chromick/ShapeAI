import { json, verifyCaller } from "../lib/auth.js";
import { providers } from "../lib/providers.js";

type ChatPayload = {
  messages?: unknown[];
  tools?: unknown[];
  tool_choice?: string;
  response_format?: { type: string };
  vision?: boolean;
};

export async function POST(request: Request): Promise<Response> {
  const caller = await verifyCaller(request);
  if (caller instanceof Response) return caller;

  let payload: ChatPayload;
  try {
    payload = (await request.json()) as ChatPayload;
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  if (!Array.isArray(payload.messages) || !payload.messages.length) {
    return json({ error: "Sem mensagens." }, 400);
  }

  const list = providers();
  if (!list.length) return json({ error: "O servidor do tutor está sem chave de IA." }, 503);

  let last = "Nenhum provedor respondeu.";
  for (const provider of list) {
    const body: Record<string, unknown> = {
      model: payload.vision ? provider.visionModel : provider.chatModel,
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
      return json({ data, provider: provider.name });
    } catch {
      last = `${provider.name}: rede.`;
    }
  }
  return json({ error: last }, 502);
}
