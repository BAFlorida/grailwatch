import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Tiny fetch hook: pass null to pause. refetch() reloads in place. */
export function useApi<T>(path: string | null): ApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: path !== null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    getJson<T>(path)
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (alive) {
          setState({
            data: null,
            error: err instanceof Error ? err.message : String(err),
            loading: false,
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [path, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refetch };
}
