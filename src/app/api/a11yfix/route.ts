/**
 * Accessibility fix code. For each axe-core issue the browser sends the failing HTML;
 * NVIDIA NIM (free) returns a plain-English fix and the corrected HTML/CSS.
 */
import { gate } from "@/lib/gate";
import { chat, parseJson } from "@/lib/nim";
import type { A11yFix } from "@/lib/a11y";

export const maxDuration = 90;

type Issue = { id: string; help: string; description?: string; html?: string[]; why?: string[] };

export async function POST(req: Request) {
  const g = await gate(req, "a11yfix", { needLogin: true, ai: true });
  if (g.stop) return g.stop;
  if (!process.env.NVIDIA_API_KEY) return Response.json({ error: "Add NVIDIA_API_KEY to get AI fix code." });
  let body: { issues?: Issue[] };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const issues = (body.issues || []).filter((i) => i?.id).slice(0, 12).map((i) => ({
    id: i.id, problem: i.help, rule: (i.description || "").slice(0, 200),
    element: (i.html || []).find(Boolean)?.slice(0, 300) || "", details: (i.why || []).find(Boolean)?.slice(0, 300) || "",
  }));
  if (!issues.length) return Response.json({ fixes: {} });
  try {
    const out = await chat([
      { role: "system", content: "You are a web accessibility (WCAG 2.1 AA) expert. Fix the given HTML elements. Keep their content, classes and links; change only what the rule needs (alt text, labels, aria attributes, colours, headings, lang, etc). For colour contrast, give a CSS rule with a darker or lighter colour that passes 4.5:1. Never invent facts about the page. Reply with JSON only." },
      { role: "user", content: `Issues:\n${JSON.stringify(issues)}\n\nReturn JSON: {"<issue id>": {"fix": "one or two simple sentences on what to change", "code": "the corrected HTML or CSS, ready to paste"}}` },
    ], 2200, [60000, 30000]);
    const fixes = parseJson<Record<string, A11yFix>>(out) || {};
    if (!Object.keys(fixes).length) return Response.json({ error: "The AI answer could not be read. Try again." });
    return Response.json({ fixes });
  } catch (e) {
    return Response.json({ error: `The AI could not answer (${(e as Error).message.slice(0, 140)}). Try again in a minute.` });
  }
}
