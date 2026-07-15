import { useId } from "react";

function MythicCrown({ agent, accent }) {
  switch (agent.mythicAspect) {
    case "atlas":
      return (
        <g className="portrait-regalia">
          <path d="M35 35c9-9 49-9 58 0l-4 8H39z" fill={agent.metalColor} opacity=".9" />
          <circle cx="64" cy="31" r="7" fill="none" stroke={accent} strokeWidth="2" />
          <path d="M57 31h14M64 24v14" stroke={accent} strokeWidth="1" opacity=".7" />
        </g>
      );
    case "athena":
      return (
        <g className="portrait-regalia">
          <path d="M31 50c0-25 13-37 33-37s34 12 34 37l-10-8-48 1z" fill={agent.metalColor} />
          <path d="M64 10l6 30H58z" fill={accent} opacity=".9" />
          <path d="M39 41h50" stroke={accent} strokeWidth="3" opacity=".75" />
        </g>
      );
    case "oracle":
      return <path className="portrait-regalia" d="M20 80c2-44 17-67 44-67s42 23 44 67L91 60c-5-22-13-33-27-33S42 38 37 60z" fill={agent.robeColor} stroke={accent} strokeWidth="2" opacity=".92" />;
    case "zeus":
      return (
        <g className="portrait-regalia">
          <path d="M34 35c3-19 13-27 24-21 7-9 20-4 19 7 12-3 19 9 13 19-17-9-37-10-56-5z" fill={agent.face.hair} />
          <path d="M88 19l-8 13h8l-11 18 4-14h-8z" fill={accent} className="portrait-bolt" />
        </g>
      );
    case "plutus":
      return (
        <g className="portrait-regalia">
          <path d="M35 38l8-15 12 8 9-17 10 17 13-8 7 15z" fill={agent.metalColor} stroke={accent} strokeWidth="1.5" />
          <circle cx="64" cy="25" r="4" fill={accent} />
        </g>
      );
    case "muse":
      return (
        <g className="portrait-regalia">
          <path d="M29 45c5-22 18-33 35-33s32 12 36 34c-8-8-13-11-22-14-13 9-27 11-49 13z" fill={agent.face.hair} />
          <path d="M26 32c7-10 14-15 22-17M82 15c9 5 15 11 19 20" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "aegis":
      return (
        <g className="portrait-regalia">
          <path d="M27 59V36c7-17 19-25 37-25s31 8 38 25v23L90 47v-9H38v9z" fill={agent.metalColor} stroke={accent} strokeWidth="2" />
          <path d="M64 12v23" stroke={accent} strokeWidth="5" />
        </g>
      );
    case "hermes":
      return (
        <g className="portrait-regalia">
          <path d="M34 42c4-20 15-29 30-29s27 9 31 29l-10-5H43z" fill={agent.metalColor} />
          <path d="M36 24L19 12l5 19-13 4 25 5M92 24l17-12-5 19 13 4-25 5" fill={agent.metalColor} stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      );
    default:
      return null;
  }
}

export default function AgentPortrait({ agent, active = false, selected = false, size = "medium" }) {
  const gradientId = useId().replace(/:/g, "");
  const face = agent.face;
  const accent = agent.color;
  const isHelmeted = ["athena", "aegis", "hermes"].includes(agent.mythicAspect);
  const hasBeard = ["atlas", "zeus"].includes(agent.mythicAspect);

  return (
    <span
      className={`agent-portrait portrait-${size} ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
      style={{ "--agent-color": accent, "--blink-delay": `${face.blinkDelay}s` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 128 128" role="presentation">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="38%" r="70%">
            <stop offset="0" stopColor={accent} stopOpacity=".2" />
            <stop offset=".55" stopColor="#06141d" stopOpacity=".94" />
            <stop offset="1" stopColor="#01060a" />
          </radialGradient>
        </defs>
        <circle cx="64" cy="64" r="61" fill={`url(#${gradientId})`} />
        <circle className="portrait-orbit portrait-orbit-one" cx="64" cy="64" r="57" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="4 8" opacity=".42" />
        <circle className="portrait-orbit portrait-orbit-two" cx="64" cy="64" r="51" fill="none" stroke={accent} strokeWidth=".7" strokeDasharray="1 6" opacity=".28" />

        <path d="M20 128c3-26 17-40 44-40s41 14 44 40z" fill={agent.robeColor} stroke={agent.metalColor} strokeWidth="2" />
        <path d="M44 99l20 18 20-18 10 29H34z" fill={agent.metalColor} opacity=".72" />
        <path d="M56 83h16v18H56z" fill={face.skin} />
        <ellipse cx="37" cy="59" rx="5" ry="8" fill={face.skin} />
        <ellipse cx="91" cy="59" rx="5" ry="8" fill={face.skin} />
        <path d="M36 52c1-22 12-34 28-34s27 12 28 34l-4 24c-6 12-14 18-24 18S46 88 40 76z" fill={face.skin} stroke={face.shadow} strokeWidth="1.5" />

        {!isHelmeted && agent.mythicAspect !== "oracle" && agent.mythicAspect !== "zeus" && (
          <path d="M36 48c1-22 12-32 28-32 17 0 27 11 29 31-9-8-19-12-31-13-8 7-17 11-26 14z" fill={face.hair} />
        )}
        <MythicCrown agent={agent} accent={accent} />

        <g className="agent-portrait-eyes">
          <path d="M45 59c4-4 10-4 14 0-4 5-10 5-14 0z" fill="#eafcff" opacity=".9" />
          <path d="M69 59c4-4 10-4 14 0-4 5-10 5-14 0z" fill="#eafcff" opacity=".9" />
          <circle cx="52" cy="59" r="2.7" fill={face.iris} />
          <circle cx="76" cy="59" r="2.7" fill={face.iris} />
          <circle cx="52" cy="59" r="1" fill="#031018" />
          <circle cx="76" cy="59" r="1" fill="#031018" />
        </g>
        <path d="M45 52c4-2 9-2 14 0M69 52c5-2 10-2 14 0" fill="none" stroke={face.hair} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M64 61l-3 10 6 1" fill="none" stroke={face.shadow} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path className="agent-portrait-mouth" d={face.expression === "warm" ? "M56 78c5 4 11 4 16 0" : face.expression === "stern" ? "M56 80h16" : "M57 79c4 2 10 2 14 0"} fill="none" stroke={face.lip} strokeWidth="2" strokeLinecap="round" />

        {hasBeard && <path d={agent.mythicAspect === "zeus" ? "M42 73c6 17 13 26 22 28 10-2 18-12 23-29-6 8-14 12-23 12s-16-4-22-11z" : "M43 75c5 13 12 19 21 21 9-2 16-8 21-21-7 6-14 9-21 9s-14-3-21-9z"} fill={face.hair} opacity=".95" />}
        {agent.mythicAspect === "aegis" && <path d="M38 67l8 17h36l8-17-13 9H51z" fill={agent.metalColor} opacity=".88" />}
        {agent.mythicAspect === "muse" && <><circle cx="35" cy="69" r="3" fill={accent} /><circle cx="93" cy="69" r="3" fill={accent} /></>}
        {agent.mythicAspect === "oracle" && <path d="M46 46c12-8 24-8 36 0" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="3 3" opacity=".7" />}
        {agent.mythicAspect === "plutus" && <circle cx="64" cy="105" r="7" fill="#061018" stroke={accent} strokeWidth="2" />}

        <path className="portrait-scan" d="M18 64h92" stroke={accent} strokeWidth="1.5" opacity="0" />
      </svg>
      <i className="portrait-status" />
    </span>
  );
}
