import type { AuthUser } from "./auth";
import type { AppDocument } from "./documentStore";

const apiBaseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:8787/api" : "/api");
const apiTokenKey = "comtelindo-api-token";

export type ApiApproval = {
  id: string;
  documentId: string;
  code: string;
  title: string;
  step: string;
  requester: string;
  date: string;
  tone: string;
  stageNumber: number;
  requiredRole: string;
  stageStatus: string;
};

export type ApiAuditLog = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  metadata: Record<string, string>;
  createdAt: string;
};

export type ManagerApprover = {
  id: string;
  name: string;
  unit: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "director" | "karyawan";
  unit: string;
  active: boolean;
  created_at: string;
};

export type ApiEvaluation = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  control: string;
  process: string | null;
  owner: string;
  period: string;
  result: string;
  state: string;
  notes: string;
  created_at: string;
};

export type ApiFinding = {
  id: string;
  title: string;
  description: string;
  owner_unit: string;
  risk_level: string;
  state: string;
  due_date: string | null;
  assignee: string | null;
};

export type ApiCorrectiveAction = {
  id: string;
  finding_id: string;
  description: string;
  assignee_id: string | null;
  assignee: string | null;
  state: string;
  due_date: string | null;
  submitted_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_note: string | null;
};

export async function loginWithApi(
  email: string,
  password: string,
): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      `Backend tidak dapat dihubungi. Jalankan "npm run api" atau "npm run dev:full" terlebih dahulu. (${apiBaseUrl})`,
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "Login API gagal.");
  window.localStorage.setItem(apiTokenKey, payload.token);
  return payload.user as AuthUser;
}

export function readApiToken(): string | null {
  return window.localStorage.getItem(apiTokenKey);
}

export async function logoutFromApi(): Promise<void> {
  const token = readApiToken();
  if (token) {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  window.localStorage.removeItem(apiTokenKey);
}

export async function fetchDocumentsFromApi(): Promise<AppDocument[]> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "Dokumen gagal dimuat.");
  return (payload.documents ?? []).map((document: AppDocument) => ({
    ...document,
    source: "uploaded" as const,
    effective: document.effective ?? "Belum",
    review: document.review ?? "Belum dijadwalkan",
  }));
}

export async function uploadDocumentToApi(
  document: AppDocument,
): Promise<AppDocument> {
  const token = readApiToken();
  if (!token || !document.fileData)
    throw new Error("Sesi API atau file upload tidak tersedia.");

  const fileBlob = await fetch(document.fileData).then((response) =>
    response.blob(),
  );
  const formData = new FormData();
  formData.append("code", document.code);
  formData.append("title", document.title);
  formData.append("type", document.type);
  formData.append("unit", document.unit);
  formData.append("version", document.version);
  formData.append("lifecycleStatus", document.lifecycleStatus ?? "Aktif");
  formData.append("description", document.description ?? "");
  formData.append("changeSummary", document.changeSummary ?? "");
  formData.append("effectiveDate", document.effectiveDate ?? "");
  formData.append("reviewDate", document.reviewDate ?? "");
  if (document.managerApproverId) {
    formData.append("managerApproverId", document.managerApproverId);
  }
  formData.append("file", fileBlob, document.fileName ?? "dokumen-upload.bin");

  const response = await fetch(`${apiBaseUrl}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Upload ke server gagal.");
  return { ...payload.document, source: "uploaded" as const };
}

export async function updateDocumentMetadata(
  documentId: string,
  input: Pick<
    AppDocument,
    | "description"
    | "changeSummary"
    | "lifecycleStatus"
    | "effectiveDate"
    | "reviewDate"
  >,
): Promise<AppDocument> {
  const payload = await apiJson<{ document: AppDocument }>(
    `/documents/${documentId}/metadata`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return { ...payload.document, source: "uploaded" as const };
}

export async function fetchManagerApprovers(): Promise<ManagerApprover[]> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/users?role=manager`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Daftar Manager gagal dimuat.");
  return (payload.users ?? []) as ManagerApprover[];
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Daftar user gagal dimuat.");
  return (payload.users ?? []) as AdminUser[];
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: AdminUser["role"];
  unit: string;
}): Promise<AdminUser> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "User gagal dibuat.");
  return payload.user as AdminUser;
}

export async function updateAdminUser(
  id: string,
  input: Partial<Pick<AdminUser, "name" | "role" | "unit" | "active">> & {
    password?: string;
  },
): Promise<AdminUser> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/admin/users/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "User gagal diperbarui.");
  return payload.user as AdminUser;
}

export async function deleteAdminUser(id: string): Promise<AdminUser> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/admin/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "User gagal dihapus.");
  return payload.user as AdminUser;
}

export async function deleteDocumentFromApi(documentId: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function assignManagerApprover(
  documentId: string,
  managerApproverId: string,
): Promise<void> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(
    `${apiBaseUrl}/admin/documents/${documentId}/manager-approver`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ managerApproverId }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Manager approver gagal diubah.");
}

