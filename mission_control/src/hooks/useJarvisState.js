import { useCallback, useState } from "react";
import { isJarvisOrbState } from "../state/jarvisStates";

export default function useJarvisState(initialState = "sleeping") {
  const [state, setInternalState] = useState(initialState);

  const setState = useCallback((nextState) => {
    setInternalState((current) => {
      const resolved = typeof nextState === "function" ? nextState(current) : nextState;
      return isJarvisOrbState(resolved) ? resolved : current;
    });
  }, []);

  return { state, setState };
}
