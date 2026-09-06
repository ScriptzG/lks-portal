import { env } from "../../lib/env.js";
import type { StorageService } from "./StorageService.js";
import { LocalDiskStorage } from "./LocalDiskStorage.js";
import { SupabaseStorageService } from "./SupabaseStorageService.js";

// Render's (and most PaaS free tiers') disk is ephemeral — anything written to it is lost on the
// next restart or redeploy. Supabase Storage is used whenever it's configured so uploaded website
// files, documents, and branding assets actually persist; LocalDiskStorage remains for local dev.
export const storageService: StorageService =
  env.supabaseUrl && env.supabaseServiceRoleKey ? new SupabaseStorageService() : new LocalDiskStorage();
