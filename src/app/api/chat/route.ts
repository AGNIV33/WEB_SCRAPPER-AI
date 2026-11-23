/**
 * Chat with the report, and the AI verdict on the Compare page.
 * The browser sends the report facts (see lib/reportFacts.ts); NVIDIA NIM (free) answers using only those facts.
 */
import { gate } from "@/lib/gate";
import { chat, type Msg } from "@/lib/nim";

export const maxDuration = 60;

type Turn = { role: "user" | "assistant"; content: string };
type Body = { mode?: "chat" | "compare"; names?: string[]; facts?: unknown; factsB?: unknown; messages?: Turn[] };

const RULES = "Rules: use ONLY the facts given. If the answer is not in the facts, say \"The report does not show that\" and suggest what to check. Never invent numbers, prices or claims. Use simple English a beginner understands. Be short: 2-6 bullet points (\"- \") or a few short sentences. Use **bold** for key numbers. When you give a fix, say exactly what to change.";

export async function POST(req: Request) {
  const g = await gate(req, "chat", { needLogin: true, ai: true });
  if (g.stop) return g.stop;
  if (!process.env.NVIDIA_API_KEY) return Response.json({ error: "Add NVIDIA_API_KEY to use the AI chat." });
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const facts = JSON.stringify(body.facts || {}).slice(0, 14000);

  let messages: Msg[];
  if (body.mode === "compare") {
    const factsB = JSON.stringify(body.factsB || {}).slice(0, 14000);
    const [A, B] = [0, 1].map((i) => String(body.names?.[i] || (i ? "Website B" : "Website A")).replace(/[^\w.\- ]/g, "").slice(0, 60));
    messages = [
      { role: "system", content: `You compare two websites from their analysis reports. Call them ${A} and ${B}. ${RULES}` },
      { role: "user", content: `${A} facts:\n${facts}\n\n${B} facts:\n${factsB}\n\nWrite these sections with markdown headings (### ):\n### Winner\nOne or two sentences: which site is better overall and why (use the scores).\n### Where ${A} is better\n### Where ${B} is better\n### What ${A} should copy from ${B}\n3 concrete actions.\n### What ${B} should copy from ${A}\n3 concrete actions.` },
    ];
  } else {
    const turns = (body.messages || []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!turns.length || turns[turns.length - 1].role !== "user") return Response.json({ error: "Ask a question first." }, { status: 400 });
    messages = [{ role: "system", content: `You are a friendly website expert. The user is looking at an analysis report of a website and asks questions about it. ${RULES}\n\nReport facts (JSON):\n${facts}` }, ...turns];
  }
  try {
    const answer = await chat(messages, body.mode === "compare" ? 1400 : 900, [45000, 25000]);
    return Response.json({ answer });
  } catch (e) {
    return Response.json({ error: `The AI could not answer (${(e as Error).message.slice(0, 140)}). Try again in a minute.` });
  }
}
