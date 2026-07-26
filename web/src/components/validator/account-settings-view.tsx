"use client";

import { useEffect, useState } from "react";
import {
  AtSign,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dices,
  Image as ImageIcon,
  Layers3,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  User,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";

const PANEL = "border border-white/[0.065] bg-[#111311]";
const FIELD = "w-full rounded-xl border border-white/10 bg-[#071111] px-3.5 py-2.5 text-sm text-[#eef7ed] outline-none transition placeholder:text-[#61706d] focus:border-[#b8ff4b]/60 focus:ring-2 focus:ring-[#b8ff4b]/10 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#b8ff4b] px-4 py-2.5 text-xs font-bold text-[#07100d] transition hover:bg-[#ceff82] disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-[#b8c5c1] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

type Tone = "success" | "error" | "info";
type Props = {
  account: { id: string };
  notify: (message: string, tone?: Tone) => void;
};
type Mode = "manual" | "profileList" | "story";
type Session = {
  id: string;
  label: string;
  phone: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  isLoggedIn: boolean;
};
type SessionList = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    sessionId: string;
    session: Pick<Session, "id" | "label" | "phone" | "username" | "status" | "isLoggedIn">;
  }>;
};
type ContactList = {
  id: string;
  name: string;
  type: string;
  itemsCount: number;
};
type BatchJob = {
  id: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  result: Record<string, unknown> | null;
  session: { id: string; label: string; phone: string | null; username: string | null };
};
type Batch = {
  id: string;
  kind: string;
  status: string;
  totalCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  cancelRequested: boolean;
  metadata: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  jobs?: BatchJob[];
};
type Assignment = {
  sessionId: string;
  sessionLabel?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  clearUsername?: boolean;
  bio?: string;
  avatarId?: string;
  avatarUrl?: string;
  repeated?: boolean;
  sourceIndex?: number;
};
type MediaUpload = {
  filePath: string;
  fileName: string;
  previewUrl: string;
};
type StoryUpload = {
  mediaPath: string;
  mediaName: string;
  mediaType: "photo" | "video";
  mimeType: string;
  previewUrl: string;
};

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

function batchLabel(kind: string) {
  return {
    profile_update: "Manual profile update",
    photo_assignments: "Photo assignment",
    remove_photos: "Profile photo removal",
    profile_list: "Profile list",
    story: "Story upload",
  }[kind] || kind.replaceAll("_", " ");
}

