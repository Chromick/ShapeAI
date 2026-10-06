import { auth } from "./firebaseConfig";

export type ChatPayload = {
  messages: unknown[];
  tools?: unknown[];
  tool_choice?: string;
  response_format?: { type: string };
  vision?: boolean;
};

const API_URL = (process.env.EXPO_PUBLIC_SHAPE_API_URL || "https://shape-ai-api.vercel.app").replace(/\/$/, "");

async function idToken(): Promise<string | null> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

export function missingLlmText(): string {
  return "Entre na sua conta para falar com o tutor.";
}

export async function chatCompletions(payload: ChatPayload): Promise<{ data: any; provider: string } | { error: string }> {
  const token = await idToken();
  if (!token) return { error: missingLlmText() };
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) {
      if (response.status === 413) return { error: "Arquivo grande demais para o tutor. Manda um menor." };
      return { error: data?.error || `Tutor fora do ar (${response.status}).` };
    }
    return { data: data.data, provider: data.provider };
  } catch {
    return { error: "Sem conexão com o tutor." };
  }
}

export async function transcribeWithLlm(uri: string): Promise<string> {
  const token = await idToken();
  if (!token) throw new Error("missing-key");
  const form = new FormData();
  form.append("file", {
    uri,
    name: "refeicao.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  const response = await fetch(`${API_URL}/api/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error) throw new Error(data?.error || "Falha no áudio.");
  return String(data.text ?? "").trim();
}
