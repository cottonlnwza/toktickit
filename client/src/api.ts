const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export async function getRequesters(): Promise<Requester[]> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/requesters`);
  } catch {
    throw new Error("Unable to load Development Requesters. Is the API server running?");
  }

  if (!response.ok) {
    throw new Error(`Unable to load Development Requesters. HTTP ${response.status}.`);
  }

  return (await response.json()) as Requester[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  let healthResponse: Response;

  try {
    healthResponse = await fetch(`${API_URL}/api/health`);
  } catch {
    throw new Error("Backend health check failed. Is the API server running?");
  }

  if (!healthResponse.ok) {
    throw new Error(`Backend health check failed with HTTP ${healthResponse.status}.`);
  }

  let categoriesResponse: Response;

  try {
    categoriesResponse = await fetch(`${API_URL}/api/categories`);
  } catch {
    throw new Error("Category list request failed. Is the API server running?");
  }

  if (!categoriesResponse.ok) {
    throw new Error(`Category list request failed with HTTP ${categoriesResponse.status}.`);
  }

  const categories = (await categoriesResponse.json()) as Category[];

  return { online: true, categories };
}
