import fs from "node:fs/promises";
import path from "node:path";
import type { StorageService } from "./StorageService.js";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

function resolvePath(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export class LocalDiskStorage implements StorageService {
  async save(relativePath: string, contents: Buffer): Promise<string> {
    const full = resolvePath(relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents);
    return `/storage/${relativePath.replace(/\\/g, "/")}`;
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFile(resolvePath(relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await fs.rm(resolvePath(relativePath), { force: true });
  }

  async deleteDir(relativePath: string): Promise<void> {
    await fs.rm(resolvePath(relativePath), { force: true, recursive: true });
  }

  async list(dirPath: string): Promise<string[]> {
    const full = resolvePath(dirPath);
    const entries: string[] = [];

    async function walk(current: string, base: string) {
      let items;
      try {
        items = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of items) {
        const rel = path.join(base, item.name);
        if (item.isDirectory()) {
          await walk(path.join(current, item.name), rel);
        } else {
          entries.push(rel.replace(/\\/g, "/"));
        }
      }
    }

    await walk(full, "");
    return entries;
  }
}
