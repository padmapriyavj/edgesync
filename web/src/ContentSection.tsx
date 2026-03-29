import { useCallback, useEffect, useState } from "react";
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
} from "./api";
import type { ContentRow } from "./types";

export function ContentSection() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listContent();
      setRows(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createContent({ title, slug, body, tags: tagList });
      setTitle("");
      setSlug("");
      setBody("");
      setTags("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await updateContent(editing.id, { title: editTitle, body: editBody });
      setEditing(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function startEdit(row: ContentRow) {
    setEditing(row);
    setEditTitle(row.title);
    setEditBody(row.body);
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete content #${id}? This publishes an invalidation event.`)) return;
    setError(null);
    try {
      await deleteContent(id);
      if (editing?.id === id) setEditing(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid-2">
      <div className="panel">
        <h2>Create content</h2>
        <p className="muted" style={{ marginTop: "-0.5rem" }}>
          New rows are stored at the origin only. Edges populate on first read.
        </p>
        <form onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="c-title">Title</label>
            <input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="c-slug">Slug</label>
            <input
              id="c-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="c-body">Body</label>
            <textarea
              id="c-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="c-tags">Tags (comma-separated)</label>
            <input
              id="c-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tutorial, caching"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Library</h2>
        {error ? <p className="err">{error}</p> : null}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Version</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.title}</td>
                    <td>{r.version}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                          onClick={() => void onDelete(r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: "0.75rem" }}
          onClick={() => void refresh()}
        >
          Refresh list
        </button>
      </div>

      {editing ? (
        <div className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2>
            Update #{editing.id} <span className="muted">— invalidates cache via Kafka</span>
          </h2>
          <form onSubmit={onUpdate}>
            <div className="field">
              <label htmlFor="e-title">Title</label>
              <input
                id="e-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="e-body">Body</label>
              <textarea
                id="e-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                required
              />
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn-primary">
                Save &amp; invalidate
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
