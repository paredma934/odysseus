import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import HudOverlay from "./components/HudOverlay";
import JarvisScene from "./components/JarvisScene";
import VoiceConsole from "./components/VoiceConsole";
import HeadquartersEcosystem from "./components/HeadquartersEcosystem";
import { agents } from "./data/agents";
import useCinematicVoice from "./hooks/useCinematicVoice";
import useJarvisState from "./hooks/useJarvisState";
import { checkLocalAI, getLocalAIConfig, runLocalAgent } from "./services/odysseusAgentBridge";
import { auditAgentResponse, detectLearningFeedback, getAllAgentLearning, recordAgentFeedback, recordAgentRun, recordAgentSelfReview } from "./services/agentLearning";
import { connectBlofinCredentials, disconnectBlofinCredentials, formatBlofinVegaContext, getBlofinAccountOverview, getBlofinSnapshot, getBlofinStatus } from "./services/blofinBridge";

const routes = [
  { agentId: "zeus", words: ["code", "build", "fix", "website", "interface", "mission control", "zeus"], task: "Engineering Mission Control" },
  { agentId: "vega", words: ["market", "trade", "option", "crypto", "stock", "blofin", "bitcoin", "btc", "vega"], task: "Scanning BloFin markets and liquidity" },
  { agentId: "atlas", words: ["research", "learn", "source", "data", "atlas"], task: "Researching sources and intelligence" },
  { agentId: "echo", words: ["memory", "remember", "knowledge", "history", "echo"], task: "Indexing long-term memory" },
  { agentId: "nova", words: ["budget", "bill", "spending", "finance", "money", "nova"], task: "Analyzing budgets and cash flow" },
  { agentId: "aura", words: ["etsy", "ebay", "tiktok", "marketing", "social", "content", "aura"], task: "Building product and content campaigns" },
  { agentId: "sentinel", words: ["security", "backup", "network", "access", "sentinel"], task: "Monitoring security and backups" },
  { agentId: "hermes", words: ["home", "media", "movie", "music", "immich", "jellyfin", "automation", "hermes"], task: "Coordinating home and media services" },
];

const rundownWords = ["operations", "rundown", "status report", "briefing", "what are my agents doing", "agency status"];
const wakeCommandPattern = /^hey[\s,]+jarvis\b[,\s]*/i;
const operatorNameQuestion = /\b(who am i|what(?:'s| is) my name|do you know my name)\b/i;
const operatorNameUpdate = /^(?:my name is|call me)\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*)?)\s*[.!]?$/i;
const defaultOperatorName = "Manuel";

const now = () => new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());

const initialLogs = [
  { id: 1, time: "BOOT", source: "JARVIS", message: "Agent headquarters online. Voice and command routing ready.", color: "#72eaff" },
  { id: 2, time: "BOOT", source: "SYSTEM", message: "Operations floor, Conference Room, and JARVIS Office synchronized.", color: "#a8bbca" },
];

function formatOperatorName(value) {
  return value.trim().split(/\s+/).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join(" ").slice(0, 32);
}

function loadOperatorName() {
  try {
    return formatOperatorName(window.localStorage.getItem("jarvis.operatorName") || defaultOperatorName);
  } catch {
    return defaultOperatorName;
  }
}

function loadVoiceOutputPreference() {
  try {
    return window.localStorage.getItem("jarvis.voiceOutputEnabled") !== "false";
  } catch {
    return true;
  }
}

