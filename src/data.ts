export type DocumentStatus =
  | "Berlaku"
  | "Dalam review"
  | "Draft"
  | "Revisi"
  | "Belum efektif";

export const documents = [
  {
    code: "XSOP-PROC-003",
    title: "Pembelian Barang dan Jasa",
    type: "XSOP / SOP",
    unit: "Procurement",
    version: "2.1",
    status: "Berlaku" as DocumentStatus,
    effective: "12 Sep 2026",
    review: "12 Sep 2027",
  },
  {
    code: "XSOP-PROC-004",
    title: "Pembuatan SPK / PKS",
    type: "XSOP / SOP",
    unit: "Procurement",
    version: "1.0",
    status: "Dalam review" as DocumentStatus,
    effective: "Belum",
    review: "18 Okt 2026",
  },
  {
    code: "IK-TO-002",
    title: "Pemeriksaan Kelengkapan Dokumen Vendor",
    type: "Instruksi Kerja",
    unit: "BOS",
    version: "1.2",
    status: "Berlaku" as DocumentStatus,
    effective: "05 Agu 2026",
    review: "05 Agu 2027",
  },
  {
    code: "FORM-PROC-001",
    title: "Checklist Evaluasi Penawaran",
    type: "Form / Template",
    unit: "Procurement",
    version: "1.0",
    status: "Belum efektif" as DocumentStatus,
    effective: "01 Nov 2026",
    review: "01 Nov 2027",
  },
  {
    code: "SKD-GCG-001",
    title: "Kebijakan Tata Kelola Perusahaan",
    type: "Kebijakan / SKD",
    unit: "GCG",
    version: "3.0",
    status: "Berlaku" as DocumentStatus,
    effective: "01 Jan 2026",
    review: "01 Jan 2027",
  },
];

export const approvals = [
  {
    code: "XSOP-PROC-004",
    title: "Pembuatan SPK / PKS",
    step: "Pemeriksaan isi",
    requester: "Dina Maharani",
    date: "14 Okt 2026",
    tone: "amber",
  },
  {
    code: "FORM-PROC-001",
    title: "Checklist Evaluasi Penawaran",
    step: "Pengesahan",
    requester: "Rudi Hartono",
    date: "13 Okt 2026",
    tone: "coral",
  },
  {
    code: "IK-TO-003",
    title: "Penerimaan Barang",
    step: "Pemeriksaan isi",
    requester: "Dina Maharani",
    date: "10 Okt 2026",
    tone: "amber",
  },
];

export const activities = [
  {
    icon: "file",
    title: "Versi baru diajukan",
    detail: "XSOP-PROC-004 oleh Dina Maharani",
    time: "2 jam lalu",
  },
  {
    icon: "check",
    title: "Evaluasi difinalisasi",
    detail: "Kontrol pengadaan periode Q3 2026",
    time: "Kemarin",
  },
  {
    icon: "alert",
    title: "Tindakan melewati tenggat",
    detail: "F-2026-014 · Unit Procurement",
    time: "Kemarin",
  },
  {
    icon: "publish",
    title: "Dokumen diterbitkan",
    detail: "IK-TO-002 versi 1.2",
    time: "12 Okt 2026",
  },
];

export const monitoringItems = [
  {
    control: "Pengadaan memiliki persetujuan berjenjang",
    process: "Pengadaan Barang dan Jasa",
    period: "Q3 2026",
    owner: "Procurement",
    result: "Sesuai",
    state: "Final",
  },
  {
    control: "Evaluasi vendor dilakukan sebelum kontrak",
    process: "Manajemen Vendor",
    period: "Q3 2026",
    owner: "BOS",
    result: "Sebagian sesuai",
    state: "Final",
  },
  {
    control: "Dokumen SPK menggunakan template terkendali",
    process: "Pengadaan Barang dan Jasa",
    period: "Q3 2026",
    owner: "Procurement",
    result: "Belum dinilai",
    state: "Draft",
  },
];

export const findings = [
  {
    code: "F-2026-014",
    title: "Bukti evaluasi vendor belum lengkap",
    unit: "Procurement",
    risk: "Sedang",
    state: "Dalam pengerjaan",
    due: "18 Okt 2026",
    assignee: "Rudi Hartono",
  },
  {
    code: "F-2026-011",
    title: "Review tahunan XSOP belum terdokumentasi",
    unit: "BOS",
    risk: "Rendah",
    state: "Diajukan verifikasi",
    due: "15 Okt 2026",
    assignee: "Dina Maharani",
  },
  {
    code: "F-2026-008",
    title: "Approval pada dua dokumen belum memiliki bukti file",
    unit: "GCG",
    risk: "Tinggi",
    state: "Terbuka",
    due: "10 Okt 2026",
    assignee: "Agus Riyanto",
  },
];
