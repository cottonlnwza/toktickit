import { useState } from "react";
import { checkSystem, Category } from "./api.js";
import { useRequesterContext } from "./requesterContext.js";
import "./App.css";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const requesterContext = useRequesterContext();
  const [pendingRequesterId, setPendingRequesterId] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (error) {
      setCategories([]);
      setErrorMessage(error instanceof Error ? error.message : "Backend health check failed.");
      setState("error");
    }
  }

  function handleContinue() {
    const requester = requesterContext.selectRequester(pendingRequesterId);
    if (requester) {
      setSelectionError("");
    } else {
      setSelectionError("Please select a Development Requester.");
    }
  }

  const showSelector = !requesterContext.selectedRequester;

  return (
    <div className="toktickit-app">
      <header className="app-shell">
        <div>
          <h1>TokTickIT IT Service Desk</h1>
          <nav aria-label="Primary navigation">
            <a href="#my-tickets">My Tickets</a>
            <a href="#create-ticket">Create Ticket</a>
          </nav>
        </div>
        <div className="requester-display">
          {requesterContext.selectedRequester ? (
            <>
              <span>Requester: {requesterContext.selectedRequester.name}</span>
              <button className="btn btn-outline-light btn-sm" onClick={requesterContext.changeRequester}>
                Change Requester
              </button>
            </>
          ) : (
            <span>No requester set</span>
          )}
        </div>
      </header>

      <main className="container py-5">
        {showSelector ? (
          <section className="requester-panel" aria-labelledby="requester-heading">
            <h2 id="requester-heading">Select Development Requester</h2>
            <p>
              This selector is for Lab 2 testing only. It is not a login screen. Authentication and
              role-based access will be introduced in Lab 3.
            </p>

            {requesterContext.state === "loading" && (
              <div className="alert alert-info" role="status">
                Loading active requesters...
              </div>
            )}

            {requesterContext.state === "empty" && (
              <div className="alert alert-warning" role="status">
                No active Development Requesters are available.
              </div>
            )}

            {requesterContext.state === "error" && (
              <div className="alert alert-danger" role="alert">
                Unable to load Development Requesters.
                {requesterContext.errorMessage && <span> {requesterContext.errorMessage}</span>}
              </div>
            )}

            <label className="form-label" htmlFor="requester-select">
              Development Requester <span className="required-marker">*</span>
            </label>
            <select
              id="requester-select"
              className={`form-select ${selectionError ? "is-invalid" : ""}`}
              value={pendingRequesterId}
              disabled={requesterContext.state !== "ready"}
              onChange={(event) => {
                setPendingRequesterId(event.target.value);
                setSelectionError("");
              }}
            >
              <option value="">Select an active requester...</option>
              {requesterContext.requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name} ({requester.email})
                </option>
              ))}
            </select>
            {selectionError && <div className="invalid-feedback d-block">{selectionError}</div>}

            <button
              className="btn btn-success mt-4"
              disabled={requesterContext.state !== "ready" || !pendingRequesterId}
              onClick={handleContinue}
            >
              Continue
            </button>
          </section>
        ) : (
          <section className="requester-panel" aria-label="Requester workspace">
            <h2>Requester Workspace</h2>
            <p>Requester context is active for Lab 2 testing.</p>
          </section>
        )}

        <section className="system-check-panel" aria-label="System check">
          <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
            {state === "loading" ? "Loading…" : "Check System"}
          </button>

          {state === "loading" && (
            <div className="alert alert-info mt-4" role="status">
              Checking backend health…
            </div>
          )}

          {state === "success" && (
            <div className="alert alert-success mt-4" role="status">
              <p className="mb-2">Online: backend health check passed.</p>
              <ul className="mb-0">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            </div>
          )}

          {state === "error" && (
            <div className="alert alert-danger mt-4" role="alert">
              Offline: {errorMessage}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