export async function fetchApprovalsFromApi(): Promise<ApiApproval[]> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/approvals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Approval gagal dimuat.");
  return (payload.approvals ?? []) as ApiApproval[];
}

export async function decideApproval(
  documentId: string,
  decision: string,
  comment = "",
): Promise<AppDocument> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(
    `${apiBaseUrl}/approvals/${documentId}/decision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision, comment }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Keputusan gagal disimpan.");
  return { ...payload.document, source: "uploaded" as const };
}

export async function fetchAuditLogsFromApi(): Promise<ApiAuditLog[]> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/audit-logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? "Audit log gagal dimuat.");
  return (payload.auditLogs ?? []) as ApiAuditLog[];
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Backend tidak dapat dihubungi. Jalankan "npm run api" atau "npm run dev:full" terlebih dahulu. (${apiBaseUrl})`,
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "Permintaan gagal.");
  return payload as T;
}

export async function fetchEvaluations(): Promise<ApiEvaluation[]> {
  const payload = await apiJson<{ evaluations: ApiEvaluation[] }>(
    "/evaluations",
  );
  return payload.evaluations;
}

export async function createEvaluation(input: {
  documentId: string;
  control: string;
  process: string;
  owner: string;
  period: string;
  result: string;
  notes: string;
}): Promise<ApiEvaluation> {
  const payload = await apiJson<{ evaluation: ApiEvaluation }>("/evaluations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.evaluation;
}

export async function updateEvaluation(
  id: string,
  input: Omit<Parameters<typeof createEvaluation>[0], "documentId">,
): Promise<ApiEvaluation> {
  const payload = await apiJson<{ evaluation: ApiEvaluation }>(
    `/evaluations/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return payload.evaluation;
}

export async function deleteEvaluation(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/evaluations/${id}`, { method: "DELETE" });
}

export async function fetchFindings(): Promise<ApiFinding[]> {
  const payload = await apiJson<{ findings: ApiFinding[] }>("/findings");
  return payload.findings;
}

export async function createFinding(input: {
  title: string;
  description: string;
  owner: string;
  risk: string;
  dueDate: string;
}): Promise<ApiFinding> {
  const payload = await apiJson<{ finding: ApiFinding }>("/findings", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.finding;
}

export async function updateFinding(
  id: string,
  input: {
    title: string;
    description: string;
    owner: string;
    risk: string;
    dueDate: string;
  },
): Promise<ApiFinding> {
  const payload = await apiJson<{ finding: ApiFinding }>(`/findings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.finding;
}

export async function deleteFinding(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/findings/${id}`, { method: "DELETE" });
}

export async function fetchFindingActions(
  findingId: string,
): Promise<ApiCorrectiveAction[]> {
  const payload = await apiJson<{ actions: ApiCorrectiveAction[] }>(
    `/findings/${findingId}/actions`,
  );
  return payload.actions;
}

export async function createCorrectiveAction(input: {
  findingId: string;
  description: string;
  dueDate: string;
  assigneeId?: string;
}): Promise<ApiCorrectiveAction> {
  const payload = await apiJson<{ action: ApiCorrectiveAction }>(
    `/findings/${input.findingId}/actions`,
    {
      method: "POST",
      body: JSON.stringify({
        description: input.description,
        dueDate: input.dueDate,
        assigneeId: input.assigneeId,
      }),
    },
  );
  return payload.action;
}

export async function submitActionForVerification(
  actionId: string,
): Promise<ApiCorrectiveAction> {
  const payload = await apiJson<{ action: ApiCorrectiveAction }>(
    `/actions/${actionId}/submit-verification`,
    { method: "POST" },
  );
  return payload.action;
}

export async function verifyCorrectiveAction(input: {
  actionId: string;
  decision: "Terverifikasi" | "Perlu Perbaikan";
  note: string;
}): Promise<ApiCorrectiveAction> {
  const payload = await apiJson<{ action: ApiCorrectiveAction }>(
    `/actions/${input.actionId}/verify`,
    {
      method: "POST",
      body: JSON.stringify({ decision: input.decision, note: input.note }),
    },
  );
  return payload.action;
}

export async function getDocumentFileUrl(documentId: string): Promise<string> {
  const token = readApiToken();
  if (!token) throw new Error("Sesi API tidak tersedia.");
  const response = await fetch(`${apiBaseUrl}/documents/${documentId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? "File dokumen gagal dibuka.");
  }
  const blob = await response.blob();
  const contentType = response.headers.get("content-type") || blob.type;
  return URL.createObjectURL(
    contentType ? new Blob([blob], { type: contentType.split(";")[0] }) : blob,
  );
}

export async function downloadDocumentFile(
  documentId: string,
  fileName: string,
): Promise<void> {
  const objectUrl = await getDocumentFileUrl(documentId);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
