import { useEffect, useState } from "react";

function readMetrics(previous) {
  const memory = performance.memory;
  const memoryPercent = memory?.jsHeapSizeLimit
    ? Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    : Math.max(42, Math.min(78, previous.memory + Math.round(Math.random() * 4 - 2)));
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const network = connection?.effectiveType?.toUpperCase() || (navigator.onLine ? "ONLINE" : "OFFLINE");
  const cpu = Math.max(18, Math.min(74, previous.cpu + Math.round(Math.random() * 8 - 4)));
  return { cpu, memory: memoryPercent, network, cores: navigator.hardwareConcurrency || "—" };
}

export default function useSystemMetrics() {
  const [metrics, setMetrics] = useState({ cpu: 32, memory: 58, network: navigator.onLine ? "ONLINE" : "OFFLINE", cores: navigator.hardwareConcurrency || "—" });

  useEffect(() => {
    const update = () => setMetrics((current) => readMetrics(current));
    const timer = window.setInterval(update, 2600);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return metrics;
}
