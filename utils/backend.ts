/**
 * Client for the optional PHP backend (php/api/*.php) used by the
 * shared-hosting build. When NEXT_PUBLIC_BACKEND is not "php" the app runs
 * fully in the browser and none of this is used.
 */

export const BACKEND_ENABLED = process.env.NEXT_PUBLIC_BACKEND === "php";

const API_ROOT = "/api";

export interface User {
  uid: string;
  name: string;
  role: "ogrenci" | "ogretmen";
  sinif: string;
}

export interface AuthStatus {
  user: User | null;
  portalUrl: string;
  uploadLimit: number;
}

export interface Student {
  uid: string;
  name: string;
  sinif: string;
  lastLogin: number | null;
  fileCount: number;
  lastModified: number | null;
}

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  mtime: number;
}

export interface FileList {
  path: string;
  items: FileItem[];
  usage?: number;
  quota?: number;
  /** Set when a teacher views a student's files (read-only). */
  owner?: { uid: string; name: string; sinif: string };
  readOnly?: boolean;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  script: string,
  action: string,
  {
    query = {},
    json,
    body,
  }: {
    query?: Record<string, string>;
    json?: unknown;
    body?: BodyInit;
  } = {},
): Promise<T> {
  const params = new URLSearchParams({ action, ...query });
  const post = json !== undefined || body !== undefined;
  const res = await fetch(`${API_ROOT}/${script}.php?${params}`, {
    method: post ? "POST" : "GET",
    credentials: "same-origin",
    headers: {
      "X-Office": "1",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response: PHP missing, upload limit hit, server error page...
  }
  if (!res.ok || !data?.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("office:unauthorized"));
    }
    throw new ApiError(
      data?.error || "http_" + res.status,
      data?.message || `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}

// --- Auth (sign-in itself happens on the portal, see php/giris.php) --------

export const auth = {
  status: () => request<AuthStatus>("auth", "status"),
  logout: () => request<{ portalUrl: string }>("auth", "logout", { json: {} }),
};

// --- Files --------------------------------------------------------------------

/** `owner` (a student's uid) gives teachers read-only access to that student. */
function ownerQuery(owner?: string | null): Record<string, string> {
  return owner ? { owner } : {};
}

export function downloadUrl(path: string, owner?: string | null) {
  return `${API_ROOT}/files.php?${new URLSearchParams({ action: "download", path, ...ownerQuery(owner) })}`;
}

export const files = {
  list: (path = "", owner?: string | null) =>
    request<FileList>("files", "list", { query: { path, ...ownerQuery(owner) } }),

  students: () => request<{ students: Student[] }>("files", "students"),

  async fetch(path: string, owner?: string | null): Promise<File> {
    const res = await fetch(downloadUrl(path, owner), { credentials: "same-origin" });
    if (!res.ok) {
      if (res.status === 401) {
        window.dispatchEvent(new Event("office:unauthorized"));
      }
      throw new ApiError("http_" + res.status, `Could not open file (${res.status})`, res.status);
    }
    const blob = await res.blob();
    return new File([blob], path.split("/").pop() || "document");
  },

  upload: (dir: string, list: File[]) => {
    const form = new FormData();
    for (const file of list) {
      form.append("file[]", file, file.name);
    }
    return request<{ items: FileItem[] }>("files", "upload", {
      query: { path: dir },
      body: form,
    });
  },

  /** Overwrite an existing file. */
  save: (path: string, data: Blob | Uint8Array) =>
    request<{ item: FileItem }>("files", "save", {
      query: { path },
      body: data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>]),
    }),

  /** Create a new file in `dir`; the server picks a unique name. */
  create: (dir: string, name: string, data: Blob | Uint8Array) =>
    request<{ item: FileItem }>("files", "save", {
      query: { dir, name },
      body: data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>]),
    }),

  mkdir: (path: string, name: string) =>
    request<{ item: FileItem }>("files", "mkdir", { json: { path, name } }),
  rename: (path: string, name: string) =>
    request<{ item: FileItem }>("files", "rename", { json: { path, name } }),
  move: (path: string, to: string) =>
    request<{ item: FileItem }>("files", "move", { json: { path, to } }),
  remove: (path: string) => request("files", "delete", { json: { path } }),
};

// --- Helpers ------------------------------------------------------------------

export function parentPath(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return value.toFixed(value < 10 ? 1 : 0) + " " + units[unit];
}

/** URL of the file manager showing folder `path` (of student `owner`). */
export function filesUrl(path: string, owner?: string | null) {
  const params = new URLSearchParams({ ...ownerQuery(owner), ...(path ? { path } : {}) });
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/** URL of the editor for a file stored on the server. */
export function editorUrl(path: string, owner?: string | null) {
  return `/editor/?${new URLSearchParams({ file: path, ...ownerQuery(owner) })}`;
}

/** URL of the editor for a new document that will be saved into `dir`. */
export function newDocumentUrl(type: string, dir = "") {
  const params = new URLSearchParams({ new: type });
  if (dir) params.set("dir", dir);
  return `/editor/?${params}`;
}
