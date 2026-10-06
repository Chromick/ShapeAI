import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import type { ChatMessage } from "./aiService";
import { auth, db } from "./firebaseConfig";

const KEEP = 60;

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachmentName?: string;
  attachmentMime?: string;
};

export async function loadChat(): Promise<ChatMessage[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snapshot = await getDoc(doc(db, "chat_history", uid));
    const stored = (snapshot.data()?.messages ?? []) as StoredMessage[];
    return stored.map((item) => ({
      id: item.id,
      role: item.role,
      text: item.text,
      ...(item.attachmentName
        ? { attachment: { name: item.attachmentName, mime: item.attachmentMime ?? "" } }
        : {}),
    }));
  } catch {
    return [];
  }
}

export async function saveChat(messages: ChatMessage[], welcomeId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const stored: StoredMessage[] = messages
    .filter((message) => message.id !== welcomeId)
    .slice(-KEEP)
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      ...(message.attachment
        ? { attachmentName: message.attachment.name, attachmentMime: message.attachment.mime }
        : {}),
    }));
  try {
    await setDoc(doc(db, "chat_history", uid), { messages: stored, updatedAt: new Date().toISOString() });
  } catch {
    return;
  }
}

export async function clearChat(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(doc(db, "chat_history", uid)).catch(() => undefined);
}