export default function App() {
  const { state: jarvisState, setState: setJarvisState } = useJarvisState();
  const [mode, setMode] = useState("headquarters");
  const [selectedAgentId, setSelectedAgentId] = useState("zeus");
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [currentTask, setCurrentTask] = useState("Awaiting directive");
  const [taskProgress, setTaskProgress] = useState(0);
  const [rundownOpen, setRundownOpen] = useState(false);
  const [operatorName, setOperatorName] = useState(loadOperatorName);
  const [lastResponse, setLastResponse] = useState(() => `Good evening, ${loadOperatorName()}. All eight intelligence agents are standing by.`);
  const [logs, setLogs] = useState(initialLogs);
  const [voiceEnabled, setVoiceEnabled] = useState(loadVoiceOutputPreference);
  const [voiceStatus, setVoiceStatus] = useState({ enabled: false, active: false, permission: "prompt", engine: "browser-fallback", error: "" });
  const [localAI, setLocalAI] = useState(() => ({ status: "checking", detail: "Checking local model", ...getLocalAIConfig() }));
  const [blofin, setBlofin] = useState(() => ({ status: "checking", environment: "demo", credentialsConfigured: false, execution: "locked", snapshot: null, account: null, detail: "Checking BloFin bridge" }));
  const [agentLearning, setAgentLearning] = useState(() => getAllAgentLearning(agents.map((agent) => agent.id)));
  const taskRef = useRef(0);
  const requestRef = useRef();
  const wakeEnabledRef = useRef(false);
  const { speak, cancel: cancelVoice, voiceName, isSpeaking: voiceSpeaking } = useCinematicVoice(voiceEnabled);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  function standbyOrbState() {
    return wakeEnabledRef.current ? "wake-listening" : "sleeping";
  }

  const handleVoiceStatusChange = useCallback((status) => {
    wakeEnabledRef.current = status.enabled;
    setVoiceStatus((current) => (
      current.enabled === status.enabled
      && current.active === status.active
      && current.permission === status.permission
      && current.engine === status.engine
      && current.error === status.error
        ? current
        : status
    ));
    if (activeAgentId) return;
    setJarvisState((current) => {
      if (["wake-detected", "command-listening", "thinking", "speaking"].includes(current)) return current;
      if (status.error && status.permission === "denied") return "error";
      return status.enabled ? "wake-listening" : "sleeping";
    });
  }, [activeAgentId, setJarvisState]);

  const refreshBlofin = useCallback(async () => {
    setBlofin((current) => ({ ...current, status: "checking", detail: "Refreshing BloFin" }));
    try {
      const [status, snapshot] = await Promise.all([getBlofinStatus(), getBlofinSnapshot("BTC-USDT")]);
      let account = null;
      if (status.credentialsConfigured) {
        try {
          account = await getBlofinAccountOverview();
        } catch {
          // Public market intelligence stays online if a READ credential expires.
        }
      }
      setBlofin({ ...status, status: "online", detail: status.message, snapshot, account });
      return { status, snapshot, account };
    } catch (error) {
      setBlofin((current) => ({ ...current, status: "offline", detail: error.message }));
      throw error;
    }
  }, []);

  useEffect(() => () => {
    cancelVoice();
    requestRef.current?.abort();
  }, [cancelVoice]);

  useEffect(() => {
    let disposed = false;

    const probe = async () => {
      try {
        const status = await checkLocalAI();
        if (!disposed) setLocalAI(status);
      } catch (error) {
        if (!disposed) setLocalAI((current) => ({ ...current, status: error.code === "AUTH" ? "auth-required" : "offline", detail: error.message, model: error.model || current.model }));
      }
    };

    probe();
    const interval = window.setInterval(probe, 20000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    refreshBlofin().catch(() => {});
    const interval = window.setInterval(() => refreshBlofin().catch(() => {}), 30000);
    return () => window.clearInterval(interval);
  }, [refreshBlofin]);
  useEffect(() => {
    try {
      window.localStorage.setItem("jarvis.operatorName", operatorName);
    } catch {
      // The operator profile still remains available for this session.
    }
  }, [operatorName]);

  function addLog(source, message, color) {
    setLogs((current) => [...current, { id: `${Date.now()}-${Math.random()}`, time: now(), source, message, color }].slice(-8));
  }

  function refreshLearning() {
    setAgentLearning(getAllAgentLearning(agents.map((agent) => agent.id)));
  }

  function answerOperator(command, response) {
    const taskId = taskRef.current + 1;
    taskRef.current = taskId;
    cancelVoice();
    setRundownOpen(false);
    setActiveAgentId(null);
    setTaskProgress(0);
    setCurrentTask("Operator profile ready");
    setJarvisState("speaking");
    setLastResponse(response);
    addLog("YOU", command, "#ffffff");
    addLog("JARVIS", response, "#72eaff");

    let settled = false;
    const finish = () => {
      if (settled || taskRef.current !== taskId) return;
      settled = true;
      setJarvisState(standbyOrbState());
    };
    if (voiceEnabled && speak(response, finish)) window.setTimeout(finish, Math.max(2600, response.length * 62));
    else window.setTimeout(finish, 1400);
  }

  function settleTask(taskId, agent, response) {
    if (taskRef.current !== taskId) return;
    setLastResponse(response);
    setJarvisState("speaking");
    setTaskProgress(100);
    addLog("JARVIS", response, "#72eaff");

    let settled = false;
    const finish = () => {
      if (settled || taskRef.current !== taskId) return;
      settled = true;
      setActiveAgentId(null);
      setJarvisState(standbyOrbState());
      setTaskProgress(0);
      setCurrentTask(`${agent.name} ready for the next directive`);
    };

    if (voiceEnabled && speak(response, finish)) {
      window.setTimeout(finish, Math.max(4200, response.length * 62));
    } else {
      window.setTimeout(finish, 2300);
    }
  }

  async function executeAgentCommand(command, route, agent) {
    const taskId = taskRef.current + 1;
    taskRef.current = taskId;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    cancelVoice();
    setRundownOpen(false);
    setSelectedAgentId(agent.id);
    setFocusedAgentId(agent.id);
    setMode("headquarters");
    setJarvisState("command-listening");
    setTaskProgress(12);
    setLastResponse(`Command received. Routing to ${agent.name} on the local intelligence link.`);
    addLog("YOU", command, "#ffffff");

    const feedback = detectLearningFeedback(command, agent.id);
    if (feedback) {
      recordAgentFeedback(feedback);
      refreshLearning();
      addLog("LEARNING", `${agent.name} recorded a ${feedback.outcome} outcome for future decisions.`, "#b77cff");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 420));
    if (taskRef.current !== taskId) return;
    setJarvisState("thinking");
    setActiveAgentId(agent.id);
    setCurrentTask(route.task);
    setTaskProgress(52);
    addLog(agent.name.toUpperCase(), `${route.task} // ${localAI.model}`, agent.color);

    const progressTimer = window.setTimeout(() => {
      if (taskRef.current === taskId) setTaskProgress(78);
    }, 1400);

    try {
      let verifiedContext = "";
      if (agent.id === "vega") {
        try {
          const snapshot = await getBlofinSnapshot("BTC-USDT");
          verifiedContext = formatBlofinVegaContext(snapshot);
          setBlofin((current) => ({ ...current, status: "online", snapshot, detail: "Live BloFin market data verified" }));
          addLog("BLOFIN", `${snapshot.instId} ${snapshot.last} // live market context delivered to Vega`, "#35d8ff");
        } catch (error) {
          addLog("BLOFIN", `${error.message} Vega must not invent current market conditions.`, "#ff9c64");
        }
      }
      const result = await runLocalAgent({ agent, command, operatorName, verifiedContext, signal: controller.signal });
      if (taskRef.current !== taskId) return;
      setLocalAI({ status: "online", detail: "Local model responding", model: result.model, sessionId: result.sessionId });
      if (!feedback) {
        recordAgentRun(agent.id, command, result.answer);
        const selfReview = auditAgentResponse(agent.id, result.answer);
        if (selfReview) {
          recordAgentSelfReview(agent.id, selfReview);
          addLog(`${agent.name.toUpperCase()} SELF-CHECK`, selfReview, "#b77cff");
        }
        refreshLearning();
      }
      settleTask(taskId, agent, result.answer);
    } catch (error) {
      if (taskRef.current !== taskId) return;
      const connectionState = error.code === "OFFLINE" || error.code === "TIMEOUT" ? "offline" : "error";
      setLocalAI((current) => ({ ...current, status: connectionState, detail: error.message }));
      addLog("LOCAL AI", error.message, "#ff6474");
      const response = `${error.message} Start Ollama and Odysseus, then try the directive again. No simulated agent result was substituted.`;
      settleTask(taskId, agent, response);
    } finally {
      window.clearTimeout(progressTimer);
      if (requestRef.current === controller) requestRef.current = undefined;
    }
  }

  function dispatch(command) {
    let request = command.trim();
    if (wakeCommandPattern.test(request)) {
      request = request.replace(wakeCommandPattern, "").trim();
      handleWakeWord(Boolean(request));
      if (!request) return;
    }

    const nameUpdate = request.match(operatorNameUpdate);
    if (nameUpdate) {
      const nextName = formatOperatorName(nameUpdate[1]);
      setOperatorName(nextName);
      answerOperator(request, `Understood. I will call you ${nextName}. Your operator profile has been updated.`);
      return;
    }
    if (operatorNameQuestion.test(request)) {
      answerOperator(request, `You are ${operatorName}, the primary operator of this JARVIS system.`);
      return;
    }

    const text = request.toLowerCase();
    if (rundownWords.some((phrase) => text.includes(phrase))) {
      runRundown(request);
      return;
    }
    const namedRoute = routes.find((candidate) => new RegExp(`\\b${candidate.agentId}\\b`, "i").test(request));
    const learningSignal = detectLearningFeedback(request, selectedAgentId);
    const learningRoute = learningSignal ? routes.find((candidate) => candidate.agentId === learningSignal.agentId) : null;
    const route = namedRoute ?? learningRoute ?? routes.find((candidate) => candidate.words.some((word) => text.includes(word))) ?? routes.find((candidate) => candidate.agentId === "atlas");
    const agent = agents.find((candidate) => candidate.id === route.agentId);
    executeAgentCommand(request, route, agent);
  }

  function focusAgent(agent) {
    const route = routes.find((candidate) => candidate.agentId === agent.id);
    executeAgentCommand(`Give me your current ${agent.shortRole.toLowerCase()} intelligence brief and the most useful next action.`, route, agent);
  }

  function inspectAgent(agent) {
    setSelectedAgentId(agent.id);
    setFocusedAgentId(agent.id);
    setMode("headquarters");
    setRundownOpen(false);
    setLastResponse(`${agent.name} profile selected. ${agent.personality}`);
  }

  function runRundown(command = "Quick rundown requested") {
    const taskId = taskRef.current + 1;
    const lessonCount = Object.values(agentLearning).reduce((total, learning) => total + learning.lessons, 0);
    const bridgeReport = localAI.status === "online" ? `${localAI.model} is online through the private Odysseus session` : `the local AI bridge is ${localAI.status}`;
    const response = `Operations overview, ${operatorName}. Mission Control is online, ${bridgeReport}, and eight specialized agents are ready. Their adaptive journals currently contain ${lessonCount} validated lessons. External publishing, financial transfers, and live trading remain approval-only.`;
    taskRef.current = taskId;
    cancelVoice();
    setMode("headquarters");
    setFocusedAgentId(null);
    setRundownOpen(true);
    setActiveAgentId(null);
    setCurrentTask("Compiling all-agent operations brief");
    setJarvisState("command-listening");
    setTaskProgress(18);
    setLastResponse("Compiling the JARVIS operations overview.");
    addLog("YOU", command, "#ffffff");

    window.setTimeout(() => {
      if (taskRef.current !== taskId) return;
      setJarvisState("thinking");
      setTaskProgress(68);
      addLog("JARVIS", "Compiling configured agent profiles and session activity.", "#72eaff");
    }, 480);

    window.setTimeout(() => {
      if (taskRef.current !== taskId) return;
      setJarvisState("speaking");
      setTaskProgress(100);
      setLastResponse(response);
      addLog("JARVIS", response, "#72eaff");

      let settled = false;
      const finish = () => {
        if (settled || taskRef.current !== taskId) return;
        settled = true;
        setJarvisState(standbyOrbState());
        setTaskProgress(0);
        setCurrentTask("Rundown complete");
      };

      if (voiceEnabled && speak(response, finish)) {
        window.setTimeout(finish, Math.max(5200, response.length * 62));
      } else {
        window.setTimeout(finish, 2600);
      }
    }, 1750);
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setFocusedAgentId(null);
    if (nextMode === "earth") setRundownOpen(false);
  }

  function activateCore() {
    setJarvisState("command-listening");
    setLastResponse("Voice link open. I am listening.");
    window.setTimeout(() => setJarvisState((current) => current === "command-listening" ? standbyOrbState() : current), 2200);
  }

  function handleWakeWord(hasDirective = false) {
    cancelVoice();
    setJarvisState("wake-detected");
    window.setTimeout(() => setJarvisState((current) => current === "wake-detected" ? "command-listening" : current), 520);
    const response = hasDirective ? `Wake word confirmed, ${operatorName}. Executing your directive.` : `Yes, ${operatorName}. I'm listening.`;
    setLastResponse(response);
    addLog("JARVIS", hasDirective ? "Wake word recognized with directive." : "Wake word recognized. Command channel open.", "#72eaff");
    if (!hasDirective && voiceEnabled) return speak(`Yes, ${operatorName}?`, undefined, true);
    return false;
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try { window.localStorage.setItem("jarvis.voiceOutputEnabled", String(next)); } catch { /* Session state remains available. */ }
    const message = next ? `British voice profile online. Good evening, ${operatorName}.` : "Voice output muted.";
    setLastResponse(message);
    if (next) speak(message, undefined, true);
  }

  async function connectBlofin(credentials) {
    setBlofin((current) => ({ ...current, status: "checking", detail: "Verifying signed BloFin READ access" }));
    const status = await connectBlofinCredentials(credentials);
    addLog("BLOFIN", `${status.environment.toUpperCase()} READ-only account link verified. Execution remains locked.`, "#35d8ff");
    return refreshBlofin();
  }

  async function disconnectBlofin() {
    const status = await disconnectBlofinCredentials();
    setBlofin((current) => ({ ...current, ...status, account: null, detail: status.message }));
    addLog("BLOFIN", "Encrypted account link disconnected. Public market data remains online.", "#7b9aa7");
    return refreshBlofin();
  }

  return (
    <main className={`mission-shell mode-${mode}`}>
      {mode === "headquarters" ? (
        <HeadquartersEcosystem agents={agents} activeAgentId={activeAgentId} jarvisState={jarvisState} onSelectAgent={inspectAgent} onCoreActivate={activateCore} onEarthMode={() => changeMode("earth")} />
      ) : (
        <JarvisScene mode={mode} agents={agents} activeAgentId={activeAgentId} selectedAgentId={selectedAgentId} focusedAgentId={focusedAgentId} jarvisState={jarvisState} onSelectAgent={inspectAgent} onCoreActivate={activateCore} onEarthMode={() => changeMode("earth")} onHeadquartersMode={() => changeMode("headquarters")} />
      )}
      <div className="screen-vignette" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <HudOverlay mode={mode} agents={agents} selectedAgent={selectedAgent} focusedAgentId={focusedAgentId} activeAgentId={activeAgentId} jarvisState={jarvisState} currentTask={currentTask} taskProgress={taskProgress} logs={logs} voiceEnabled={voiceEnabled} voiceName={voiceName} voiceStatus={voiceStatus} operatorName={operatorName} rundownOpen={rundownOpen} localAI={localAI} blofin={blofin} agentLearning={agentLearning} onToggleVoice={toggleVoice} onModeChange={changeMode} onClearFocus={() => setFocusedAgentId(null)} onRundown={() => runRundown("Open the Operations overview")} onCloseRundown={() => setRundownOpen(false)} onSelectAgent={inspectAgent} onRunAgent={focusAgent} onRefreshBlofin={() => refreshBlofin().catch(() => {})} onConnectBlofin={connectBlofin} onDisconnectBlofin={disconnectBlofin} />
      <VoiceConsole jarvisState={jarvisState} lastResponse={lastResponse} speechActive={voiceSpeaking} onCommand={dispatch} onWake={handleWakeWord} onVoiceStatusChange={handleVoiceStatusChange} onListeningChange={(listening) => {
        if (listening) setJarvisState("command-listening");
        else if (!activeAgentId) setJarvisState(standbyOrbState());
      }} />
    </main>
  );
}
