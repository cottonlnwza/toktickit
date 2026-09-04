import { useEffect, useMemo, useState } from "react";
import { getRequesters, Requester } from "./api.js";

const STORAGE_KEY = "toktickit.devRequesterId";

export type RequesterState = "loading" | "ready" | "empty" | "error";

export function useRequesterContext() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);
  const [state, setState] = useState<RequesterState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadRequesters() {
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
  }, []);

  const value = useMemo(
    () => ({
      errorMessage,
      reloadRequesters: loadRequesters,
      requesters,
      selectRequester(requesterId: string) {
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
        localStorage.removeItem(STORAGE_KEY);
        setSelectedRequester(null);
      },
    }),
    [errorMessage, requesters, selectedRequester, state],
  );

  return value;
}
