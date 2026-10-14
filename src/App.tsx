import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  FolderKanban,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { type DocumentStatus } from "./data";
import {
  canAdminister,
  canAccessWorkspace,
  canApprove,
  canManageDocuments,
  clearAuthUser,
  readAuthUser,
  roleLabels,
  writeAuthUser,
  type AuthUser,
} from "./auth";
import { fileToDataUrl, type AppDocument } from "./documentStore";
import {
  decideApproval,
  createAdminUser,
  deleteAdminUser,
  assignManagerApprover,
  createEvaluation,
  createCorrectiveAction,
  createFinding,
  deleteEvaluation,
  deleteFinding,
  deleteDocumentFromApi,
  fetchAuditLogsFromApi,
  fetchAdminUsers,
  fetchApprovalsFromApi,
  fetchDocumentsFromApi,
  fetchEvaluations,
  fetchFindings,
  fetchFindingActions,
  fetchManagerApprovers,
  downloadDocumentFile,
  getDocumentFileUrl,
  loginWithApi,
  logoutFromApi,
  readApiToken,
  uploadDocumentToApi,
  type ApiAuditLog,
  type ApiApproval,
  type AdminUser,
  type ApiEvaluation,
  type ApiFinding,
  type ApiCorrectiveAction,
  type ManagerApprover,
  updateAdminUser,
  updateDocumentMetadata,
  submitActionForVerification,
  updateEvaluation,
  updateFinding,
  verifyCorrectiveAction,
} from "./api";

type Page =
  | "Dashboard"
  | "Dokumen"
  | "Persetujuan Saya"
  | "Monitoring & Evaluasi"
  | "Temuan & Tindak Lanjut"
  | "Administrasi";

const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Dokumen", icon: FileText },
  { label: "Persetujuan Saya", icon: ClipboardCheck },
  { label: "Monitoring & Evaluasi", icon: Gauge },
  { label: "Temuan & Tindak Lanjut", icon: AlertTriangle },
];

const divisions = [
  "Operation",
  "Retail",
  "Business Operations Support",
  "Finance",
  "Commercial",
  "Research and Innovation",
];

