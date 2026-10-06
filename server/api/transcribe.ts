import { json, verifyCaller } from "../lib/auth.js";
import { providers } from "../lib/providers.js";

export async function POST(request: Request): Promise<Response> {
  const caller = await verifyCaller(request);
  if (caller instanceof Response) return caller;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return json({ error: "Áudio inválido." }, 400);
  }
  if (!file) return json({ error: "Sem áudio." }, 400);

  const list = providers().filter((item) => item.transcribeUrl);
  if (!list.length) return json({ error: "O servidor do tutor está sem chave de áudio." }, 503);

  let last = "Falha no áudio.";
  for (const provider of list) {
    const outgoing = new FormData();
    outgoing.append("file", file, file.name || "refeicao.m4a");
    outgoing.append("model", provider.transcribeModel);
    outgoing.append("language", "pt");
    try {
      const response = await fetch(provider.transcribeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}` },
        body: outgoing,
      });
      const data = await response.json();
      if (!response.ok) {
        last = data?.error?.message || `${provider.name} áudio`;
        continue;
      }
      return json({ text: String(data.text ?? "").trim() });
    } catch {
      last = `${provider.name}: rede.`;
    }
  }
  return json({ error: last }, 502);
}
