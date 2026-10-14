import type { DocumentStatus } from "./data";

export type AppDocument = {
  code: string;
  title: string;
  type: string;
  unit: string;
  version: string;
  status: DocumentStatus;
  lifecycleStatus?: "Aktif" | "Direvisi" | "Dicabut";
  description?: string;
  changeSummary?: string;
  revisionNote?: string;
  effectiveDate?: string;
  reviewDate?: string;
  effective: string;
  review: string;
  id?: string;
  source: "demo" | "uploaded";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  managerApproverId?: string;
};

const documentStorageKey = "comtelindo-documents";

export function readDocuments(): AppDocument[] {
  const savedDocuments = window.localStorage.getItem(documentStorageKey);
  if (!savedDocuments) return [];

  try {
    return JSON.parse(savedDocuments) as AppDocument[];
  } catch {
    window.localStorage.removeItem(documentStorageKey);
    return [];
  }
}

export function writeDocuments(nextDocuments: AppDocument[]): void {
  window.localStorage.setItem(
    documentStorageKey,
    JSON.stringify(nextDocuments),
  );
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(
        new Error("Ukuran file maksimal 5 MB untuk penyimpanan prototipe."),
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}
