export interface DeployResult {
  deployUrl: string;
  status: "building" | "live" | "failed";
}

export interface DeployService {
  /** Kicks off a deploy of the given files to the site's host. Returns immediately; status settles asynchronously. */
  deploy(params: {
    netlifySiteId: string | null;
    files: Record<string, string>;
    onSettled: (result: DeployResult) => void;
  }): Promise<{ deployUrl: string }>;
}
