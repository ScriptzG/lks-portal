import { randomUUID } from "node:crypto";
import type { DeployService } from "./DeployService.js";

/**
 * Simulates a Netlify deploy: returns a fake deploy URL immediately, then
 * flips to "live" (or occasionally "failed") after a short delay, mirroring
 * the async Building -> Live/Failed lifecycle a real Netlify deploy has.
 */
export class MockNetlifyService implements DeployService {
  async deploy(params: {
    netlifySiteId: string | null;
    files: Record<string, string>;
    onSettled: (result: { deployUrl: string; status: "building" | "live" | "failed" }) => void;
  }): Promise<{ deployUrl: string }> {
    const siteId = params.netlifySiteId ?? `mock-${randomUUID().slice(0, 8)}`;
    const deployUrl = `https://${siteId}.mock-netlify.app`;

    const delayMs = 2500 + Math.random() * 1500;
    const willFail = Object.keys(params.files).length === 0;

    setTimeout(() => {
      params.onSettled({
        deployUrl,
        status: willFail ? "failed" : "live",
      });
    }, delayMs);

    return { deployUrl };
  }
}

export const deployService: DeployService = new MockNetlifyService();