export function AccountSettingsView({ notify }: Props) {
  const [mode, setMode] = useState<Mode>("manual");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionLists, setSessionLists] = useState<SessionList[]>([]);
  const [profileLists, setProfileLists] = useState<ContactList[]>([]);
  const [targetMode, setTargetMode] = useState<"sessions" | "list">("sessions");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectedSessionListId, setSelectedSessionListId] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [latestBatch, setLatestBatch] = useState<Batch | null>(null);
  const [activeBatchId, setActiveBatchId] = useState("");
  const [history, setHistory] = useState<Batch[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [manualPhoto, setManualPhoto] = useState<MediaUpload | null>(null);
  const [manualFlags, setManualFlags] = useState({ firstName: false, lastName: false, username: false, bio: false, profilePhoto: false });
  const [manualModes, setManualModes] = useState<Record<string, "set" | "remove">>({ firstName: "set", lastName: "set", username: "set", bio: "set", profilePhoto: "set" });
  const [confirmRemovePhotos, setConfirmRemovePhotos] = useState(false);

  const [photoDraft, setPhotoDraft] = useState<MediaUpload | null>(null);
  const [photoQueue, setPhotoQueue] = useState<Array<MediaUpload & { id: string; sessionIds: string[] }>>([]);

  const [selectedProfileListId, setSelectedProfileListId] = useState("");
  const [profileFlags, setProfileFlags] = useState({ firstName: true, lastName: true, username: true, bio: true, profilePhoto: true });
  const [profilePreview, setProfilePreview] = useState<{ assignments: Assignment[]; repeatsRequired: boolean; sessionCount: number } | null>(null);

  const [storyMedia, setStoryMedia] = useState<StoryUpload | null>(null);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyLink, setStoryLink] = useState("");
  const [storyPrivacy, setStoryPrivacy] = useState("everyone");
  const [storyPeriod, setStoryPeriod] = useState(86400);
  const [storyPinned, setStoryPinned] = useState(false);
  const [expandedStoryId, setExpandedStoryId] = useState("");
  const [storyDetail, setStoryDetail] = useState<Batch | null>(null);

  async function loadBase() {
    const [sessionData, listData, contactData, historyData] = await Promise.all([
      request<{ sessions: Session[] }>("/api/validator/telegram/sessions"),
      request<{ lists: SessionList[] }>("/api/validator/telegram/session-lists"),
      request<{ lists: ContactList[] }>("/api/validator/lists?limit=100&sort=createdAt&order=desc"),
      request<{ batches: Batch[] }>("/api/validator/account-settings/batches?limit=20"),
    ]);
    setSessions(sessionData.sessions || []);
    setSessionLists(listData.lists || []);
    const profiles = (contactData.lists || []).filter((list) => list.type === "profile");
    setProfileLists(profiles);
    setSelectedProfileListId((current) => current || profiles[0]?.id || "");
    setHistory(historyData.batches || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBase()
        .catch((error) => notify(error instanceof Error ? error.message : "Communication settings failed to load", "error"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeBatchId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const data = await request<{ batch: Batch }>(`/api/validator/account-settings/batches/${activeBatchId}`);
        if (stopped) return;
        setLatestBatch(data.batch);
        if (TERMINAL.has(data.batch.status)) {
          setActiveBatchId("");
          setHistory((current) => [data.batch, ...current.filter((batch) => batch.id !== data.batch.id)].slice(0, 20));
          notify(
            `${batchLabel(data.batch.kind)} finished: ${data.batch.succeededCount} succeeded, ${data.batch.failedCount} failed, ${data.batch.skippedCount} skipped.`,
            data.batch.failedCount ? "error" : "success",
          );
        }
      } catch {
        // Keep the last durable snapshot visible through transient poll errors.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeBatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSessions = sessions.filter((session) => session.status === "active" && session.isLoggedIn);
  const selectedList = sessionLists.find((list) => list.id === selectedSessionListId);
  const targetSessions = targetMode === "list"
    ? (selectedList?.members || []).map((member) => member.session).filter((session) => session.status === "active" && session.isLoggedIn)
    : selectedSessionIds.map((id) => sessions.find((session) => session.id === id)).filter((session): session is Session => !!session && session.status === "active" && session.isLoggedIn);
  const targetPayload = targetMode === "list"
    ? { sessionListId: selectedSessionListId }
    : { sessionIds: selectedSessionIds };

  function validateTargets() {
    if (targetMode === "list" && !selectedSessionListId) {
      notify("Choose a session list", "error");
      return false;
    }
    if (!targetSessions.length) {
      notify("Select at least one active session", "error");
      return false;
    }
    return true;
  }

  async function queueBatch(endpoint: string, body: unknown, operation: string) {
    setBusy(operation);
    try {
      const data = await request<{ batch: Batch; batchId: string }>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setLatestBatch(data.batch);
      setHistory((current) => [data.batch, ...current.filter((batch) => batch.id !== data.batch.id)].slice(0, 20));
      if (!TERMINAL.has(data.batch.status)) setActiveBatchId(data.batchId);
      notify(`${batchLabel(data.batch.kind)} queued for ${data.batch.totalCount} session(s).`, "success");
      return data.batch;
    } finally {
      setBusy("");
    }
  }

  async function cancelBatch(batch: Batch) {
    try {
      const data = await request<{ batch: Batch }>(`/api/validator/account-settings/batches/${batch.id}`, { method: "DELETE" });
      setLatestBatch(data.batch);
      setActiveBatchId(data.batch.id);
      notify("Cancellation requested. The current session may finish first.", "info");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Cancellation failed", "error");
    }
  }

  async function uploadPhoto(file: File) {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
    if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be 5MB or smaller");
    const form = new FormData();
    form.append("photo", file);
    const data = await request<{ filePath: string; fileName: string }>("/api/validator/account-settings/upload-photo", { method: "POST", body: form });
    return { ...data, previewUrl: URL.createObjectURL(file) };
  }

  async function handleManualPhoto(file?: File) {
    if (!file) return;
    setBusy("manual-photo");
    try {
      setManualPhoto(await uploadPhoto(file));
      setManualFlags((current) => ({ ...current, profilePhoto: true }));
      setManualModes((current) => ({ ...current, profilePhoto: "set" }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function submitManual(event: React.FormEvent) {
    event.preventDefault();
    if (!validateTargets()) return;
    if (!Object.values(manualFlags).some(Boolean)) {
      notify("Select at least one field to update", "error");
      return;
    }
    try {
      await queueBatch("/api/validator/account-settings/update", {
        ...targetPayload,
        firstName,
        lastName,
        username,
        bio,
        profilePhotoPath: manualPhoto?.filePath,
        updateFlags: manualFlags,
        fieldModes: manualModes,
      }, "manual");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Profile update failed", "error");
    }
  }

  async function removeAllPhotos() {
    if (!validateTargets()) return;
    try {
      await queueBatch("/api/validator/account-settings/remove-photos", targetPayload, "remove-photos");
      setConfirmRemovePhotos(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Photo removal failed", "error");
    }
  }

  async function handlePhotoDraft(file?: File) {
    if (!file) return;
    setBusy("photo-draft");
    try { setPhotoDraft(await uploadPhoto(file)); }
    catch (error) { notify(error instanceof Error ? error.message : "Upload failed", "error"); }
    finally { setBusy(""); }
  }

  function addPhotoQueueEntry() {
    if (!photoDraft || !validateTargets()) return;
    setPhotoQueue((current) => [...current, { ...photoDraft, id: crypto.randomUUID(), sessionIds: targetSessions.map((session) => session.id) }]);
    setPhotoDraft(null);
  }

  async function applyPhotoQueue() {
    if (!photoQueue.length) return;
    try {
      await queueBatch("/api/validator/account-settings/photo-assignments/apply", {
        assignments: photoQueue.map((item) => ({ photoPath: item.filePath, sessionIds: item.sessionIds })),
      }, "photo-queue");
      setPhotoQueue([]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Photo queue failed", "error");
    }
  }

  async function buildProfilePreview() {
    if (!selectedProfileListId || !validateTargets()) return;
    setBusy("profile-preview");
    try {
      const data = await request<{ assignments: Assignment[]; repeatsRequired: boolean; sessionCount: number }>("/api/validator/account-settings/profile-list/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: selectedProfileListId, ...targetPayload, flags: profileFlags }),
      });
      setProfilePreview(data);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Preview failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function applyProfileList() {
    if (!profilePreview) return;
    try {
      await queueBatch("/api/validator/account-settings/profile-list/apply", {
        listId: selectedProfileListId,
        assignments: profilePreview.assignments,
      }, "profile-list");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Profile list failed", "error");
    }
  }

  async function uploadStory(file?: File) {
    if (!file) return;
    setBusy("story-upload");
    try {
      const form = new FormData();
      form.append("media", file);
      const data = await request<Omit<StoryUpload, "previewUrl">>("/api/validator/account-settings/story/upload", { method: "POST", body: form });
      setStoryMedia({ ...data, previewUrl: URL.createObjectURL(file) });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Story upload failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function postStory() {
    if (!storyMedia || !validateTargets()) return;
    try {
      await queueBatch("/api/validator/account-settings/story", {
        ...targetPayload,
        ...storyMedia,
        caption: storyCaption,
        linkUrl: storyLink,
        privacy: storyPrivacy,
        periodSeconds: storyPeriod,
        pinToProfile: storyPinned,
      }, "story");
      setStoryMedia(null);
      setStoryCaption("");
      setStoryLink("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Story post failed", "error");
    }
  }

  async function toggleStoryDetails(batch: Batch) {
    if (expandedStoryId === batch.id) {
      setExpandedStoryId("");
      return;
    }
    setExpandedStoryId(batch.id);
    try {
      const data = await request<{ batch: Batch }>(`/api/validator/account-settings/batches/${batch.id}`);
      setStoryDetail(data.batch);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load story results", "error");
    }
  }

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-[#b8ff4b]" /></div>;

  const picker = (
    <SessionPicker
      sessions={sessions}
      activeSessions={activeSessions}
      lists={sessionLists}
      mode={targetMode}
      setMode={setTargetMode}
      selectedIds={selectedSessionIds}
      setSelectedIds={setSelectedSessionIds}
      selectedListId={selectedSessionListId}
      setSelectedListId={setSelectedSessionListId}
      showAll={showAllSessions}
      setShowAll={setShowAllSessions}
    />
  );

  const tabs = (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#071111] p-1">
      {([
        ["manual", "Manual", Pencil],
        ["profileList", "Profile list", ListChecks],
        ["story", "Story", Upload],
      ] as const).map(([id, label, Icon]) => (
        <button key={id} type="button" onClick={() => setMode(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === id ? "bg-[#b8ff4b] text-[#07100d]" : "text-[#71807c] hover:bg-white/[0.04] hover:text-white"}`}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#b8ff4b]"><span className="h-px w-7 bg-current" /> Communication settings</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Shape every profile.<br /><span className="text-[#71807c]">Keep every result accountable.</span></h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#71807c]">Profile changes and stories run as durable Hydrogram jobs. Closing this page does not stop the work.</p>
        </div>
        {tabs}
      </div>

      {latestBatch && <BatchProgress batch={latestBatch} onCancel={() => cancelBatch(latestBatch)} />}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div>
          {mode === "manual" && (
            <form onSubmit={submitManual} className="space-y-5">
              <section className={`${PANEL} rounded-[24px] border-red-500/20 p-5`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-300"><Trash2 size={17} /></span>
                  <div className="flex-1"><h3 className="text-sm font-semibold">Remove all profile photos</h3><p className="mt-1 text-[10px] leading-4 text-[#60706b]">Deletes the visible avatar and complete photo history. This cannot be undone.</p></div>
                  {!confirmRemovePhotos ? (
                    <button type="button" onClick={() => setConfirmRemovePhotos(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-200"><Trash2 size={13} /> Remove all</button>
                  ) : (
                    <div className="flex gap-2"><button type="button" onClick={() => setConfirmRemovePhotos(false)} className={SECONDARY}>Keep photos</button><button type="button" onClick={removeAllPhotos} disabled={busy === "remove-photos"} className="inline-flex items-center gap-2 rounded-xl bg-red-400 px-4 py-2.5 text-xs font-bold text-[#1d0808]">Confirm removal</button></div>
                  )}
                </div>
              </section>

              <section className={`${PANEL} rounded-[24px] p-5`}>
                <SectionTitle icon={User} title="Profile fields" copy="Choose exactly which fields Hydrogram should change on every target." />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ManualField label="First name" enabled={manualFlags.firstName} setEnabled={(value) => setManualFlags((current) => ({ ...current, firstName: value }))} mode="set" setMode={() => undefined} setOnly>
                    <input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={!manualFlags.firstName} maxLength={64} placeholder="First name" className={FIELD} />
                  </ManualField>
                  <ManualField label="Last name" enabled={manualFlags.lastName} setEnabled={(value) => setManualFlags((current) => ({ ...current, lastName: value }))} mode={manualModes.lastName} setMode={(value) => setManualModes((current) => ({ ...current, lastName: value }))}>
                    <input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={!manualFlags.lastName || manualModes.lastName === "remove"} maxLength={64} placeholder={manualModes.lastName === "remove" ? "Will be cleared" : "Last name"} className={FIELD} />
                  </ManualField>
                  <ManualField label="Username" enabled={manualFlags.username} setEnabled={(value) => setManualFlags((current) => ({ ...current, username: value }))} mode={manualModes.username} setMode={(value) => setManualModes((current) => ({ ...current, username: value }))}>
                    <div className="relative"><AtSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60706b]" /><input value={username} onChange={(event) => setUsername(event.target.value.replace(/^@/, ""))} disabled={!manualFlags.username || manualModes.username === "remove"} maxLength={32} placeholder={manualModes.username === "remove" ? "Will be cleared" : "username"} className={`${FIELD} pl-9`} /></div>
                  </ManualField>
                  <ManualField label={`Bio (${bio.length}/70)`} enabled={manualFlags.bio} setEnabled={(value) => setManualFlags((current) => ({ ...current, bio: value }))} mode={manualModes.bio} setMode={(value) => setManualModes((current) => ({ ...current, bio: value }))}>
                    <textarea value={bio} onChange={(event) => setBio(event.target.value.slice(0, 70))} disabled={!manualFlags.bio || manualModes.bio === "remove"} rows={3} placeholder={manualModes.bio === "remove" ? "Will be cleared" : "Short bio"} className={`${FIELD} resize-none`} />
                  </ManualField>
                </div>
                <div className="mt-4">
                  <ManualField label="Profile photo" enabled={manualFlags.profilePhoto} setEnabled={(value) => setManualFlags((current) => ({ ...current, profilePhoto: value }))} mode={manualModes.profilePhoto} setMode={(value) => setManualModes((current) => ({ ...current, profilePhoto: value }))}>
                    {manualModes.profilePhoto === "remove" ? <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-200">All profile photos will be removed from each target.</p> : <UploadBox busy={busy === "manual-photo"} preview={manualPhoto?.previewUrl} label={manualPhoto?.fileName || "Upload JPG, PNG, or WebP"} onFile={handleManualPhoto} disabled={!manualFlags.profilePhoto} />}
                  </ManualField>
                </div>
              </section>

              <section className={`${PANEL} rounded-[24px] p-5`}>
                <SectionTitle icon={Layers3} title="Per-session photo queue" copy="Upload a photo, capture the current targets, and repeat before applying." />
                <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-center">
                  <UploadBox busy={busy === "photo-draft"} preview={photoDraft?.previewUrl} label={photoDraft?.fileName || "Upload photo"} onFile={handlePhotoDraft} compact />
                  <div className="text-xs text-[#71807c]"><p>{targetSessions.length} current target(s)</p><p className="mt-1">{photoQueue.length} assignment group(s) queued</p></div>
                  <button type="button" onClick={addPhotoQueueEntry} disabled={!photoDraft} className={SECONDARY}><Plus size={13} /> Add assignment</button>
                </div>
                {photoQueue.length > 0 && <div className="mt-4 space-y-2">{photoQueue.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#071111] p-2.5"><img src={item.previewUrl} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs">{item.fileName}</p><p className="text-[9px] text-[#60706b]">{item.sessionIds.length} session(s)</p></div><button type="button" onClick={() => setPhotoQueue((current) => current.filter((entry) => entry.id !== item.id))} className="text-[#71807c] hover:text-red-300"><X size={14} /></button></div>)}</div>}
                <div className="mt-4 flex justify-end"><button type="button" onClick={applyPhotoQueue} disabled={!photoQueue.length || busy === "photo-queue"} className={PRIMARY}><Save size={13} /> Apply queue</button></div>
              </section>

              <div className="flex justify-end"><button disabled={busy === "manual"} className={PRIMARY}>{busy === "manual" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Queue profile update</button></div>
            </form>
          )}

          {mode === "profileList" && (
            <div className="space-y-5">
              <section className={`${PANEL} rounded-[24px] p-5`}>
                <SectionTitle icon={ListChecks} title="Profile source" copy="Rows cycle when the list is shorter than the target set. Reused usernames receive unique suffixes." />
                <div className="mt-4 space-y-2">{profileLists.map((list) => <button key={list.id} type="button" onClick={() => { setSelectedProfileListId(list.id); setProfilePreview(null); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedProfileListId === list.id ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.07]" : "border-white/[0.07] bg-[#071111] hover:border-white/15"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selectedProfileListId === list.id ? "bg-[#b8ff4b] text-[#07100d]" : "bg-white/[0.04] text-[#71807c]"}`}><ListChecks size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{list.name}</span><span className="text-[9px] text-[#60706b]">{list.itemsCount} profile row(s)</span></span>{selectedProfileListId === list.id && <CheckCircle2 size={17} className="text-[#b8ff4b]" />}</button>)}</div>
                {!profileLists.length && <p className="mt-4 rounded-xl border border-[#f4ca64]/20 bg-[#f4ca64]/[0.05] p-3 text-xs text-[#c8ad69]">No profile lists found. Import one from Lists using the Profile type.</p>}
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.keys(profileFlags).map((field) => <FlagCard key={field} label={field.replace(/([A-Z])/g, " $1")} checked={profileFlags[field as keyof typeof profileFlags]} onChange={() => { setProfileFlags((current) => ({ ...current, [field]: !current[field as keyof typeof current] })); setProfilePreview(null); }} />)}</div>
                <button type="button" onClick={buildProfilePreview} disabled={!selectedProfileListId || busy === "profile-preview"} className={`${PRIMARY} mt-5`}>{busy === "profile-preview" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Build preview</button>
              </section>
              {profilePreview && <><div className="rounded-xl border border-white/[0.07] bg-[#071111] p-3 text-xs text-[#71807c]">{profilePreview.sessionCount} target(s). {profilePreview.repeatsRequired ? "List rows repeat; usernames remain unique." : "Every target uses a distinct source row."}</div><AssignmentTable assignments={profilePreview.assignments} /></>}
              {profilePreview && <div className="flex justify-end"><button type="button" onClick={applyProfileList} disabled={busy === "profile-list"} className={PRIMARY}><ListChecks size={14} /> Apply profile list</button></div>}
            </div>
          )}

          {mode === "story" && (
            <div className="space-y-5">
              <section className={`${PANEL} rounded-[24px] p-5`}>
                <SectionTitle icon={Upload} title="Story composer" copy="Hydrogram checks live Premium eligibility and story limits per session before posting." />
                {!storyMedia ? <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-[#071111] p-10 text-center transition hover:border-[#b8ff4b]/35"><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => void uploadStory(event.target.files?.[0])} />{busy === "story-upload" ? <Loader2 size={26} className="animate-spin text-[#b8ff4b]" /> : <Upload size={26} className="text-[#60706b]" />}<p className="mt-3 text-sm font-semibold">Upload a photo or video</p><p className="mt-1 text-[10px] text-[#60706b]">JPG, PNG, WebP, MP4, WebM, or MOV up to 50MB</p></label> : <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#071111] p-3"><div className="h-28 w-24 overflow-hidden rounded-xl bg-black/30">{storyMedia.mediaType === "video" ? <video src={storyMedia.previewUrl} className="h-full w-full object-cover" muted /> : <img src={storyMedia.previewUrl} alt="Story preview" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{storyMedia.mediaName}</p><p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#60706b]">{storyMedia.mediaType === "video" ? <Video size={12} /> : <ImageIcon size={12} />}{storyMedia.mediaType}</p></div><button type="button" onClick={() => setStoryMedia(null)} className="rounded-xl border border-white/10 p-2 text-[#71807c] hover:text-red-300"><X size={15} /></button></div>}
                <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Caption<textarea value={storyCaption} onChange={(event) => setStoryCaption(event.target.value.slice(0, 2048))} rows={4} placeholder="Optional story caption" className={`${FIELD} mt-2 resize-none`} /></label><label className="text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Link<input value={storyLink} onChange={(event) => setStoryLink(event.target.value)} type="url" placeholder="https://example.com" className={`${FIELD} mt-2`} /><span className="mt-1 block font-normal normal-case tracking-normal text-[#60706b]">Appended as a tappable caption link.</span></label></div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Visible to</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{[["everyone", "Everyone", Users], ["contacts", "Contacts", User], ["close_friends", "Close friends", CheckCircle2]] .map(([value, label, Icon]) => { const ChoiceIcon = Icon as typeof Users; return <button key={value as string} type="button" onClick={() => setStoryPrivacy(value as string)} className={`flex items-center gap-2 rounded-xl border p-3 text-xs transition ${storyPrivacy === value ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.07] text-[#dfffaa]" : "border-white/[0.07] bg-[#071111] text-[#71807c]"}`}><ChoiceIcon size={14} /> {label as string}</button>; })}</div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-[#6d7b77]">Duration</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[[21600, "6 hours"], [43200, "12 hours"], [86400, "24 hours"], [172800, "48 hours"]].map(([value, label]) => <button key={value} type="button" onClick={() => setStoryPeriod(value as number)} className={`rounded-xl border p-3 text-xs transition ${storyPeriod === value ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.07] text-[#dfffaa]" : "border-white/[0.07] bg-[#071111] text-[#71807c]"}`}>{label}</button>)}</div>
                <button type="button" onClick={() => setStoryPinned((value) => !value)} className={`mt-4 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${storyPinned ? "border-[#f4ca64]/30 bg-[#f4ca64]/[0.06]" : "border-white/[0.07] bg-[#071111]"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${storyPinned ? "border-[#f4ca64] bg-[#f4ca64] text-[#07100d]" : "border-white/15"}`}>{storyPinned && <Check size={13} />}</span><span><span className="block text-xs font-semibold">Keep on profile</span><span className="text-[9px] text-[#60706b]">Pin the story after it expires.</span></span></button>
                <button type="button" onClick={postStory} disabled={!storyMedia || busy === "story"} className={`${PRIMARY} mt-5 w-full`}>{busy === "story" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Post story to {targetSessions.length} target(s)</button>
              </section>
              <StoryHistory batches={history.filter((batch) => batch.kind === "story")} expandedId={expandedStoryId} detail={storyDetail} onToggle={toggleStoryDetails} onCancel={cancelBatch} />
            </div>
          )}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">{picker}<TargetSummary mode={targetMode} sessions={targetSessions} list={selectedList} /></aside>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, copy }: { icon: typeof User; title: string; copy: string }) {
  return <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b8ff4b]/10 text-[#b8ff4b]"><Icon size={17} /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-[10px] leading-4 text-[#60706b]">{copy}</p></div></div>;
}

function ManualField({ label, enabled, setEnabled, mode, setMode, setOnly = false, children }: { label: string; enabled: boolean; setEnabled: (value: boolean) => void; mode: "set" | "remove"; setMode: (value: "set" | "remove") => void; setOnly?: boolean; children: React.ReactNode }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#071111] p-3"><div className="mb-2 flex items-center gap-2"><button type="button" onClick={() => setEnabled(!enabled)} className={`flex h-4 w-4 items-center justify-center rounded border ${enabled ? "border-[#b8ff4b] bg-[#b8ff4b] text-[#07100d]" : "border-white/20"}`}>{enabled && <Check size={11} />}</button><span className="text-xs font-semibold text-[#cbd7d2]">{label}</span>{setOnly ? <span className="ml-auto text-[9px] text-[#53615d]">Set only</span> : <span className="ml-auto inline-flex rounded-lg border border-white/10 p-0.5"><button type="button" disabled={!enabled} onClick={() => setMode("set")} className={`rounded-md px-2 py-1 text-[9px] ${mode === "set" ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "text-[#60706b]"}`}>Set</button><button type="button" disabled={!enabled} onClick={() => setMode("remove")} className={`rounded-md px-2 py-1 text-[9px] ${mode === "remove" ? "bg-red-500/15 text-red-300" : "text-[#60706b]"}`}>Remove</button></span>}</div>{children}</div>;
}

function UploadBox({ busy, preview, label, onFile, disabled = false, compact = false }: { busy: boolean; preview?: string; label: string; onFile: (file?: File) => void; disabled?: boolean; compact?: boolean }) {
  return <label className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#071111] ${compact ? "p-3" : "p-5"} text-xs text-[#81908c] transition hover:border-[#b8ff4b]/35 ${disabled ? "pointer-events-none opacity-40" : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />{busy ? <Loader2 size={18} className="animate-spin text-[#b8ff4b]" /> : preview ? <img src={preview} alt="" className={`${compact ? "h-10 w-10" : "h-14 w-14"} rounded-full object-cover`} /> : <Upload size={18} />}<span className="min-w-0 truncate">{label}</span></label>;
}

function FlagCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <button type="button" onClick={onChange} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs capitalize transition ${checked ? "border-[#b8ff4b]/35 bg-[#b8ff4b]/[0.07] text-[#dfffaa]" : "border-white/[0.07] bg-[#071111] text-[#71807c]"}`}><span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-[#b8ff4b] bg-[#b8ff4b] text-[#07100d]" : "border-white/15"}`}>{checked && <Check size={11} />}</span>{label}</button>;
}

function SessionPicker({ sessions, activeSessions, lists, mode, setMode, selectedIds, setSelectedIds, selectedListId, setSelectedListId, showAll, setShowAll }: { sessions: Session[]; activeSessions: Session[]; lists: SessionList[]; mode: "sessions" | "list"; setMode: (value: "sessions" | "list") => void; selectedIds: string[]; setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>; selectedListId: string; setSelectedListId: (value: string) => void; showAll: boolean; setShowAll: (value: boolean) => void }) {
  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(true);
  const selectedList = lists.find((list) => list.id === selectedListId);
  const visibleSessions = (showAll ? sessions : activeSessions).filter((session) => `${session.label} ${session.username || ""} ${session.phone || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className={`${PANEL} rounded-[24px] p-5`}><div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#071111] p-1"><button type="button" onClick={() => setMode("sessions")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs ${mode === "sessions" ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "text-[#71807c]"}`}><Users size={13} /> Pick sessions</button><button type="button" onClick={() => setMode("list")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs ${mode === "list" ? "bg-[#b8ff4b]/15 text-[#b8ff4b]" : "text-[#71807c]"}`}><Layers3 size={13} /> Use list</button></div>
    {mode === "sessions" ? <><div className="mt-4 flex items-center gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sessions" className={`${FIELD} py-2 text-xs`} /><button type="button" onClick={() => setShowAll(!showAll)} className="shrink-0 text-[9px] text-[#71807c]">{showAll ? "Active only" : "Show all"}</button></div><div className="mt-3 flex items-center gap-2 text-[9px]"><span className="text-[#60706b]">{selectedIds.length} selected</span><button type="button" onClick={() => setSelectedIds(activeSessions.map((session) => session.id))} className="text-[#b8ff4b]">Select all active</button><button type="button" onClick={() => setSelectedIds([])} className="ml-auto text-[#71807c]">Clear</button></div><div className="mt-3 max-h-80 space-y-1 overflow-y-auto">{visibleSessions.map((session) => { const active = session.status === "active" && session.isLoggedIn; const selected = selectedIds.includes(session.id); return <button key={session.id} type="button" disabled={!active} onClick={() => setSelectedIds((current) => current.includes(session.id) ? current.filter((id) => id !== session.id) : [...current, session.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#b8ff4b]/30 bg-[#b8ff4b]/[0.07]" : "border-white/[0.06] bg-[#071111]"} ${!active ? "opacity-40" : ""}`}><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected ? "border-[#b8ff4b] bg-[#b8ff4b] text-[#07100d]" : "border-white/15"}`}>{selected && <Check size={11} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{session.label}</span><span className="block truncate text-[9px] text-[#60706b]">{session.username ? `@${session.username}` : session.phone || "No identity"}</span></span><span className={`h-2 w-2 rounded-full ${active ? "bg-[#b8ff4b]" : "bg-[#60706b]"}`} /></button>; })}</div></> : <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#071111]">{lists.map((list) => { const selected = selectedListId === list.id; return <button key={list.id} type="button" onClick={() => { setSelectedListId(list.id); setPreviewOpen(true); }} className={`flex w-full items-center gap-3 border-b border-white/[0.05] p-3 text-left last:border-0 ${selected ? "bg-[#b8ff4b]/[0.07]" : "hover:bg-white/[0.03]"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${selected ? "bg-[#b8ff4b] text-[#07100d]" : "bg-white/[0.04] text-[#71807c]"}`}>{list.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{list.name}</span><span className="block truncate text-[9px] text-[#60706b]">{list.description || `${list.members.length} sessions`}</span></span>{selected && <CheckCircle2 size={17} className="text-[#b8ff4b]" />}</button>; })}{!lists.length && <p className="p-5 text-center text-xs text-[#60706b]">No session lists yet.</p>}{selectedList && <><button type="button" onClick={() => setPreviewOpen(!previewOpen)} className="flex w-full items-center justify-between border-t border-white/[0.07] px-3 py-2 text-[10px] text-[#71807c]"><span>{previewOpen ? "Hide" : "Show"} {selectedList.members.length} members</span>{previewOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{previewOpen && <div className="max-h-48 overflow-y-auto border-t border-white/[0.05]">{selectedList.members.map((member) => <div key={member.sessionId} className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2 text-[10px] last:border-0"><span className={`h-1.5 w-1.5 rounded-full ${member.session.status === "active" && member.session.isLoggedIn ? "bg-[#b8ff4b]" : "bg-[#60706b]"}`} /><span className="min-w-0 flex-1 truncate">{member.session.label}</span><span className="truncate text-[#60706b]">{member.session.username ? `@${member.session.username}` : member.session.phone}</span></div>)}</div>}</>}</div>}</section>;
}

function TargetSummary({ mode, sessions, list }: { mode: "sessions" | "list"; sessions: Array<Pick<Session, "id" | "label">>; list?: SessionList }) {
  return <section className={`${PANEL} rounded-[24px] p-5`}><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#b8ff4b]">Target summary</p><p className="mt-3 text-2xl font-semibold">{sessions.length}</p><p className="text-xs text-[#71807c]">active session(s) ready</p>{mode === "list" && <p className="mt-3 rounded-xl border border-white/[0.07] bg-[#071111] p-3 text-xs">{list?.name || "No list selected"}</p>}<div className="mt-3 max-h-36 space-y-1 overflow-y-auto">{sessions.slice(0, 20).map((session) => <p key={session.id} className="truncate text-[10px] text-[#60706b]">{session.label}</p>)}</div></section>;
}

function BatchProgress({ batch, onCancel }: { batch: Batch; onCancel: () => void }) {
  const progress = batch.totalCount ? Math.round((batch.processedCount / batch.totalCount) * 100) : 0;
  return <section className={`mt-5 overflow-hidden rounded-[20px] border ${batch.failedCount ? "border-red-500/20 bg-red-500/[0.035]" : "border-[#65e6ff]/20 bg-[#65e6ff]/[0.035]"}`}><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]">{TERMINAL.has(batch.status) ? <CheckCircle2 size={17} className={batch.failedCount ? "text-red-300" : "text-[#b8ff4b]"} /> : <Loader2 size={17} className="animate-spin text-[#65e6ff]" />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{batchLabel(batch.kind)}</p><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#81908c]">{batch.status}</span></div><p className="mt-1 text-[10px] text-[#60706b]">{batch.processedCount}/{batch.totalCount} processed | {batch.succeededCount} succeeded | {batch.failedCount} failed | {batch.skippedCount} skipped</p></div>{!TERMINAL.has(batch.status) && <button type="button" onClick={onCancel} disabled={batch.cancelRequested} className={SECONDARY}><Ban size={13} /> {batch.cancelRequested ? "Cancelling" : "Cancel"}</button>}</div><div className="h-1 bg-white/[0.05]"><div className="h-full bg-gradient-to-r from-[#65e6ff] to-[#b8ff4b] transition-[width]" style={{ width: `${progress}%` }} /></div>{batch.jobs && batch.jobs.some((job) => job.status === "failed") && <div className="border-t border-white/[0.06] p-3">{batch.jobs.filter((job) => job.status === "failed").slice(0, 3).map((job) => <p key={job.id} className="truncate text-[10px] text-red-300">{job.session.label}: {job.errorMessage}</p>)}</div>}</section>;
}

function AssignmentTable({ assignments, editable = false, onEdit, onReroll }: { assignments: Assignment[]; editable?: boolean; onEdit?: (sessionId: string, field: keyof Assignment, value: string) => void; onReroll?: (sessionId: string) => void }) {
  return <section className={`${PANEL} overflow-hidden rounded-[24px]`}><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><h3 className="text-sm font-semibold">Assignment preview</h3><span className="text-[10px] text-[#60706b]">{assignments.length} session(s)</span></div><div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[#0b1717]"><tr className="border-b border-white/[0.07] text-[9px] uppercase tracking-wider text-[#60706b]"><th className="px-4 py-3">Session</th><th className="px-4 py-3">Photo</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Bio</th>{onReroll && <th className="px-4 py-3" />}</tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.sessionId} className="border-b border-white/[0.05] last:border-0"><td className="px-4 py-3"><p className="max-w-36 truncate font-semibold">{assignment.sessionLabel || assignment.sessionId}</p>{assignment.repeated && <span className="text-[9px] text-[#f4ca64]">Repeated row #{(assignment.sourceIndex || 0) + 1}</span>}</td><td className="px-4 py-3">{assignment.avatarUrl ? <img src={assignment.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-[#53615d]">Unchanged</span>}</td><td className="px-4 py-3">{editable ? <div className="flex gap-1"><input value={assignment.firstName || ""} onChange={(event) => onEdit?.(assignment.sessionId, "firstName", event.target.value)} className="w-24 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5" /><input value={assignment.lastName || ""} onChange={(event) => onEdit?.(assignment.sessionId, "lastName", event.target.value)} className="w-24 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5" /></div> : <span>{[assignment.firstName, assignment.lastName].filter(Boolean).join(" ") || "Unchanged"}</span>}</td><td className="px-4 py-3">{editable ? <input value={assignment.username || ""} onChange={(event) => onEdit?.(assignment.sessionId, "username", event.target.value.replace(/^@/, ""))} className="w-36 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5" /> : assignment.clearUsername ? <span className="text-[#f4ca64]">Will be cleared</span> : assignment.username ? `@${assignment.username}` : "Unchanged"}</td><td className="px-4 py-3">{editable ? <input value={assignment.bio || ""} onChange={(event) => onEdit?.(assignment.sessionId, "bio", event.target.value.slice(0, 70))} className="w-48 rounded-lg border border-white/10 bg-[#071111] px-2 py-1.5" /> : <span className="block max-w-48 truncate text-[#81908c]">{assignment.bio ?? "Unchanged"}</span>}</td>{onReroll && <td className="px-4 py-3"><button type="button" onClick={() => onReroll(assignment.sessionId)} className="rounded-lg border border-white/10 p-2 text-[#71807c] hover:text-[#b8ff4b]"><Dices size={13} /></button></td>}</tr>)}</tbody></table></div></section>;
}

function StoryHistory({ batches, expandedId, detail, onToggle, onCancel }: { batches: Batch[]; expandedId: string; detail: Batch | null; onToggle: (batch: Batch) => void; onCancel: (batch: Batch) => void }) {
  return <section className={`${PANEL} rounded-[24px] p-5`}><div className="flex items-center gap-2"><Clock size={15} className="text-[#65e6ff]" /><h3 className="text-sm font-semibold">Story history</h3></div><div className="mt-4 space-y-2">{batches.map((batch) => <div key={batch.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#071111]"><button type="button" onClick={() => onToggle(batch)} className="flex w-full items-center gap-3 p-3 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04]">{batch.metadata?.mediaType === "video" ? <Video size={14} /> : <ImageIcon size={14} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{String(batch.metadata?.mediaName || "Story")}</span><span className="text-[9px] text-[#60706b]">{new Date(batch.createdAt).toLocaleString()}</span></span><span className="text-[10px] text-[#b8ff4b]">{batch.succeededCount} posted</span>{batch.failedCount > 0 && <span className="text-[10px] text-red-300">{batch.failedCount} failed</span>}{batch.skippedCount > 0 && <span className="text-[10px] text-[#71807c]">{batch.skippedCount} skipped</span>}{!TERMINAL.has(batch.status) && <button type="button" onClick={(event) => { event.stopPropagation(); void onCancel(batch); }} className="text-red-300"><Ban size={13} /></button>}</button>{expandedId === batch.id && <div className="border-t border-white/[0.06] p-3">{detail?.id !== batch.id ? <Loader2 size={14} className="animate-spin text-[#65e6ff]" /> : <div className="max-h-56 space-y-1 overflow-y-auto">{detail.jobs?.map((job) => <div key={job.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] hover:bg-white/[0.03]"><span className="min-w-0 flex-1 truncate">{job.session.label}</span>{job.status === "completed" ? <span className="flex items-center gap-1 text-[#b8ff4b]"><Check size={11} /> Posted</span> : job.status === "skipped" ? <span className="text-[#f4ca64]">{String(job.result?.skipReason || "Skipped").replaceAll("_", " ")}</span> : job.status === "failed" ? <span className="flex items-center gap-1 text-red-300" title={job.errorMessage || ""}><XCircle size={11} /> Failed</span> : <span className="text-[#65e6ff]">{job.status}</span>}</div>)}</div>}</div>}</div>)}{!batches.length && <p className="py-8 text-center text-xs text-[#60706b]">No story jobs yet.</p>}</div></section>;
}