function showComingSoon(feature: string): void {
  window.alert(`${feature} sedang dalam tahap pengembangan.`);
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const className =
    status === "Berlaku"
      ? "status status-green"
      : status === "Dalam review"
        ? "status status-amber"
        : status === "Belum efektif"
          ? "status status-blue"
          : "status status-gray";
  return (
    <span className={className}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => readAuthUser());
  const [page, setPage] = useState<Page>("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("Semua divisi");
  const [appDocuments, setAppDocuments] = useState<AppDocument[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<AppDocument | null>(
    null,
  );
  const [preview, setPreview] = useState<{
    document: AppDocument;
    url: string;
  } | null>(null);
  const [monitoringDocumentId, setMonitoringDocumentId] = useState<
    string | undefined
  >();
  const [serverApprovals, setServerApprovals] = useState<ApiApproval[]>([]);

  useEffect(() => {
    if (!user || !readApiToken()) return;
    fetchDocumentsFromApi()
      .then((apiDocuments) => {
        setAppDocuments(apiDocuments);
      })
      .catch(() => undefined);
    fetchApprovalsFromApi()
      .then(setServerApprovals)
      .catch(() => setServerApprovals([]));
  }, [user]);

  if (!user) {
    return (
      <LoginPage
        onLogin={(nextUser) => {
          writeAuthUser(nextUser);
          setUser(nextUser);
        }}
      />
    );
  }

  const filteredDocuments = appDocuments.filter(
    (document) =>
      `${document.code} ${document.title} ${document.unit} ${document.description ?? ""} ${document.changeSummary ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (divisionFilter === "Semua divisi" || document.unit === divisionFilter),
  );

  const navigate = (nextPage: Page) => {
    if (
      !canAccessWorkspace(user.role) &&
      !["Dashboard", "Dokumen"].includes(nextPage)
    ) {
      setPage("Dokumen");
      return;
    }
    setPage(nextPage);
    setMobileOpen(false);
    setSelectedDocument(null);
  };

  const visibleNavItems = canAccessWorkspace(user.role)
    ? navItems
    : navItems.filter(({ label }) => ["Dashboard", "Dokumen"].includes(label));

  const handleLogout = () => {
    void logoutFromApi();
    clearAuthUser();
    setUser(null);
  };

  const handleUpload = async (uploadedDocument: AppDocument) => {
    if (!readApiToken())
      throw new Error(
        "Sesi API tidak tersedia. Login ulang untuk mengunggah dokumen.",
      );
    const documentToStore = await uploadDocumentToApi(uploadedDocument);
    const nextDocuments = [documentToStore, ...appDocuments];
    setAppDocuments(nextDocuments);
    fetchApprovalsFromApi()
      .then(setServerApprovals)
      .catch(() => undefined);
    setUploadOpen(false);
    setPage("Dokumen");
  };

  const handleDownload = async (document: AppDocument) => {
    if (!document.id) {
      window.alert("Dokumen demo belum memiliki file server untuk diunduh.");
      return;
    }
    try {
      await downloadDocumentFile(
        document.id,
        document.fileName ?? `${document.code}.pdf`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "File gagal diunduh.",
      );
    }
  };

  const handlePreview = async (document: AppDocument) => {
    if (!document.id) {
      window.alert("Dokumen demo belum memiliki file server untuk dibuka.");
      return;
    }
    try {
      const objectUrl = await getDocumentFileUrl(document.id);
      setPreview({ document, url: objectUrl });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "File gagal dibuka.",
      );
    }
  };

  const handleClosePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleDeleteDocument = async (document: AppDocument) => {
    if (!document.id) return;
    if (!window.confirm(`Hapus permanen dokumen ${document.title}?`)) return;
    try {
      await deleteDocumentFromApi(document.id);
      setAppDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
      setSelectedDocument(null);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Dokumen gagal dihapus.",
      );
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <strong>governance</strong>
            <span>COMTELINDO</span>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">G</div>
          <div>
            <strong>GCG & Kepatuhan</strong>
            <span>PT Comtelindo</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="main-nav">
          {visibleNavItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "nav-active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Persetujuan Saya" && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {canAdminister(user.role) && (
            <div className="workspace-label">SISTEM</div>
          )}
          {canAdminister(user.role) && (
            <button
              className={`nav-item ${page === "Administrasi" ? "nav-active" : ""}`}
              onClick={() => navigate("Administrasi")}
            >
              <Settings2 size={18} />
              <span>Administrasi</span>
            </button>
          )}
          <button
            className="nav-item"
            onClick={() => showComingSoon("Pusat Bantuan")}
          >
            <HelpCircle size={18} />
            <span>Pusat Bantuan</span>
          </button>
          <div className="user-card">
            <div className="user-avatar">AR</div>
            <div>
              <strong>{user.name}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
            <button aria-label="Keluar" onClick={handleLogout}>
              <MoreIcon />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>Governance Hub</span>
            <span>/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Cari"
              onClick={() => showComingSoon("Pencarian global")}
            >
              <Search size={19} />
            </button>
            <button
              className="notification-button"
              aria-label="Notifikasi"
              onClick={() => showComingSoon("Notifikasi")}
            >
              <Bell size={19} />
              <i />
            </button>
            <div className="topbar-avatar">
              {user.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
          </div>
        </header>
        <div className="page-content">
          {selectedDocument ? (
            <DocumentDetail
              document={selectedDocument}
              onBack={() => setSelectedDocument(null)}
              onDownload={() => void handleDownload(selectedDocument)}
              onPreview={() => void handlePreview(selectedDocument)}
              onDelete={() => void handleDeleteDocument(selectedDocument)}
              onMonitoring={() => {
                setSelectedDocument(null);
                setMonitoringDocumentId(selectedDocument.id);
                setPage("Monitoring & Evaluasi");
              }}
              canAssignManager={user.role === "admin"}
              canEditMetadata={canManageDocuments(user.role)}
              onMetadataUpdated={(updatedDocument) => {
                setSelectedDocument(updatedDocument);
                setAppDocuments((current) =>
                  current.map((item) =>
                    item.id === updatedDocument.id ? updatedDocument : item,
                  ),
                );
              }}
            />
          ) : page === "Dashboard" ? (
            <Dashboard
              onNavigate={navigate}
              onOpenDocument={setSelectedDocument}
              documents={appDocuments}
              role={user.role}
              pendingApprovals={serverApprovals}
            />
          ) : page === "Dokumen" ? (
            <DocumentList
              query={query}
              setQuery={setQuery}
              documents={filteredDocuments}
              onOpenDocument={setSelectedDocument}
              onUpload={() => setUploadOpen(true)}
              canUpload={canManageDocuments(user.role)}
              divisionFilter={divisionFilter}
              setDivisionFilter={setDivisionFilter}
            />
          ) : page === "Persetujuan Saya" ? (
            <ApprovalPage
              documents={appDocuments}
              onDocumentUpdated={(updatedDocument) => {
                const nextDocuments = appDocuments.map((document) =>
                  document.id === updatedDocument.id
                    ? updatedDocument
                    : document,
                );
                setAppDocuments(nextDocuments);
                fetchApprovalsFromApi()
                  .then(setServerApprovals)
                  .catch(() => undefined);
              }}
            />
          ) : page === "Monitoring & Evaluasi" ? (
            <DynamicMonitoringPage documentId={monitoringDocumentId} />
          ) : page === "Temuan & Tindak Lanjut" ? (
            <DynamicFindingsPage />
          ) : page === "Administrasi" && user.role === "admin" ? (
            <AdministrationPage />
          ) : (
            <PlaceholderPage page={page} onNavigate={navigate} />
          )}
        </div>
      </main>
      {uploadOpen && canManageDocuments(user.role) && (
        <UploadModal
          user={user}
          onClose={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />
      )}
      {preview && (
        <DocumentPreviewModal preview={preview} onClose={handleClosePreview} />
      )}
    </div>
  );
}

function Dashboard({
  onNavigate,
  onOpenDocument,
  documents: appDocuments,
  role,
  pendingApprovals,
}: {
  onNavigate: (page: Page) => void;
  onOpenDocument: (document: AppDocument) => void;
  documents: AppDocument[];
  role: AuthUser["role"];
  pendingApprovals: ApiApproval[];
}) {
  return (
    <>
      <section className="welcome-row">
        <div>
          <h1>Ringkasan tata kelola.</h1>
          <p className="subheading">
            Pantau dokumen, persetujuan, dan implementasi dalam satu ruang
            kerja.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => onNavigate("Dokumen")}
        >
          <FileText size={17} />
          Buka register dokumen
          <ArrowUpRight size={16} />
        </button>
      </section>
      <div className="section-heading">
        <div>
          <h2>Hari ini</h2>
        </div>
        <button
          className="filter-button"
          onClick={() => showComingSoon("Filter tampilan dashboard")}
        >
          <SlidersHorizontal size={16} /> Filter tampilan
        </button>
      </div>
      <section className="kpi-grid">
        <KpiCard
          label="Dokumen berlaku"
          value={String(
            appDocuments.filter((document) => document.status === "Berlaku")
              .length,
          )}
          meta="Dari register aktif"
          tone="green"
          icon={<BookOpenCheck />}
        />
        <KpiCard
          label="Menunggu keputusan"
          value={String(pendingApprovals.length)}
          meta="Antrean approval Anda"
          tone="amber"
          icon={<Clock3 />}
        />
        <KpiCard
          label="Review terlambat"
          value={String(
            appDocuments.filter(
              (document) => document.status === "Dalam review",
            ).length,
          )}
          meta="Perlu pemeriksaan lanjutan"
          tone="coral"
          icon={<AlertTriangle />}
        />
        <KpiCard
          label="Temuan terbuka"
          value="0"
          meta="Belum ada data temuan"
          tone="blue"
          icon={<FolderKanban />}
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel approval-panel">
          <div className="panel-heading">
            <div>
              <h2>Persetujuan saya</h2>
              <p>Dokumen yang menunggu tindakan Anda</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("Persetujuan Saya")}
            >
              Lihat semua <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="approval-list">
            {pendingApprovals.length === 0 && (
              <div className="empty-inline">
                Belum ada persetujuan yang menunggu tindakan Anda.
              </div>
            )}
            {pendingApprovals.slice(0, 3).map((approval) => (
              <button
                className="approval-row"
                key={approval.code}
                onClick={() => onNavigate("Persetujuan Saya")}
              >
                <div className={`approval-icon ${approval.tone}`}>
                  <FileCheck2 size={18} />
                </div>
                <div className="approval-copy">
                  <strong>{approval.title}</strong>
                  <span>
                    {approval.code} · {approval.step}
                  </span>
                </div>
                <div className="approval-date">
                  <span>{approval.date}</span>
                  <ArrowUpRight size={15} />
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Aktivitas terbaru</h2>
              <p>Perubahan terbaru di workspace</p>
            </div>
            <button
              className="icon-button"
              onClick={() => showComingSoon("Filter aktivitas")}
              aria-label="Filter aktivitas"
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
          <div className="activity-list">
            {appDocuments.length === 0 && (
              <div className="empty-inline">Belum ada aktivitas dokumen.</div>
            )}
            {appDocuments.slice(0, 4).map((document) => (
              <div className="activity-row" key={document.id ?? document.code}>
                <div className="activity-icon activity-file">
                  <FileText size={16} />
                </div>
                <div>
                  <strong>Dokumen ditambahkan</strong>
                  <span>
                    {document.code} · {document.unit}
                  </span>
                </div>
                <time>{document.status}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel document-preview">
        <div className="panel-heading">
          <div>
            <h2>Register dokumen</h2>
            <p>Dokumen terbaru yang dapat Anda akses</p>
          </div>
          <button className="text-button" onClick={() => onNavigate("Dokumen")}>
            Lihat register <ArrowUpRight size={15} />
          </button>
        </div>
        <DocumentTable
          documents={appDocuments.slice(0, 4)}
          onOpenDocument={onOpenDocument}
        />
      </section>
    </>
  );
}

function KpiCard({
  label,
  value,
  meta,
  tone,
  icon,
}: {
  label: string;
  value: string;
  meta: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon kpi-${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small
          className={
            meta.startsWith("↑")
              ? "positive"
              : meta.startsWith("↓")
                ? "positive"
                : tone === "coral"
                  ? "negative"
                  : ""
          }
        >
          {meta}
        </small>
      </div>
    </div>
  );
}

function DocumentList({
  query,
  setQuery,
  documents: filtered,
  onOpenDocument,
  onUpload,
  canUpload,
  divisionFilter,
  setDivisionFilter,
}: {
  query: string;
  setQuery: (query: string) => void;
  documents: AppDocument[];
  onOpenDocument: (document: AppDocument) => void;
  onUpload: () => void;
  canUpload: boolean;
  divisionFilter: string;
  setDivisionFilter: (division: string) => void;
}) {
  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">REGISTER TERKENDALI</div>
          <h1>Dokumen</h1>
          <p className="subheading">
            Cari dan telusuri dokumen resmi beserta riwayat versinya.
          </p>
        </div>
        {canUpload && (
          <button className="primary-button" onClick={onUpload}>
            <FileText size={17} />
            Tambah dokumen
          </button>
        )}
      </section>
      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kode, judul, atau unit..."
          />
        </div>
        <label className="filter-button division-filter">
          <SlidersHorizontal size={16} />
          <select
            value={divisionFilter}
            onChange={(event) => setDivisionFilter(event.target.value)}
            aria-label="Filter divisi"
          >
            <option>Semua divisi</option>
            {divisions.map((division) => (
              <option key={division}>{division}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <section className="panel document-page-panel">
        <div className="table-meta">
          <span>
            Menampilkan <strong>{filtered.length}</strong> dari{" "}
            {filtered.length} dokumen
          </span>
          <span className="legend">
            <span className="status-dot green" />
            Versi berlaku
          </span>
        </div>
        <DocumentTable documents={filtered} onOpenDocument={onOpenDocument} />
      </section>
    </>
  );
}

function DocumentTable({
  documents: rows,
  onOpenDocument,
}: {
  documents: AppDocument[];
  onOpenDocument: (document: AppDocument) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Dokumen</th>
            <th>Jenis</th>
            <th>Unit pemilik</th>
            <th>Versi</th>
            <th>Status</th>
            <th>Review berikutnya</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {divisions.map((division) => {
            const divisionDocuments = rows.filter(
              (document) => document.unit === division,
            );
            if (divisionDocuments.length === 0) return null;
            return (
              <Fragment key={division}>
                <tr className="division-heading">
                  <td colSpan={7}>
                    {division} <span>{divisionDocuments.length} dokumen</span>
                  </td>
                </tr>
                {divisionDocuments.map((document) => (
                  <tr
                    key={document.id ?? document.code}
                    onClick={() => onOpenDocument(document)}
                  >
                    <td>
                      <div className="document-name">
                        <div className="file-icon">
                          <FileText size={17} />
                        </div>
                        <div>
                          <strong>{document.title}</strong>
                          <span>{document.code}</span>
                        </div>
                      </div>
                    </td>
                    <td>{document.type}</td>
                    <td>{document.unit}</td>
                    <td>v{document.version}</td>
                    <td>
                      <StatusBadge status={document.status} />
                      <span className="status status-gray lifecycle-badge">
                        {document.lifecycleStatus ?? "Aktif"}
                      </span>
                    </td>
                    <td>{document.review}</td>
                    <td>
                      <ArrowUpRight size={16} className="row-arrow" />
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {rows.some((document) => !divisions.includes(document.unit)) && (
            <>
              <tr className="division-heading">
                <td colSpan={7}>Divisi lainnya</td>
              </tr>
              {rows
                .filter((document) => !divisions.includes(document.unit))
                .map((document) => (
                  <tr
                    key={document.id ?? document.code}
                    onClick={() => onOpenDocument(document)}
                  >
                    <td>
                      <strong>{document.title}</strong>
                      <span className="table-subtext">{document.code}</span>
                    </td>
                    <td>{document.type}</td>
                    <td>{document.unit}</td>
                    <td>v{document.version}</td>
                    <td>
                      <StatusBadge status={document.status} />
                    </td>
                    <td>{document.review}</td>
                    <td>
                      <ArrowUpRight size={16} className="row-arrow" />
                    </td>
                  </tr>
                ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DocumentDetail({
  document,
  onBack,
  onDownload,
  onPreview,
  onDelete,
  onMonitoring,
  canAssignManager,
  canEditMetadata,
  onMetadataUpdated,
}: {
  document: AppDocument;
  onBack: () => void;
  onDownload: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onMonitoring: () => void;
  canAssignManager: boolean;
  canEditMetadata: boolean;
  onMetadataUpdated: (document: AppDocument) => void;
}) {
  const [managerApprovers, setManagerApprovers] = useState<ManagerApprover[]>(
    [],
  );
  const [selectedManager, setSelectedManager] = useState(
    document.managerApproverId ?? "",
  );
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadata, setMetadata] = useState({
    description: document.description ?? "",
    changeSummary: document.changeSummary ?? "",
    lifecycleStatus: document.lifecycleStatus ?? "Aktif",
    effectiveDate: document.effectiveDate ?? "",
    reviewDate: document.reviewDate ?? "",
  });
  const [metadataMessage, setMetadataMessage] = useState("");

  useEffect(() => {
    if (!canAssignManager || !document.id) return;
    fetchManagerApprovers()
      .then(setManagerApprovers)
      .catch(() => undefined);
    setSelectedManager(document.managerApproverId ?? "");
  }, [canAssignManager, document.id, document.managerApproverId]);

  const saveManagerApprover = async () => {
    if (!document.id || !selectedManager) return;
    try {
      await assignManagerApprover(document.id, selectedManager);
      setAssignmentMessage("Manager approver berhasil diperbarui.");
    } catch (error) {
      setAssignmentMessage(
        error instanceof Error ? error.message : "Approver gagal diperbarui.",
      );
    }
  };

  const saveMetadata = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!document.id) return;
    try {
      const updated = await updateDocumentMetadata(document.id, metadata);
      onMetadataUpdated(updated);
      setMetadataMessage("Metadata dokumen berhasil disimpan.");
      setMetadataOpen(false);
    } catch (error) {
      setMetadataMessage(
        error instanceof Error ? error.message : "Metadata gagal disimpan.",
      );
    }
  };

  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← Kembali ke register
      </button>
      <section className="detail-header">
        <div>
          <div className="eyebrow">
            {document.type.toUpperCase()} · {document.code}
          </div>
          <h1>{document.title}</h1>
          <div className="detail-status">
            <StatusBadge status={document.status} />
            <span className="status status-gray">
              {document.lifecycleStatus ?? "Aktif"}
            </span>
            <span>Versi {document.version}</span>
            <span>Unit {document.unit}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button className="filter-button" onClick={onPreview}>
            <ArrowUpRight size={16} />
            Preview
          </button>
          <button className="primary-button" onClick={onDownload}>
            <FileText size={17} />
            Unduh file
          </button>
          {canAssignManager && (
            <button className="danger-text" onClick={onDelete}>
              Hapus dokumen
            </button>
          )}
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="tabs">
            <button className="tab-active">Ringkasan</button>
            <button
              onClick={() => showComingSoon("Detail approval dan pengesahan")}
            >
              Approval & Pengesahan
            </button>
            <button onClick={() => showComingSoon("Riwayat versi dokumen")}>
              Riwayat versi
            </button>
            <button onClick={onMonitoring}>Monitoring</button>
          </div>
          <div className="detail-section">
            <h2>Ringkasan dan tujuan</h2>
            <p>
              {document.description ||
                "Belum ada abstrak atau ringkasan dokumen."}
            </p>
            <div className="change-note">
              <strong>Perubahan dari versi sebelumnya</strong>
              <span>
                {document.changeSummary || "Belum ada catatan perubahan."}
              </span>
            </div>
            {document.revisionNote && (
              <div className="revision-note">
                <strong>Catatan revisi approval</strong>
                <span>{document.revisionNote}</span>
              </div>
            )}
          </div>
          {canEditMetadata && (
            <div className="detail-section metadata-editor-section">
              <div className="section-heading-inline">
                <h2>Metadata dokumen</h2>
                <button
                  className="filter-button"
                  onClick={() => setMetadataOpen((current) => !current)}
                >
                  {metadataOpen ? "Tutup" : "Edit metadata"}
                </button>
              </div>
              {metadataOpen && (
                <form className="upload-form" onSubmit={saveMetadata}>
                  <label>
                    Abstrak / deskripsi
                    <textarea
                      value={metadata.description}
                      onChange={(event) =>
                        setMetadata({
                          ...metadata,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Perubahan dari versi sebelumnya
                    <textarea
                      value={metadata.changeSummary}
                      onChange={(event) =>
                        setMetadata({
                          ...metadata,
                          changeSummary: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Status dokumen
                      <select
                        value={metadata.lifecycleStatus}
                        onChange={(event) =>
                          setMetadata({
                            ...metadata,
                            lifecycleStatus: event.target.value as
                              | "Aktif"
                              | "Direvisi"
                              | "Dicabut",
                          })
                        }
                      >
                        <option>Aktif</option>
                        <option>Direvisi</option>
                        <option>Dicabut</option>
                      </select>
                    </label>
                    <label>
                      Tanggal berlaku
                      <input
                        type="date"
                        value={metadata.effectiveDate}
                        onChange={(event) =>
                          setMetadata({
                            ...metadata,
                            effectiveDate: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Review berikutnya
                      <input
                        type="date"
                        value={metadata.reviewDate}
                        onChange={(event) =>
                          setMetadata({
                            ...metadata,
                            reviewDate: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    Simpan metadata
                  </button>
                </form>
              )}
              {metadataMessage && (
                <small className="metadata-message">{metadataMessage}</small>
              )}
            </div>
          )}
          <div className="detail-section">
            <h2>File dan sumber</h2>
            <div className="source-file">
              <div className="file-icon">
                <FileText size={18} />
              </div>
              <div>
                <strong>
                  {document.fileName ?? `${document.code}_v${document.version}`}
                </strong>
                <span>
                  {(document.fileType ?? "File dokumen").toUpperCase()} · File
                  tersimpan di aplikasi
                </span>
              </div>
              <button
                className="icon-button"
                onClick={onPreview}
                aria-label="Buka file dokumen"
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          </div>
        </section>
        <aside className="panel metadata">
          <h2>Metadata dokumen</h2>
          {[
            ["Kode kanonis", document.code],
            ["Jenis", document.type],
            ["Unit pemilik", document.unit],
            ["Versi", `v${document.version}`],
            ["Tanggal efektif", document.effective],
            ["Review berikutnya", document.review],
          ].map(([label, value]) => (
            <div className="metadata-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="metadata-note">
            <ShieldCheck size={16} />
            <span>
              Perubahan versi terbit tersimpan sebagai riwayat dan tidak dapat
              diubah.
            </span>
          </div>
          {canAssignManager && document.id && (
            <div className="approver-editor">
              <strong>Manager approver tahap 2</strong>
              <select
                value={selectedManager}
                onChange={(event) => setSelectedManager(event.target.value)}
              >
                <option value="">Pilih Manager</option>
                {managerApprovers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} · {manager.unit}
                  </option>
                ))}
              </select>
              <button
                className="filter-button"
                onClick={() => void saveManagerApprover()}
              >
                Simpan approver
              </button>
              {assignmentMessage && <small>{assignmentMessage}</small>}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function DocumentPreviewModal({
  preview,
  onClose,
}: {
  preview: { document: AppDocument; url: string };
  onClose: () => void;
}) {
  const fileType = preview.document.fileType ?? "";
  const isImage = fileType.startsWith("image/");
  const isPdf =
    fileType === "application/pdf" ||
    preview.document.fileName?.toLowerCase().endsWith(".pdf");
  return (
    <div className="preview-overlay" role="dialog" aria-modal="true">
      <section className="preview-modal">
        <header className="preview-header">
          <div>
            <strong>
              {preview.document.fileName ?? preview.document.title}
            </strong>
            <span>Preview file dalam aplikasi</span>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Tutup preview"
          >
            <X size={18} />
          </button>
        </header>
        <div className="preview-body">
          {isImage ? (
            <img src={preview.url} alt={preview.document.title} />
          ) : isPdf ? (
            <object
              data={preview.url}
              type="application/pdf"
              title={`Preview ${preview.document.title}`}
            >
              <iframe
                src={preview.url}
                title={`Preview ${preview.document.title}`}
              />
            </object>
          ) : (
            <div className="empty-inline">
              Format file ini belum dapat dirender langsung oleh browser.
              Gunakan tombol Unduh file untuk membukanya.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ApprovalPage({
  documents: appDocuments,
  onDocumentUpdated,
}: {
  documents: AppDocument[];
  onDocumentUpdated: (document: AppDocument) => void;
}) {
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [revisionComments, setRevisionComments] = useState<
    Record<string, string>
  >({});
  const [revisionApproval, setRevisionApproval] = useState<ApiApproval | null>(
    null,
  );
  const [revisionDraft, setRevisionDraft] = useState("");
  const [serverApprovals, setServerApprovals] = useState<ApiApproval[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!readApiToken()) return;
    fetchApprovalsFromApi()
      .then(setServerApprovals)
      .catch(() => undefined);
  }, [appDocuments]);

  const workItems = serverApprovals;

  const decide = async (approval: ApiApproval, value: string, comment = "") => {
    setError("");
    try {
      if (approval.documentId) {
        const updatedDocument = await decideApproval(
          approval.documentId,
          value,
          comment || revisionComments[approval.documentId] || "",
        );
        onDocumentUpdated(updatedDocument);
        const nextApprovals = await fetchApprovalsFromApi();
        setServerApprovals(nextApprovals);
        setDecision({});
      }
      setDecision((current) => ({ ...current, [approval.code]: value }));
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "Keputusan gagal disimpan.",
      );
    }
  };

  const submitRevision = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!revisionApproval || !revisionDraft.trim()) return;
    setRevisionComments((current) => ({
      ...current,
      [revisionApproval.documentId]: revisionDraft.trim(),
    }));
    await decide(revisionApproval, "Minta revisi", revisionDraft.trim());
    setRevisionApproval(null);
    setRevisionDraft("");
  };

  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">WORK QUEUE</div>
          {workItems.length === 0 && (
            <div className="empty-inline">
              Belum ada dokumen yang menunggu approval Anda.
            </div>
          )}
          <h1>Persetujuan saya</h1>
          <p className="subheading">
            Tinjau snapshot versi dan berikan keputusan sesuai mandat.
          </p>
        </div>
        <div className="queue-summary">
          <strong>{workItems.length}</strong>
          <span>tugas aktif</span>
        </div>
      </section>
      <section className="panel workflow-panel">
        <div className="panel-heading">
          <div>
            <h2>Tugas yang menunggu tindakan</h2>
            <p>
              Keputusan dicatat terhadap versi yang diajukan, bukan judul
              dokumen saja.
            </p>
          </div>
          <span className="status status-amber">
            <span className="status-dot" />
            Menunggu keputusan
          </span>
        </div>
        {error && (
          <div className="login-error workflow-error">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}
        <div className="workflow-list">
          {workItems.map((approval) => (
            <div
              className="workflow-row"
              key={`${approval.documentId}-${approval.stageNumber}`}
            >
              <div className={`approval-icon ${approval.tone}`}>
                <FileCheck2 size={19} />
              </div>
              <div className="workflow-copy">
                <strong>{approval.title}</strong>
                <span>
                  {approval.code} · Versi kandidat · {approval.step}
                </span>
                <small>
                  Status tahap: {approval.stageStatus} · Pengaju:{" "}
                  {approval.requester} · Diterima {approval.date}
                </small>
                {approval.stageStatus === "Menunggu" && (
                  <textarea
                    className="revision-comment-input"
                    placeholder="Catatan diisi melalui tombol Minta revisi"
                    value={revisionComments[approval.documentId] ?? ""}
                    readOnly
                  />
                )}
              </div>
              <div className="workflow-actions">
                {decision[approval.code] ? (
                  <span
                    className={`decision ${decision[approval.code] === "Setujui" ? "decision-ok" : "decision-revise"}`}
                  >
                    <Check size={14} />
                    {decision[approval.code]}
                  </span>
                ) : (
                  <>
                    <button
                      className="outline-button"
                      onClick={() => {
                        setRevisionApproval(approval);
                        setRevisionDraft(
                          revisionComments[approval.documentId] ?? "",
                        );
                      }}
                    >
                      Minta revisi
                    </button>
                    <button
                      className="approve-button"
                      onClick={() => void decide(approval, "Setujui")}
                    >
                      Setujui
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="workflow-note">
        <ShieldCheck size={17} />
        <span>
          Persetujuan internal ini bukan tanda tangan elektronik tersertifikasi.
          Bukti file wajib diverifikasi sebelum penerbitan.
        </span>
      </div>
      {revisionApproval && (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            onClick={() => setRevisionApproval(null)}
            aria-label="Tutup form revisi"
          />
          <section
            className="upload-modal revision-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">CATATAN APPROVAL</div>
                <h2>Minta revisi dokumen</h2>
                <p>{revisionApproval.title}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setRevisionApproval(null)}
                aria-label="Tutup"
              >
                <X size={19} />
              </button>
            </div>
            <form className="upload-form" onSubmit={submitRevision}>
              <label>
                Alasan revisi
                <textarea
                  autoFocus
                  value={revisionDraft}
                  onChange={(event) => setRevisionDraft(event.target.value)}
                  placeholder="Jelaskan bagian yang perlu diperbaiki..."
                  required
                />
              </label>
              <div className="modal-actions">
                <button
                  className="filter-button"
                  type="button"
                  onClick={() => setRevisionApproval(null)}
                >
                  Batal
                </button>
                <button className="primary-button" type="submit">
                  Submit revisi
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function MonitoringPage() {
  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">IMPLEMENTASI & KEPATUHAN</div>
          <h1>Monitoring & evaluasi</h1>
          <p className="subheading">
            Hasil evaluasi disimpan bersama periode, bukti, dan versi acuan.
          </p>
        </div>
        <span className="status status-gray">Belum ada evaluasi</span>
      </section>
      <div className="empty-inline">
        Belum ada evaluasi tersimpan untuk workspace ini.
      </div>
      <section className="kpi-grid monitoring-kpis">
        <KpiCard
          label="Evaluasi selesai"
          value="0"
          meta="Belum ada data"
          tone="green"
          icon={<Check />}
        />
        <KpiCard
          label="Sesuai"
          value="0"
          meta="Belum ada data"
          tone="green"
          icon={<ShieldCheck />}
        />
        <KpiCard
          label="Belum dinilai"
          value="0"
          meta="Belum ada data"
          tone="amber"
          icon={<Clock3 />}
        />
        <KpiCard
          label="Temuan terbuka"
          value="0"
          meta="Belum ada data"
          tone="coral"
          icon={<AlertTriangle />}
        />
      </section>
      <section className="panel document-page-panel monitoring-table">
        <div className="panel-heading">
          <div>
            <h2>Evaluasi periode Q3 2026</h2>
            <p>Kontrol aktif dalam cakupan GCG & Kepatuhan</p>
          </div>
          <span className="table-caption">Data PostgreSQL</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kontrol / kewajiban</th>
                <th>Proses</th>
                <th>Unit</th>
                <th>Hasil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="empty-cell">
                  Belum ada evaluasi yang ditambahkan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function FindingsPage() {
  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">IMPROVEMENT TRACKER</div>
          <h1>Temuan & tindak lanjut</h1>
          <p className="subheading">
            Tenggat menunjukkan keterlambatan; penutupan tetap membutuhkan
            verifikasi.
          </p>
        </div>
        <span className="status status-gray">Belum ada temuan</span>
      </section>
      <div className="finding-stats">
        <span>
          <strong>0</strong> temuan terbuka
        </span>
        <span>
          <strong>0</strong> tindakan terlambat
        </span>
        <span>
          <strong>0</strong> menunggu verifikasi
        </span>
      </div>
      <section className="panel document-page-panel">
        <div className="panel-heading">
          <div>
            <h2>Daftar temuan aktif</h2>
            <p>Prioritaskan tindakan berdasarkan risiko dan tenggat</p>
          </div>
          <button
            className="filter-button"
            onClick={() => showComingSoon("Filter temuan")}
          >
            <SlidersHorizontal size={16} /> Filter
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Temuan</th>
                <th>Unit</th>
                <th>Risiko</th>
                <th>PIC</th>
                <th>Tenggat</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="empty-cell">
                  Belum ada temuan yang ditambahkan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AdministrationPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "karyawan" as AdminUser["role"],
    unit: "",
  });

  const loadUsers = () => {
    fetchAdminUsers()
      .then(setUsers)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Daftar user gagal dimuat.",
        );
      });
  };

  useEffect(loadUsers, []);

  const submitUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        const updatedUser = await updateAdminUser(editingId, {
          name: form.name,
          role: form.role,
          unit: form.unit,
          ...(form.password ? { password: form.password } : {}),
        });
        setUsers((current) =>
          current.map((item) =>
            item.id === updatedUser.id ? updatedUser : item,
          ),
        );
        setSuccess(`Akun ${updatedUser.email} berhasil diperbarui.`);
      } else {
        const createdUser = await createAdminUser(form);
        setUsers((current) =>
          [...current, createdUser].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
        );
        setSuccess(`Akun ${createdUser.email} berhasil dibuat.`);
      }
      setForm({
        name: "",
        email: "",
        password: "",
        role: "karyawan",
        unit: "",
      });
      setEditingId(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "User gagal dibuat.",
      );
    }
  };

  const editUser = (account: AdminUser) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      email: account.email,
      password: "",
      role: account.role,
      unit: account.unit,
    });
    setSuccess("");
  };

  const removeUser = async (account: AdminUser) => {
    if (!window.confirm(`Nonaktifkan akun ${account.email}?`)) return;
    try {
      const updatedUser = await deleteAdminUser(account.id);
      setUsers((current) =>
        current.filter((item) => item.id !== updatedUser.id),
      );
      setSuccess(`Akun ${updatedUser.email} dihapus dari daftar aktif.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "User gagal dihapus.",
      );
    }
  };

  const toggleUser = async (user: AdminUser) => {
    setError("");
    try {
      const updatedUser = await updateAdminUser(user.id, {
        active: !user.active,
      });
      setUsers((current) =>
        current.map((item) =>
          item.id === updatedUser.id ? updatedUser : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Status user gagal diubah.",
      );
    }
  };

  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">KONTROL AKSES</div>
          <h1>Administrasi</h1>
          <p className="subheading">
            Buat akun, tetapkan role, unit, dan status akses pengguna.
          </p>
        </div>
        <span className="status status-green">
          <span className="status-dot" />
          Admin only
        </span>
      </section>
      {error && (
        <div className="login-error workflow-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      {success && (
        <div className="success-banner">
          <Check size={15} />
          {success}
        </div>
      )}
      <div className="admin-grid">
        <section className="panel admin-form-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId ? "Edit akun" : "Buat akun baru"}</h2>
              <p>
                {editingId
                  ? "Ubah nama, role, unit, atau password akun."
                  : "Password awal minimal 8 karakter."}
              </p>
            </div>
          </div>
          <form className="upload-form" onSubmit={submitUser}>
            <label>
              Nama lengkap
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              Email kerja
              <input
                type="email"
                value={form.email}
                readOnly={Boolean(editingId)}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as AdminUser["role"],
                    })
                  }
                >
                  <option value="karyawan">Karyawan</option>
                  <option value="manager">Manager</option>
                  <option value="director">Direktur</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label>
                Unit / divisi
                <input
                  value={form.unit}
                  onChange={(event) =>
                    setForm({ ...form, unit: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label>
              Password {editingId ? "baru (opsional)" : "awal"}
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                required={!editingId}
              />
            </label>
            <div className="modal-actions">
              {editingId && (
                <button
                  className="filter-button"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      name: "",
                      email: "",
                      password: "",
                      role: "karyawan",
                      unit: "",
                    });
                  }}
                >
                  Batal
                </button>
              )}
              <button className="primary-button" type="submit">
                <ShieldCheck size={16} />
                {editingId ? "Simpan perubahan" : "Buat akun"}
              </button>
            </div>
          </form>
        </section>
        <section className="panel admin-users-panel">
          <div className="panel-heading">
            <div>
              <h2>Pengguna workspace</h2>
              <p>{users.length} akun terdaftar dari PostgreSQL</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Role</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Belum ada akun.
                    </td>
                  </tr>
                ) : (
                  users.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="document-name">
                          <div className="file-icon">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <strong>{account.name}</strong>
                            <span>{account.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{roleLabels[account.role]}</td>
                      <td>{account.unit}</td>
                      <td>
                        <span
                          className={`status ${account.active ? "status-green" : "status-gray"}`}
                        >
                          <span className="status-dot" />
                          {account.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button
                            className="text-button"
                            onClick={() => editUser(account)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            onClick={() => void toggleUser(account)}
                          >
                            {account.active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          {account.active && (
                            <button
                              className="danger-text"
                              onClick={() => void removeUser(account)}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <AuditLogPage />
    </>
  );
}

function DynamicMonitoringPage({ documentId }: { documentId?: string }) {
  const [evaluations, setEvaluations] = useState<ApiEvaluation[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] =
    useState<ApiEvaluation | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] =
    useState<ApiEvaluation | null>(null);
  const [form, setForm] = useState({
    documentId: documentId ?? "",
    control: "",
    process: "",
    owner: "",
    period: "",
    result: "Belum Dinilai",
    notes: "",
  });
  const [error, setError] = useState("");

  const loadEvaluations = () =>
    fetchEvaluations()
      .then(setEvaluations)
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Evaluasi gagal dimuat.",
        ),
      );
  useEffect(() => {
    void loadEvaluations();
  }, []);
  useEffect(() => {
    fetchDocumentsFromApi()
      .then(setDocuments)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (documentId) setForm((current) => ({ ...current, documentId }));
  }, [documentId]);

  const submitEvaluation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingEvaluation) {
        const evaluation = await updateEvaluation(editingEvaluation.id, {
          control: form.control,
          process: form.process,
          owner: form.owner,
          period: form.period,
          result: form.result,
          notes: form.notes,
        });
        setEvaluations((current) =>
          current.map((item) =>
            item.id === evaluation.id ? evaluation : item,
          ),
        );
      } else {
        const evaluation = await createEvaluation(form);
        setEvaluations((current) => [evaluation, ...current]);
      }
      setForm({
        documentId: documentId ?? "",
        control: "",
        process: "",
        owner: "",
        period: "",
        result: "Belum Dinilai",
        notes: "",
      });
      setEditingEvaluation(null);
      setFormOpen(false);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Evaluasi gagal dibuat.",
      );
    }
  };

  const beginEditEvaluation = (evaluation: ApiEvaluation) => {
    setEditingEvaluation(evaluation);
    setForm({
      documentId: evaluation.document_id ?? "",
      control: evaluation.control,
      process: evaluation.process ?? "",
      owner: evaluation.owner,
      period: evaluation.period,
      result: evaluation.result,
      notes: evaluation.notes ?? "",
    });
    setFormOpen(true);
  };

  const removeEvaluation = async (evaluation: ApiEvaluation) => {
    if (
      !window.confirm(
        `Hapus evaluasi ${evaluation.control}? Temuan terkait juga akan dihapus.`,
      )
    )
      return;
    try {
      await deleteEvaluation(evaluation.id);
      setEvaluations((current) =>
        current.filter((item) => item.id !== evaluation.id),
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Evaluasi gagal dihapus.",
      );
    }
  };

  const finalCount = evaluations.filter(
    (item) =>
      item.state === "Final" &&
      (!documentId || item.document_id === documentId),
  ).length;
  const compliantCount = evaluations.filter(
    (item) =>
      item.result === "Sesuai" &&
      (!documentId || item.document_id === documentId),
  ).length;
  const visibleEvaluations = documentId
    ? evaluations.filter((item) => item.document_id === documentId)
    : evaluations;
  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">IMPLEMENTASI & KEPATUHAN</div>
          <h1>Monitoring & evaluasi</h1>
          <p className="subheading">
            Evaluasi yang tersimpan di PostgreSQL dan memiliki periode serta
            hasil.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setFormOpen((current) => !current)}
        >
          <ClipboardCheck size={17} />
          {formOpen ? "Tutup form" : "Buat evaluasi"}
        </button>
      </section>
      {error && (
        <div className="login-error workflow-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      {formOpen && (
        <section className="panel dynamic-form-panel">
          <form className="upload-form" onSubmit={submitEvaluation}>
            <label>
              Dokumen tata kelola
              <select
                value={form.documentId}
                onChange={(event) =>
                  setForm({ ...form, documentId: event.target.value })
                }
                required
              >
                <option value="">Pilih file atau tata kelola</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.code} · {document.title} · v{document.version}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Kontrol / kewajiban
                <input
                  value={form.control}
                  onChange={(event) =>
                    setForm({ ...form, control: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Periode
                <input
                  placeholder="Q4 2026"
                  value={form.period}
                  onChange={(event) =>
                    setForm({ ...form, period: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Proses bisnis
                <input
                  value={form.process}
                  onChange={(event) =>
                    setForm({ ...form, process: event.target.value })
                  }
                />
              </label>
              <label>
                Unit pemilik
                <input
                  value={form.owner}
                  onChange={(event) =>
                    setForm({ ...form, owner: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label>
              Hasil
              <select
                value={form.result}
                onChange={(event) =>
                  setForm({ ...form, result: event.target.value })
                }
              >
                <option>Belum Dinilai</option>
                <option>Sesuai</option>
                <option>Sebagian Sesuai</option>
                <option>Tidak Sesuai</option>
                <option>Tidak Berlaku</option>
              </select>
            </label>
            <label>
              Catatan
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
            <button className="primary-button" type="submit">
              {editingEvaluation ? "Simpan perubahan" : "Simpan evaluasi"}
            </button>
            {editingEvaluation && (
              <button
                className="filter-button"
                type="button"
                onClick={() => {
                  setEditingEvaluation(null);
                  setFormOpen(false);
                }}
              >
                Batal edit
              </button>
            )}
          </form>
        </section>
      )}
      <section className="kpi-grid monitoring-kpis">
        <KpiCard
          label="Evaluasi selesai"
          value={String(finalCount)}
          meta="Dari data aktual"
          tone="green"
          icon={<Check />}
        />
        <KpiCard
          label="Sesuai"
          value={String(compliantCount)}
          meta="Hasil evaluasi"
          tone="green"
          icon={<ShieldCheck />}
        />
        <KpiCard
          label="Belum dinilai"
          value={String(
            visibleEvaluations.filter((item) => item.result === "Belum Dinilai")
              .length,
          )}
          meta="Perlu tindak lanjut"
          tone="amber"
          icon={<Clock3 />}
        />
        <KpiCard
          label="Total evaluasi"
          value={String(visibleEvaluations.length)}
          meta="PostgreSQL"
          tone="blue"
          icon={<ClipboardCheck />}
        />
      </section>
      <section className="panel document-page-panel monitoring-table">
        <div className="panel-heading">
          <div>
            <h2>Daftar evaluasi</h2>
            <p>{visibleEvaluations.length} evaluasi tersimpan</p>
          </div>
          <span className="table-caption">Data PostgreSQL</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dokumen</th>
                <th>Kontrol</th>
                <th>Proses</th>
                <th>Unit</th>
                <th>Periode</th>
                <th>Hasil</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Belum ada evaluasi. Tambahkan record pertama.
                  </td>
                </tr>
              ) : (
                visibleEvaluations.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => setSelectedEvaluation(item)}
                  >
                    <td>
                      <strong>
                        {item.document_title ?? "Dokumen belum dikaitkan"}
                      </strong>
                    </td>
                    <td>
                      <strong>{item.control}</strong>
                    </td>
                    <td>{item.process ?? "-"}</td>
                    <td>{item.owner}</td>
                    <td>{item.period}</td>
                    <td>
                      <span className="result result-ok">{item.result}</span>
                    </td>
                    <td>
                      <span className="status status-gray">{item.state}</span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="text-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEditEvaluation(item);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="danger-text"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeEvaluation(item);
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selectedEvaluation && (
        <section className="panel document-page-panel evaluation-detail-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">DETAIL EVALUASI</div>
              <h2>{selectedEvaluation.control}</h2>
              <p>
                {selectedEvaluation.document_title ?? "Dokumen belum dikaitkan"}
              </p>
            </div>
            <button
              className="filter-button"
              onClick={() => setSelectedEvaluation(null)}
            >
              Tutup detail
            </button>
          </div>
          <div className="evaluation-detail-grid">
            <div>
              <span>Proses</span>
              <strong>{selectedEvaluation.process || "-"}</strong>
            </div>
            <div>
              <span>Unit pemilik</span>
              <strong>{selectedEvaluation.owner}</strong>
            </div>
            <div>
              <span>Periode</span>
              <strong>{selectedEvaluation.period}</strong>
            </div>
            <div>
              <span>Hasil</span>
              <strong>{selectedEvaluation.result}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selectedEvaluation.state}</strong>
            </div>
          </div>
          <div className="evaluation-notes">
            <strong>Deskripsi / catatan evaluasi</strong>
            <p>
              {selectedEvaluation.notes ||
                "Belum ada deskripsi atau catatan evaluasi."}
            </p>
          </div>
        </section>
      )}
    </>
  );
}

function DynamicFindingsPage() {
  const [findings, setFindings] = useState<ApiFinding[]>([]);
  const [editingFinding, setEditingFinding] = useState<ApiFinding | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<ApiFinding | null>(
    null,
  );
  const [actions, setActions] = useState<ApiCorrectiveAction[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    owner: "",
    risk: "Sedang",
    dueDate: "",
  });
  const [actionForm, setActionForm] = useState({
    description: "",
    dueDate: "",
  });
  const [verificationNote, setVerificationNote] = useState("");
  const [error, setError] = useState("");
  const currentUser = readAuthUser();
  const canVerify =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "director";
  useEffect(() => {
    fetchFindings()
      .then(setFindings)
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Temuan gagal dimuat.",
        ),
      );
  }, []);
  const selectFinding = async (finding: ApiFinding) => {
    setSelectedFinding(finding);
    setActionFormOpen(false);
    try {
      setActions(await fetchFindingActions(finding.id));
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Tindakan gagal dimuat.",
      );
    }
  };
  const submitFinding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingFinding) {
        const finding = await updateFinding(editingFinding.id, form);
        setFindings((current) =>
          current.map((item) => (item.id === finding.id ? finding : item)),
        );
        if (selectedFinding?.id === finding.id) setSelectedFinding(finding);
      } else {
        const finding = await createFinding(form);
        setFindings((current) => [finding, ...current]);
      }
      setForm({
        title: "",
        description: "",
        owner: "",
        risk: "Sedang",
        dueDate: "",
      });
      setEditingFinding(null);
      setFormOpen(false);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Temuan gagal dibuat.",
      );
    }
  };

  const beginEditFinding = (finding: ApiFinding) => {
    setEditingFinding(finding);
    setForm({
      title: finding.title,
      description: finding.description,
      owner: finding.owner_unit,
      risk: finding.risk_level,
      dueDate: finding.due_date ?? "",
    });
    setFormOpen(true);
  };

  const removeFinding = async (finding: ApiFinding) => {
    if (
      !window.confirm(`Hapus temuan ${finding.title} beserta tindak lanjutnya?`)
    )
      return;
    try {
      await deleteFinding(finding.id);
      setFindings((current) =>
        current.filter((item) => item.id !== finding.id),
      );
      if (selectedFinding?.id === finding.id) {
        setSelectedFinding(null);
        setActions([]);
      }
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Temuan gagal dihapus.",
      );
    }
  };
  const submitAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFinding) return;
    try {
      const action = await createCorrectiveAction({
        findingId: selectedFinding.id,
        description: actionForm.description,
        dueDate: actionForm.dueDate,
      });
      setActions((current) => [...current, action]);
      setFindings((current) =>
        current.map((finding) =>
          finding.id === selectedFinding.id
            ? { ...finding, state: "Dalam Pengerjaan" }
            : finding,
        ),
      );
      setSelectedFinding({ ...selectedFinding, state: "Dalam Pengerjaan" });
      setActionForm({ description: "", dueDate: "" });
      setActionFormOpen(false);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Tindakan gagal dibuat.",
      );
    }
  };
  const submitVerification = async (action: ApiCorrectiveAction) => {
    try {
      const updated = await submitActionForVerification(action.id);
      setActions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setFindings((current) =>
        current.map((finding) =>
          finding.id === selectedFinding?.id
            ? { ...finding, state: "Diajukan Verifikasi" }
            : finding,
        ),
      );
      if (selectedFinding)
        setSelectedFinding({
          ...selectedFinding,
          state: "Diajukan Verifikasi",
        });
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Tindakan gagal diajukan.",
      );
    }
  };
  const verifyAction = async (
    action: ApiCorrectiveAction,
    decision: "Terverifikasi" | "Perlu Perbaikan",
  ) => {
    try {
      const updated = await verifyCorrectiveAction({
        actionId: action.id,
        decision,
        note: verificationNote,
      });
      setActions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      const nextState =
        decision === "Terverifikasi" ? "Terverifikasi" : "Perlu Perbaikan";
      setFindings((current) =>
        current.map((finding) =>
          finding.id === selectedFinding?.id
            ? { ...finding, state: nextState }
            : finding,
        ),
      );
      if (selectedFinding)
        setSelectedFinding({ ...selectedFinding, state: nextState });
      setVerificationNote("");
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Verifikasi gagal disimpan.",
      );
    }
  };
  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">IMPROVEMENT TRACKER</div>
          <h1>Temuan & tindak lanjut</h1>
          <p className="subheading">
            Temuan dan tenggat yang tersimpan di PostgreSQL.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setFormOpen((current) => !current)}
        >
          <AlertTriangle size={17} />
          {formOpen ? "Tutup form" : "Catat temuan"}
        </button>
      </section>
      {error && (
        <div className="login-error workflow-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      {formOpen && (
        <section className="panel dynamic-form-panel">
          <form className="upload-form" onSubmit={submitFinding}>
            <label>
              Judul temuan
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                required
              />
            </label>
            <label>
              Deskripsi
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Unit pemilik
                <input
                  value={form.owner}
                  onChange={(event) =>
                    setForm({ ...form, owner: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Risiko
                <select
                  value={form.risk}
                  onChange={(event) =>
                    setForm({ ...form, risk: event.target.value })
                  }
                >
                  <option>Rendah</option>
                  <option>Sedang</option>
                  <option>Tinggi</option>
                </select>
              </label>
            </div>
            <label>
              Tenggat
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm({ ...form, dueDate: event.target.value })
                }
              />
            </label>
            <button className="primary-button" type="submit">
              {editingFinding ? "Simpan perubahan" : "Simpan temuan"}
            </button>
            {editingFinding && (
              <button
                className="filter-button"
                type="button"
                onClick={() => {
                  setEditingFinding(null);
                  setFormOpen(false);
                }}
              >
                Batal edit
              </button>
            )}
          </form>
        </section>
      )}
      <div className="finding-stats">
        <span>
          <strong>
            {findings.filter((item) => item.state === "Terbuka").length}
          </strong>{" "}
          temuan terbuka
        </span>
        <span>
          <strong>{findings.length}</strong> total temuan
        </span>
      </div>
      <section className="panel document-page-panel">
        <div className="panel-heading">
          <div>
            <h2>Daftar temuan aktif</h2>
            <p>{findings.length} temuan tersimpan</p>
          </div>
          <span className="table-caption">Data PostgreSQL</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Temuan</th>
                <th>Unit</th>
                <th>Risiko</th>
                <th>PIC</th>
                <th>Tenggat</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {findings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Belum ada temuan. Tambahkan record pertama.
                  </td>
                </tr>
              ) : (
                findings.map((finding) => (
                  <tr
                    key={finding.id}
                    onClick={() => void selectFinding(finding)}
                    className="clickable-row"
                  >
                    <td>
                      <strong>{finding.title}</strong>
                      <span className="table-subtext">
                        {finding.description}
                      </span>
                    </td>
                    <td>{finding.owner_unit}</td>
                    <td>
                      <span
                        className={`risk-label risk-label-${finding.risk_level.toLowerCase()}`}
                      >
                        {finding.risk_level}
                      </span>
                    </td>
                    <td>{finding.assignee ?? "Belum ditugaskan"}</td>
                    <td>{finding.due_date ?? "-"}</td>
                    <td>
                      <span className="status status-amber">
                        {finding.state}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="text-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEditFinding(finding);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="danger-text"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeFinding(finding);
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selectedFinding && (
        <section className="panel document-page-panel finding-detail-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">DETAIL TEMUAN</div>
              <h2>{selectedFinding.title}</h2>
              <p>{selectedFinding.description || "Tidak ada deskripsi."}</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setActionFormOpen((current) => !current)}
            >
              {actionFormOpen ? "Tutup form" : "Tambah tindakan"}
            </button>
          </div>
          {actionFormOpen && (
            <form
              className="upload-form compact-action-form"
              onSubmit={submitAction}
            >
              <label>
                Rencana tindakan
                <textarea
                  value={actionForm.description}
                  onChange={(event) =>
                    setActionForm({
                      ...actionForm,
                      description: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Tenggat tindakan
                <input
                  type="date"
                  value={actionForm.dueDate}
                  onChange={(event) =>
                    setActionForm({
                      ...actionForm,
                      dueDate: event.target.value,
                    })
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Simpan tindakan
              </button>
            </form>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tindakan</th>
                  <th>PIC</th>
                  <th>Tenggat</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Belum ada tindakan korektif untuk temuan ini.
                    </td>
                  </tr>
                ) : (
                  actions.map((action) => (
                    <tr key={action.id}>
                      <td>
                        <strong>{action.description}</strong>
                        {action.verification_note && (
                          <span className="table-subtext">
                            Catatan: {action.verification_note}
                          </span>
                        )}
                      </td>
                      <td>
                        {action.assignee ??
                          selectedFinding.assignee ??
                          "Belum ditugaskan"}
                      </td>
                      <td>{action.due_date ?? "-"}</td>
                      <td>
                        <span className="status status-amber">
                          {action.state}
                        </span>
                      </td>
                      <td>
                        {!["Diajukan Verifikasi", "Terverifikasi"].includes(
                          action.state,
                        ) && (
                          <button
                            className="table-action"
                            onClick={() => void submitVerification(action)}
                          >
                            Ajukan verifikasi
                          </button>
                        )}
                        {canVerify &&
                          action.state === "Diajukan Verifikasi" && (
                            <div className="action-stack">
                              <input
                                placeholder="Catatan verifikasi"
                                value={verificationNote}
                                onChange={(event) =>
                                  setVerificationNote(event.target.value)
                                }
                              />
                              <button
                                className="table-action"
                                onClick={() =>
                                  void verifyAction(action, "Terverifikasi")
                                }
                              >
                                Verifikasi
                              </button>
                              <button
                                className="table-action secondary"
                                onClick={() =>
                                  void verifyAction(action, "Perlu Perbaikan")
                                }
                              >
                                Minta perbaikan
                              </button>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function AuditLogPage() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuditLogsFromApi()
      .then(setLogs)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Audit log gagal dimuat.",
        );
      });
  }, []);

  return (
    <>
      <section className="welcome-row compact">
        <div>
          <div className="eyebrow">KONTROL ADMINISTRATIF</div>
          <h1>Audit log</h1>
          <p className="subheading">
            Riwayat aktivitas penting yang tercatat dari backend.
          </p>
        </div>
        <span className="status status-green">
          <span className="status-dot" />
          Append-only
        </span>
      </section>
      {error ? (
        <div className="login-error workflow-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      ) : (
        <section className="panel document-page-panel audit-panel">
          <div className="table-meta">
            <span>
              Menampilkan <strong>{logs.length}</strong> aktivitas terbaru
            </span>
            <span className="table-caption">Admin only</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Entitas</th>
                  <th>Aktor</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                    <td>
                      <span className="audit-action">
                        {log.action.split(".").join(" · ")}
                      </span>
                    </td>
                    <td>{log.entityLabel}</td>
                    <td>{log.actorName}</td>
                    <td>
                      {Object.keys(log.metadata).length > 0
                        ? JSON.stringify(log.metadata)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const apiUser = await loginWithApi(email, password);
      onLogin(apiUser);
      return;
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login API gagal.",
      );
    }
  };

  return (
    <main className="login-shell">
      <section className="login-art">
        <div className="login-brand">
          <div className="brand-mark">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <strong>governance</strong>
            <span>COMTELINDO</span>
          </div>
        </div>
        <div className="login-art-copy">
          <div className="eyebrow">GOVERNANCE HUB</div>
          <h1>Satu ruang untuk tata kelola yang tertelusur.</h1>
          <p>
            Kelola dokumen, pengesahan, dan evaluasi implementasi dengan akses
            sesuai tanggung jawab.
          </p>
        </div>
        <div className="login-art-foot">
          <span>PT Comtelindo</span>
          <span>Versi uji awal · 2026</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-kicker">RUANG KERJA INTERNAL</div>
          <h2>Selamat datang kembali.</h2>
          <p className="login-intro">
            Masuk untuk melanjutkan ke Governance Hub.
          </p>
          <form className="login-form" onSubmit={submitLogin}>
            <label>
              Email kerja
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@comtelindo.co.id"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Kata sandi
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="login-error">
                <AlertTriangle size={15} />
                {error}
              </div>
            )}
            <button className="primary-button login-button" type="submit">
              <ShieldCheck size={17} />
              Masuk ke workspace
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function UploadModal({
  user,
  onClose,
  onUpload,
}: {
  user: AuthUser;
  onClose: () => void;
  onUpload: (document: AppDocument) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("XSOP / SOP");
  const [unit, setUnit] = useState(
    divisions.includes(user.unit) ? user.unit : divisions[0],
  );
  const [version, setVersion] = useState("1.0");
  const [lifecycleStatus, setLifecycleStatus] = useState<
    "Aktif" | "Direvisi" | "Dicabut"
  >("Aktif");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [managerApprovers, setManagerApprovers] = useState<ManagerApprover[]>(
    [],
  );
  const [managerApproverId, setManagerApproverId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchManagerApprovers()
      .then((managers) => {
        setManagerApprovers(managers);
        setManagerApproverId(managers[0]?.id ?? "");
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Daftar Manager gagal dimuat.",
        );
      });
  }, []);

  const submitUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Pilih file dokumen terlebih dahulu.");
      return;
    }
    if (!managerApproverId) {
      setError("Pilih Manager approver untuk tahap pemeriksaan divisi.");
      return;
    }
    setSaving(true);
    try {
      const fileData = await fileToDataUrl(file);
      await onUpload({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        type,
        unit: unit.trim(),
        version: version.trim(),
        managerApproverId,
        lifecycleStatus,
        description,
        changeSummary,
        effectiveDate,
        reviewDate,
        status: "Draft",
        effective: "Belum",
        review: "Belum dijadwalkan",
        source: "uploaded",
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData,
        uploadedBy: user.name,
        uploadedAt: new Date().toISOString(),
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload gagal.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="modal-layer" role="presentation">
      <button
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Tutup form upload"
      />
      <section
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <div className="modal-heading">
          <div>
            <div className="eyebrow">REGISTER TERKENDALI</div>
            <h2 id="upload-title">Tambah dokumen</h2>
            <p>
              Dokumen baru akan masuk sebagai Draft sampai diajukan melalui
              workflow.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </button>
        </div>
        <form className="upload-form" onSubmit={submitUpload}>
          <div className="form-grid">
            <label>
              Kode kanonis
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Contoh: XSOP-PROC-006"
                required
              />
            </label>
            <label>
              Versi
              <input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.0"
                required
              />
            </label>
          </div>
          <label>
            Judul dokumen
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nama dokumen resmi"
              required
            />
          </label>
          <label>
            Abstrak / deskripsi dokumen
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ringkasan isi dan tujuan dokumen"
            />
          </label>
          <label>
            Perubahan dari versi sebelumnya
            <textarea
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
              placeholder="Contoh: revisi alur approval dan penanggung jawab"
            />
          </label>
          <div className="form-grid">
            <label>
              Jenis
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option>XSOP / SOP</option>
                <option>SKD / Kebijakan</option>
                <option>Bisnis Proses</option>
                <option>Tata Kelola</option>
                <option>Instruksi Kerja</option>
                <option>Form / Template</option>
              </select>
            </label>
            <label>
              Unit pemilik
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                required
              >
                {divisions.map((division) => (
                  <option key={division}>{division}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Status dokumen
              <select
                value={lifecycleStatus}
                onChange={(event) =>
                  setLifecycleStatus(
                    event.target.value as "Aktif" | "Direvisi" | "Dicabut",
                  )
                }
              >
                <option>Aktif</option>
                <option>Direvisi</option>
                <option>Dicabut</option>
              </select>
            </label>
            <label>
              Tanggal berlaku
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </label>
            <label>
              Review berikutnya
              <input
                type="date"
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
              />
            </label>
          </div>
          <label>
            Manager approver
            <select
              value={managerApproverId}
              onChange={(event) => setManagerApproverId(event.target.value)}
              required
            >
              <option value="">Pilih Manager yang memeriksa</option>
              {managerApprovers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} · {manager.unit}
                </option>
              ))}
            </select>
          </label>
          <label className="file-drop">
            File sumber
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
            <span>
              {file
                ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
                : "PDF, DOCX, XLSX, PNG, JPG · Maks. 5 MB"}
            </span>
          </label>
          {error && (
            <div className="login-error">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="filter-button" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan sebagai draft"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PlaceholderPage({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
}) {
  const configs = {
    "Persetujuan Saya": [
      "Pusat keputusan Anda.",
      "3 pengajuan membutuhkan pemeriksaan atau pengesahan.",
    ],
    "Monitoring & Evaluasi": [
      "Monitoring & evaluasi.",
      "Pisahkan progres dokumen dari hasil implementasi dan kepatuhan.",
    ],
    "Temuan & Tindak Lanjut": [
      "Temuan dan tindak lanjut.",
      "Pantau bukti, PIC, tenggat, dan verifikasi hingga penutupan.",
    ],
    Administrasi: [
      "Administrasi workspace.",
      "Kelola unit, pengguna, role, workflow, dan konfigurasi akses.",
    ],
  } as const;
  const [title, text] = configs[page as keyof typeof configs] ?? [
    "Halaman belum tersedia",
    "Modul ini akan hadir pada tahap implementasi berikutnya.",
  ];
  return (
    <section className="empty-page">
      <div className="empty-illustration">
        <ShieldCheck size={35} />
      </div>
      <div className="eyebrow">MODUL {page.toUpperCase()}</div>
      <h1>{title}</h1>
      <p>{text}</p>
      <span className="coming-soon">Pratinjau modul</span>
      <button className="text-button" onClick={() => onNavigate("Dashboard")}>
        Kembali ke dashboard <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

function MoreIcon() {
  return (
    <span className="more-icon">
      <i />
      <i />
      <i />
    </span>
  );
}

export default App;
