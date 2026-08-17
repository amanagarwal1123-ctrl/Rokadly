import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Race-safe async data loader.
 * - Clears stale data the moment dependencies change (never shows old figures under a new selection)
 * - A monotonically increasing sequence guard prevents late responses from
 *   overwriting a newer store/date selection
 * - Exposes { data, loading, error, reload } for loading / success / empty / error states
 *
 * fetchFn may return `null` to signal "nothing to fetch" (e.g. missing store/date),
 * which renders as an empty/validation state rather than stale data.
 */
export const useAsyncData = (fetchFn, deps) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++seq.current;
    setState({ data: null, loading: true, error: null });
    try {
      const data = await fetchFn();
      if (seq.current === mySeq) setState({ data, loading: false, error: null });
    } catch (e) {
      if (seq.current === mySeq) setState({ data: null, loading: false, error: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  // Refresh without clearing current data (for post-mutation reloads)
  const refresh = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const data = await fetchFn();
      if (seq.current === mySeq) setState({ data, loading: false, error: null });
    } catch (e) {
      if (seq.current === mySeq) setState((s) => ({ ...s, loading: false, error: e }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load, refresh };
};

/**
 * Shared, authoritative day-lock state for a (store, business date) pair.
 * Backed by GET /api/store-day. Every ordinary-record page must consult this
 * before rendering mutation controls. Backend ensure_day_open stays the
 * ultimate enforcement.
 */
export const useStoreDayLock = (storeId, businessDate) => {
  const { data, loading, error, reload, refresh } = useAsyncData(
    () => {
      if (!storeId || !businessDate) return Promise.resolve(null);
      return api
        .get("/store-day", { params: { store_id: storeId, business_date: businessDate } })
        .then((r) => r.data.store_day);
    },
    [storeId, businessDate]
  );
  return {
    storeDay: data,
    locked: data?.status === "finalized",
    loading,
    error,
    reload,
    refresh,
  };
};
