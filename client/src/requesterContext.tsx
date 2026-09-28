import { useEffect, useMemo, useState } from "react";
import { getRequesters, Requester } from "./api.js";

const STORAGE_KEY = "toktickit.devRequesterId";

export type RequesterState = "loading" | "ready" | "empty" | "error";

export function useRequesterContext(fixedRequester?: Requester) {
  const [requesters, setRequesters] = useState<Requester[]>(fixedRequester ? [fixedRequester] : []);
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(fixedRequester ?? null);
  const [state, setState] = useState<RequesterState>(fixedRequester ? "ready" : "loading");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadRequesters() {
    if (fixedRequester) {
      setRequesters([fixedRequester]);
      setSelectedRequester(fixedRequester);
      setState("ready");
      setErrorMessage("");
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const activeRequesters = await getRequesters();
      setRequesters(activeRequesters);

      if (activeRequesters.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedRequester(null);
        setState("empty");
        return;
      }

      const storedId = localStorage.getItem(STORAGE_KEY);
      const storedRequester = activeRequesters.find((requester) => String(requester.id) === storedId);

      if (storedId && storedRequester) {
        setSelectedRequester(storedRequester);
      } else if (storedId) {
        localStorage.removeItem(STORAGE_KEY);
        setSelectedRequester(null);
      }

      setState("ready");
    } catch (error) {
      setRequesters([]);
      setSelectedRequester(null);
      localStorage.removeItem(STORAGE_KEY);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Development Requesters.");
      setState("error");
    }
  }

  useEffect(() => {
    void loadRequesters();
  }, [fixedRequester?.id, fixedRequester?.name, fixedRequester?.email]);

  const value = useMemo(
    () => ({
      errorMessage,
      reloadRequesters: loadRequesters,
      requesters,
      selectRequester(requesterId: string) {
        if (fixedRequester) {
          return String(fixedRequester.id) === requesterId ? fixedRequester : null;
        }
        const requester = requesters.find((item) => String(item.id) === requesterId) ?? null;
        if (requester) {
          localStorage.setItem(STORAGE_KEY, String(requester.id));
          setSelectedRequester(requester);
        }
        return requester;
      },
      selectedRequester,
      state,
      changeRequester() {
        if (fixedRequester) return;
        localStorage.removeItem(STORAGE_KEY);
        setSelectedRequester(null);
      },
    }),
    [errorMessage, fixedRequester, requesters, selectedRequester, state],
  );

  return value;
}
