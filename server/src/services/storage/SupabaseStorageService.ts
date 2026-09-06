import { env } from "../../lib/env.js";
import type { StorageService } from "./StorageService.js";

const API_BASE = `${env.supabaseUrl}/storage/v1`;
const AUTH_HEADERS = {
  Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
  apikey: env.supabaseServiceRoleKey,
};

function objectUrl(relativePath: string): string {
  return `${API_BASE}/object/${env.supabaseStorageBucket}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

export class SupabaseStorageService implements StorageService {
  async save(relativePath: string, contents: Buffer): Promise<string> {
    const res = await fetch(objectUrl(relativePath), {
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/octet-stream", "x-upsert": "true" },
      body: contents,
    });
    if (!res.ok) {
      throw new Error(`Supabase Storage upload failed (${res.status}): ${await res.text()}`);
    }
    return `/storage/${relativePath.replace(/\\/g, "/")}`;
  }

  async read(relativePath: string): Promise<Buffer> {
    const res = await fetch(objectUrl(relativePath), { headers: AUTH_HEADERS });
    if (!res.ok) {
      throw new Error(`Supabase Storage read failed (${res.status}) for ${relativePath}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(relativePath: string): Promise<void> {
    await fetch(`${API_BASE}/object/${env.supabaseStorageBucket}`, {
      method: "DELETE",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [relativePath] }),
    });
  }

  async deleteDir(relativePath: string): Promise<void> {
    const files = await this.list(relativePath);
    if (files.length === 0) return;
    await fetch(`${API_BASE}/object/${env.supabaseStorageBucket}`, {
      method: "DELETE",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: files.map((f) => `${relativePath}/${f}`) }),
    });
  }

  async list(dirPath: string): Promise<string[]> {
    const entries: string[] = [];

    async function walk(prefix: string) {
      const res = await fetch(`${API_BASE}/object/list/${env.supabaseStorageBucket}`, {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000 }),
      });
      if (!res.ok) return;
      const items = (await res.json()) as { name: string; id: string | null }[];
      for (const item of items) {
        const rel = prefix ? `${prefix}/${item.name}` : item.name;
        // Supabase Storage has no real directories — a listing entry with a null `id` is a
        // "folder" placeholder rather than an actual object, so descend into it instead of
        // treating it as a file.
        if (item.id === null) {
          await walk(rel);
        } else {
          entries.push(rel.slice(dirPath ? dirPath.length + 1 : 0));
        }
      }
    }

    await walk(dirPath);
    return entries;
  }
}
