import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "shapeai-9c9cb";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type Caller = { uid: string; email?: string };

export async function verifyCaller(request: Request): Promise<Caller | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "Entre na sua conta para falar com o tutor." }, 401);
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    const uid = String(payload.sub ?? "");
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
    if (!uid) return json({ error: "Sessão inválida." }, 401);
    const allowed = (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && (!email || !allowed.includes(email))) {
      return json({ error: "Esta conta não tem acesso ao tutor." }, 403);
    }
    return { uid, email };
  } catch {
    return json({ error: "Sessão expirada. Sai e entra de novo." }, 401);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
