const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error?.formErrors?.[0] || (typeof data.error === "string" ? data.error : message);
      if (!message && data.error?.fieldErrors) {
        const first = Object.values(data.error.fieldErrors)[0] as string[] | undefined;
        message = first?.[0] ?? "Request failed";
      }
    } catch {
      // ignore, use default message
    }
    throw new ApiError(message || "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  auth: {
    login: (email: string, password: string) => post<{ id: string; email: string; role: string; companyId: string | null }>("/auth/login", { email, password }),
    logout: () => post("/auth/logout"),
    me: () =>
      get<{ id: string; email: string; role: string; companyId: string | null; company: any; tutorialSeenAt: string | null }>(
        "/auth/me",
      ),
    markTutorialSeen: () => post("/auth/tutorial-seen"),
    acceptInvite: (token: string, password: string) => post("/auth/accept-invite", { token, password }),
    getInvite: (token: string) => get<{ email: string; companyName: string | null }>(`/auth/invite/${token}`),
    requestPasswordReset: (email: string) => post("/auth/request-password-reset", { email }),
    resetPassword: (token: string, password: string) => post("/auth/reset-password", { token, password }),
    changePassword: (currentPassword: string, newPassword: string) =>
      post("/auth/change-password", { currentPassword, newPassword }),
  },
  companies: {
    list: (params?: { search?: string; status?: string }) => {
      const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "") as [string, string][];
      const qs = new URLSearchParams(entries).toString();
      return get<any[]>(`/companies${qs ? `?${qs}` : ""}`);
    },
    stats: () => get<{ totalClients: number; activeClients: number; activeSubscriptions: number; mrr: number }>("/companies/stats"),
    get: (id: string) => get<any>(`/companies/${id}`),
    create: (data: any) => post<any>("/companies", data),
    update: (id: string, data: any) => patch<any>(`/companies/${id}`, data),
    remove: (id: string) => del(`/companies/${id}`),
    uploadLogo: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return post<any>(`/companies/${id}/logo`, formData);
    },
  },
  documents: {
    list: (companyId: string) => get<any[]>(`/documents/${companyId}`),
    upload: (companyId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return post<any>(`/documents/${companyId}`, formData);
    },
    remove: (id: string) => del(`/documents/${id}`),
  },
  contacts: {
    list: (companyId?: string) => get<any[]>(`/contacts${companyId ? `?companyId=${companyId}` : ""}`),
    create: (data: any) => post<any>("/contacts", data),
    update: (id: string, data: any) => patch<any>(`/contacts/${id}`, data),
    remove: (id: string) => del(`/contacts/${id}`),
  },
  adminClients: {
    list: () => get<any[]>("/admin/clients"),
    invites: () => get<any[]>("/admin/clients/invites"),
    invite: (email: string, companyId: string) => post<any>("/admin/clients/invite", { email, companyId }),
    create: (email: string, password: string, companyId: string) =>
      post<any>("/admin/clients", { email, password, companyId }),
    suspend: (id: string) => post<any>(`/admin/clients/${id}/suspend`),
    reinstate: (id: string) => post<any>(`/admin/clients/${id}/reinstate`),
    notify: (id: string, message: string) => post<any>(`/admin/clients/${id}/notify`, { message }),
    resetTutorial: (id: string) => post<any>(`/admin/clients/${id}/reset-tutorial`),
  },
  websites: {
    list: (companyId?: string) => get<any[]>(`/websites${companyId ? `?companyId=${companyId}` : ""}`),
    get: (id: string) => get<any>(`/websites/${id}`),
    create: (data: any) => post<any>("/websites", data),
    update: (id: string, data: any) => patch<any>(`/websites/${id}`, data),
    remove: (id: string) => del(`/websites/${id}`),
    lock: (id: string, locked: boolean) => post<any>(`/websites/${id}/lock`, { locked }),
    upload: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("zip", file);
      return post<{ website: any; filesUploaded: number; fieldsFound: number }>(`/websites/${id}/upload`, formData);
    },
    files: (id: string) => get<any[]>(`/websites/${id}/files`),
    readFile: (id: string, filePath: string) =>
      get<{ filePath: string; content: string; encoding: string; mimeType: string | null }>(
        `/websites/${id}/files/${filePath}`,
      ),
    writeFile: (id: string, filePath: string, content: string) => put<any>(`/websites/${id}/files/${filePath}`, { content }),
    deleteFile: (id: string, filePath: string) => del(`/websites/${id}/files/${filePath}`),
    previewUrl: (id: string, opts: { mode?: "draft" | "live"; file?: string; edit?: boolean } = {}) => {
      const params = new URLSearchParams({ mode: opts.mode ?? "draft", t: String(Date.now()) });
      if (opts.file) params.set("file", opts.file);
      if (opts.edit) params.set("edit", "1");
      return `/api/websites/${id}/preview?${params.toString()}`;
    },
    pages: (id: string) => get<{ filePath: string; label: string }[]>(`/websites/${id}/pages`),
    uploadAsset: (id: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return post<{ path: string }>(`/websites/${id}/assets`, formData);
    },
  },
  fields: {
    list: (websiteId: string) => get<any[]>(`/websites/${websiteId}/fields`),
    saveDraft: (websiteId: string, fields: { id: string; draftValue: string }[]) =>
      post(`/websites/${websiteId}/fields/draft`, { fields }),
    requestPublish: (websiteId: string) => post(`/websites/${websiteId}/fields/request-publish`),
  },
  deployments: {
    list: (websiteId: string) => get<any[]>(`/deployments/website/${websiteId}`),
    deploy: (websiteId: string) => post<{ deployment: any; deployUrl: string }>(`/deployments/website/${websiteId}/deploy`),
    rollback: (deploymentId: string) => post<{ deployment: any; deployUrl: string }>(`/deployments/${deploymentId}/rollback`),
  },
  billing: {
    plans: () => get<any[]>("/billing/plans"),
    createPlan: (data: any) => post<any>("/billing/plans", data),
    updatePlan: (id: string, data: any) => patch<any>(`/billing/plans/${id}`, data),
    subscriptions: (companyId: string) => get<any[]>(`/billing/companies/${companyId}`),
    subscribe: (companyId: string, planId: string) => post<any>(`/billing/companies/${companyId}/subscribe`, { planId }),
    markOverdue: (companyId: string) => post<any>(`/billing/companies/${companyId}/mark-overdue`),
    cancel: (companyId: string) => post<any>(`/billing/companies/${companyId}/cancel`),
  },
  messages: {
    list: (companyId: string) => get<any[]>(`/messages/${companyId}`),
    send: (companyId: string, body: string) => post<any>(`/messages/${companyId}`, { body }),
    markRead: (companyId: string) => post(`/messages/${companyId}/read`),
  },
  extras: {
    list: () => get<any[]>("/extras"),
    create: (data: { title: string; url: string; description?: string; icon?: string; visibleToClients?: boolean }) =>
      post<any>("/extras", data),
    update: (id: string, data: any) => patch<any>(`/extras/${id}`, data),
    remove: (id: string) => del(`/extras/${id}`),
  },
  tickets: {
    listAll: (status?: string) => get<any[]>(`/tickets${status ? `?status=${status}` : ""}`),
    listForCompany: (companyId: string) => get<any[]>(`/tickets/company/${companyId}`),
    get: (id: string) => get<any>(`/tickets/${id}`),
    create: (companyId: string, data: { subject: string; message: string; priority: "normal" | "urgent" }) =>
      post<any>(`/tickets/company/${companyId}`, data),
    reply: (id: string, message: string) => post<any>(`/tickets/${id}/replies`, { message }),
    setStatus: (id: string, status: "open" | "answered" | "closed") => patch<any>(`/tickets/${id}/status`, { status }),
  },
  notifications: {
    list: () => get<any[]>("/notifications"),
    markRead: (id: string) => post<any>(`/notifications/${id}/read`),
    markAllRead: () => post("/notifications/read-all"),
    supportRequest: (message: string) => post("/notifications/support-request", { message }),
  },
  settings: {
    get: () => get<{ mockServicesActive: boolean; values: Record<string, string> }>("/settings"),
    update: (values: Record<string, string>) => put("/settings", values),
    sentEmails: () => get<any[]>("/settings/sent-emails"),
    branding: () => get<{ brandLogoUrl: string | null; brandPrimaryColor: string | null }>("/settings/branding"),
    uploadBrandLogo: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return post<{ brandLogoUrl: string }>("/settings/branding/logo", formData);
    },
  },
  dashboard: {
    admin: () => get<any>("/dashboard/admin"),
    client: () => get<any>("/dashboard/client"),
  },
};
