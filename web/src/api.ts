import { edgeBases, originBase, type EdgeRegionKey } from "./config";
import type {
  ContentRow,
  EdgeContentResponse,
  HealthPayload,
  MetricsPayload,
} from "./types";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || res.statusText);
  }
}

export async function listContent(): Promise<ContentRow[]> {
  const res = await fetch(`${originBase}/api/content`);
  const data = await parseJson<{ success: boolean; data: ContentRow[] }>(res);
  if (!res.ok || !data.success) throw new Error("Failed to load content");
  return data.data;
}

export async function createContent(body: {
  title: string;
  slug: string;
  body: string;
  tags?: string[];
}): Promise<ContentRow> {
  const res = await fetch(`${originBase}/api/content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; data: ContentRow; error?: string }>(
    res
  );
  if (!res.ok || !data.success) throw new Error(data.error || "Create failed");
  return data.data;
}

export async function updateContent(
  id: number,
  body: { title?: string; body?: string }
): Promise<ContentRow> {
  const res = await fetch(`${originBase}/api/content/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ success: boolean; data: ContentRow; error?: string }>(
    res
  );
  if (!res.ok || !data.success) throw new Error(data.error || "Update failed");
  return data.data;
}

export async function deleteContent(id: number): Promise<void> {
  const res = await fetch(`${originBase}/api/content/${id}`, { method: "DELETE" });
  const data = await parseJson<{ success: boolean; error?: string }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
}

export async function fetchEdgeContent(
  regionKey: EdgeRegionKey,
  id: number
): Promise<EdgeContentResponse> {
  const base = edgeBases[regionKey];
  const res = await fetch(`${base}/api/content/${id}`);
  return parseJson<EdgeContentResponse>(res);
}

export async function fetchEdgeMetrics(
  regionKey: EdgeRegionKey
): Promise<MetricsPayload> {
  const base = edgeBases[regionKey];
  const res = await fetch(`${base}/metrics`);
  return parseJson<MetricsPayload>(res);
}

export async function fetchEdgeHealth(
  regionKey: EdgeRegionKey
): Promise<HealthPayload> {
  const base = edgeBases[regionKey];
  const res = await fetch(`${base}/health`);
  return parseJson<HealthPayload>(res);
}
