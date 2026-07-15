const STORAGE_KEY = "jarvis.agentLearning.v1";
const MAX_RUNS = 30;
const MAX_LESSONS = 18;

const positivePattern = /\b(won|winner|profit(?:able)?|worked|successful|hit (?:the )?target|good setup)\b/i;
const negativePattern = /\b(lost|loser|loss|failed|stopped out|bad setup|late entry|mistake|wrong)\b/i;
const correctionPattern = /\b(learn(?:ed)?|remember|correction|next time|should have|do not|don't)\b/i;

function emptyStore() {
  return { version: 1, agents: {} };
}

function trimText(value, limit = 1200) {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function readStore() {
  if (typeof window === "undefined") return emptyStore();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed?.version === 1 && parsed.agents) return parsed;
  } catch {
    // A damaged journal should never prevent Mission Control from starting.
  }
  return emptyStore();
}

function writeStore(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Learning remains available for the current model request when storage is blocked.
  }
}

function agentRecord(store, agentId) {
  if (!store.agents[agentId]) {
    store.agents[agentId] = { runs: [], lessons: [], wins: 0, losses: 0, corrections: 0 };
  }
  return store.agents[agentId];
}

export function recordAgentRun(agentId, command, response) {
  const store = readStore();
  const record = agentRecord(store, agentId);
  record.runs.unshift({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    command: trimText(command, 600),
    response: trimText(response),
    outcome: "pending",
  });
  record.runs = record.runs.slice(0, MAX_RUNS);
  writeStore(store);
  return getAgentLearning(agentId);
}

export function detectLearningFeedback(command, fallbackAgentId) {
  const text = String(command ?? "").trim();
  if (!text) return null;

  const namedAgent = ["atlas", "vega", "echo", "zeus", "nova", "aura", "sentinel", "hermes"]
    .find((agentId) => new RegExp(`\\b${agentId}\\b`, "i").test(text));
  const agentId = namedAgent ?? fallbackAgentId;
  if (!agentId) return null;

  const positive = positivePattern.test(text);
  const negative = negativePattern.test(text);
  const correction = correctionPattern.test(text);
  if (!positive && !negative && !correction) return null;

  return {
    agentId,
    outcome: negative ? "loss" : positive ? "win" : "correction",
    note: trimText(text, 700),
  };
}

export function recordAgentFeedback({ agentId, outcome, note }) {
  const store = readStore();
  const record = agentRecord(store, agentId);
  const pendingRun = record.runs.find((run) => run.outcome === "pending");
  if (pendingRun) {
    pendingRun.outcome = outcome;
    pendingRun.feedback = trimText(note, 700);
    pendingRun.resolvedAt = new Date().toISOString();
  }

  if (outcome === "win") record.wins += 1;
  if (outcome === "loss") record.losses += 1;
  if (outcome === "correction") record.corrections += 1;

  const lessonLead = outcome === "loss"
    ? "Failure to avoid or improve"
    : outcome === "win"
      ? "Pattern that produced a good outcome"
      : "Operator correction";
  record.lessons.unshift({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    outcome,
    text: `${lessonLead}: ${trimText(note, 700)}`,
  });
  record.lessons = record.lessons.slice(0, MAX_LESSONS);
  writeStore(store);
  return getAgentLearning(agentId);
}

export function auditAgentResponse(agentId, response) {
  const text = String(response ?? "").trim();
  if (text.length < 80) return "The previous answer was too brief to be safely actionable; provide reasoning, uncertainty, and a next step.";

  if (agentId === "vega") {
    const requirements = [
      ["entry conditions", /\b(entry|trigger|confirmation|only if)\b/i],
      ["invalidation or stop condition", /\b(invalid|stop|exit if|wrong if)\b/i],
      ["defined risk", /\b(risk|position size|max(?:imum)? loss)\b/i],
      ["uncertainty or missing data", /\b(uncertain|confidence|need(?:s|ed)? (?:live )?data|cannot confirm|unknown)\b/i],
    ];
    const missing = requirements.filter(([, pattern]) => !pattern.test(text)).map(([label]) => label);
    if (missing.length) return `The previous market brief omitted ${missing.join(", ")}. Include those fields before presenting another setup.`;
  }

  if (agentId === "zeus" && /\b(done|completed|fixed|changed|deployed|implemented)\b/i.test(text) && !/\b(file|diff|test|build|tool output|verified)\b/i.test(text)) {
    return "The previous engineering answer implied completion without naming file changes or verification evidence. Never claim completion without both.";
  }

  if ((agentId === "nova" || agentId === "sentinel") && !/\b(confirmed|assum|evidence|verify|unknown|provided)\b/i.test(text)) {
    return "The previous high-stakes brief did not clearly separate confirmed evidence from assumptions. Label both in the next answer.";
  }

  return null;
}

export function recordAgentSelfReview(agentId, note) {
  if (!note) return getAgentLearning(agentId);
  const store = readStore();
  const record = agentRecord(store, agentId);
  const text = `Self-review correction: ${trimText(note, 700)}`;
  if (!record.lessons.slice(0, 6).some((lesson) => lesson.text === text)) {
    record.lessons.unshift({
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      outcome: "self-review",
      text,
    });
    record.lessons = record.lessons.slice(0, MAX_LESSONS);
    record.corrections += 1;
    writeStore(store);
  }
  return getAgentLearning(agentId);
}

export function getAgentLearning(agentId) {
  const store = readStore();
  const record = agentRecord(store, agentId);
  const resolved = record.wins + record.losses;
  return {
    runs: record.runs.length,
    lessons: record.lessons.length,
    wins: record.wins,
    losses: record.losses,
    corrections: record.corrections,
    winRate: resolved ? Math.round((record.wins / resolved) * 100) : null,
    recentLessons: record.lessons.slice(0, 6),
    recentRuns: record.runs.slice(0, 3),
  };
}

export function getAllAgentLearning(agentIds) {
  return Object.fromEntries(agentIds.map((agentId) => [agentId, getAgentLearning(agentId)]));
}

export function buildLearningContext(agentId) {
  const learning = getAgentLearning(agentId);
  if (!learning.recentLessons.length && !learning.recentRuns.length) {
    return "No validated lessons are recorded yet. Treat this as a fresh task and state uncertainty clearly.";
  }

  const lessons = learning.recentLessons.length
    ? learning.recentLessons.map((lesson, index) => `${index + 1}. ${lesson.text}`).join("\n")
    : "No validated outcome lessons yet.";
  const recent = learning.recentRuns.length
    ? learning.recentRuns.map((run, index) => {
      const answer = trimText(run.response, 320);
      const feedback = run.feedback ? ` Operator feedback: ${trimText(run.feedback, 260)}` : "";
      return `${index + 1}. Directive: ${run.command}\n   Previous answer: ${answer}\n   Outcome: ${run.outcome}.${feedback}`;
    }).join("\n")
    : "No recent runs.";

  return `Validated lessons:\n${lessons}\nRecent task journal:\n${recent}`;
}
