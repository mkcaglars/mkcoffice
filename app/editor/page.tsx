"use client";

import { useLayoutEffect, useRef, useEffect, useState } from "react";
import { useAppStore, useResolvedLanguage, useHasHydrated } from "@/store";
import {
  API_JS,
  APP_ROOT,
  getDocumentType,
  PRELOAD_HTML,
} from "@/utils/editor/utils";
import io, { MockSocket } from "@/utils/editor/socket";
import { createFetchProxy } from "@/utils/editor/fetch";
import { createXHRProxy } from "@/utils/editor/xhr";
import { DocEditor } from "@/utils/editor/types";
import { createExtensionLoader } from "@/utils/extension";
import InstallExtensionDialog from "@/components/install-extension-dialog";
import { toast } from "sonner";
import { useExtracted } from "next-intl";
import {
  BACKEND_ENABLED,
  editorUrl,
  files as filesApi,
  filesUrl,
  parentPath,
} from "@/utils/backend";
import { getFileExt } from "@/utils/editor/utils";

export default function Page() {
  const server = useAppStore((state) => state.server);
  const language = useResolvedLanguage();
  const theme = useAppStore((state) => state.theme);
  const hasHydrated = useHasHydrated();
  const isDirty = useRef(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const tryDirectRef = useRef<(() => Promise<void>) | null>(null);
  const t = useExtracted();
  // Translated strings for the editor callbacks, which outlive renders.
  const labels = {
    myFiles: t("My Files"),
    newDocument: t("New Document"),
    saved: (name: string) => t("Saved to {name}", { name }),
    saveFailed: (error: string) => t("Could not save: {error}", { error }),
  };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useLayoutEffect(() => {
    if (!hasHydrated) return;

    const apiUrl = APP_ROOT + API_JS;
    const searchParams = new URLSearchParams(window.location.search);

    const fileId = searchParams.get("fileId");
    const newDoc = searchParams.get("new");
    const fileUrl = searchParams.get("url");
    const paramEditing = searchParams.get("editing");
    const paramLang = searchParams.get("lang");
    const paramTheme = searchParams.get("theme");
    // Server storage (PHP backend): file being edited, or folder for a new one.
    const serverFile = BACKEND_ENABLED ? searchParams.get("file") : null;
    // Teacher viewing a student's file: read-only, never saved.
    const owner = serverFile ? searchParams.get("owner") : null;
    const target = {
      path: serverFile,
      dir: serverFile ? parentPath(serverFile) : searchParams.get("dir") || "",
    };

    const editing = !owner && (paramEditing === null ? true : paramEditing !== "0");
    const lang = paramLang || language;
    const uiTheme = paramTheme || theme;

    let editor: DocEditor | null = null;

    MockSocket.on("connect", server.handleConnect);
    MockSocket.on("disconnect", server.handleDisconnect);

    const onAppReady = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[name="frameEditor"]',
      );
      const win = iframe?.contentWindow as typeof window;
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc || !win) {
        throw new Error("Iframe not loaded");
      }

      const xhr = createXHRProxy(win.XMLHttpRequest);
      const fetchProxy = createFetchProxy(win);
      const _Worker = win.Worker;

      xhr.use((request: Request) => {
        return server.handleRequest(request);
      });
      fetchProxy.use((request: Request) => {
        return server.handleRequest(request);
      });
      Object.assign(win, {
        io: io,
        XMLHttpRequest: xhr,
        fetch: fetchProxy,
        Worker: function (url: string, options?: WorkerOptions) {
          const u = new URL(url, location.origin);
          return new _Worker(
            u.href.replace(u.origin, location.origin),
            options,
          );
        },
      });

      // const script = iframeDoc.createElement("script");
      // script.src = apiUrl;
      // iframeDoc.body.appendChild(script);
    };

    const createEditor = () => {
      const doc = server.getDocument();
      const user = server.getUser();
      const documentType = getDocumentType(doc.fileType);

      server.setClient({
        buildVersion: window.DocsAPI!.DocEditor.version(),
      });
      editor = new window.DocsAPI!.DocEditor("placeholder", {
        document: {
          fileType: doc.fileType,
          key: doc.key,
          title: doc.title,
          url: doc.url,

          permissions: {
            edit: editing && doc.fileType !== "pdf",
            chat: false,
            rename: editing,
            protect: editing,
            review: false,
            print: false,
          },
        },
        documentType: documentType,
        editorConfig: {
          lang: lang,
          coEditing: {
            mode: "fast",
            change: false,
          },
          user: {
            ...user,
          },
          customization: {
            uiTheme: uiTheme,
            // Save button / Ctrl+S trigger a save to server storage.
            forcesave: BACKEND_ENABLED && !owner,
            ...(BACKEND_ENABLED
              ? {
                  goback: {
                    url: location.origin + filesUrl(target.dir, owner),
                    text: labelsRef.current.myFiles,
                    blank: false,
                  },
                }
              : {}),
            features: {
              spellcheck: {
                change: false,
              },
            },
            logo: {
              image: location.origin + "/logo-name_black.svg",
              imageDark: location.origin + "/logo-name_white.svg",
              url: location.origin,
            },
          },
        },
        events: {
          onAppReady: async (e: unknown) => {
            console.log("App ready", e, editor);
            onAppReady();
          },
          onDocumentReady: (e: unknown) => {
            console.log("Document ready", e);
          },
          onDocumentStateChange: (e: { data: boolean; target: unknown }) => {
            console.log("Document state change", e);
            if (e.data) {
              isDirty.current = true;
            }
          },
          onRequestOpen: (e: unknown) => {
            console.log("onRequestOpen", e);
          },
          onError: (e: unknown) => {
            console.log("Error", e);
          },
          onInfo: (e: unknown) => {
            console.log("Info", e);
          },
          onWarning: (e: unknown) => {
            console.log("onWarning", e);
          },
          onRequestSaveAs: (e: unknown) => {
            console.log("onRequestSaveAs", e);
          },
          onSaveDocument: (e: unknown) => {
            console.log("onSaveDocument", e);
            isDirty.current = false;
          },
          onDownloadAs: (e: unknown) => {
            console.log("onDownloadAs", e);
          },
          onSave: (e: unknown) => {
            console.log("onSave", e);
            isDirty.current = false;
          },
          writeFile: async (e: unknown) => {
            console.log("writeFile", e);
            isDirty.current = false;
          },
        },
        type: "desktop",
        width: "100%",
        height: "100%",
      });
      Object.assign(window, {
        editor,
      });
      if (BACKEND_ENABLED && !owner) {
        server.setSaveHandler(saveToServer, (format) =>
          editor?.downloadAs?.(format),
        );
      }
      return editor;
    };

    const loadEditor = () => {
      if (window.DocsAPI && window.DocsAPI.DocEditor) {
        createEditor();
        return;
      }
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${apiUrl}"]`,
      );
      if (!script) {
        script = document.createElement("script");
        script.src = apiUrl;
        document.head.appendChild(script);
      }
      script.onload = () => {
        createEditor();
      };
      script.onerror = (e) => {
        console.error("Failed to load DocsAPI script", e);
      };
    };

    const saveToServer = async (data: Uint8Array, format: string) => {
      const labels = labelsRef.current;
      try {
        let item;
        if (target.path && getFileExt(target.path) === format) {
          ({ item } = await filesApi.save(target.path, data));
        } else {
          // New document, or an old format (e.g. .doc) saved as a new file.
          const title = server.getDocument().title || "Document";
          const base = title.replace(/\.[^.]+$/, "") || "Document";
          ({ item } = await filesApi.create(target.dir, `${base}.${format}`, data));
          target.path = item.path;
          window.history.replaceState(null, "", editorUrl(item.path));
          document.title = item.name;
        }
        isDirty.current = false;
        toast.success(labels.saved(item.name));
      } catch (err) {
        toast.error(labels.saveFailed((err as Error).message));
        throw err;
      }
    };

    const init = async () => {
      if (serverFile) {
        try {
          const file = await filesApi.fetch(serverFile, owner);
          await server.open(file);
          document.title = file.name;
        } catch (err) {
          toast.error((err as Error).message);
          return;
        }
      }
      if (newDoc) {
        server.openNew(newDoc, labelsRef.current.newDocument)
      }
      if (fileUrl && !fileId) {
        const { loader, tryDirect } = createExtensionLoader({
          onWaiting: () => setShowInstallHint(true),
          onReady: () => setShowInstallHint(false),
        });
        tryDirectRef.current = tryDirect;
        server.openUrl(fileUrl, {
          fileType: searchParams.get("fileType") || '',
          fileName: searchParams.get("fileName") || '',
          loader,
        })
      }
      loadEditor()
    }

    init()

    return () => {
      MockSocket.off("connect", server.handleConnect);
      MockSocket.off("disconnect", server.handleDisconnect);
      server.setSaveHandler(null, null);
      editor?.destroyEditor?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  return (
    <>
    <InstallExtensionDialog
      open={showInstallHint}
      onClose={() => setShowInstallHint(false)}
      onTryDirect={tryDirectRef.current || undefined}
    />
    <div>
      <div className="w-screen h-screen">
        <div id="placeholder">
          <iframe
            className="w-0 h-0 hidden"
            src={APP_ROOT + PRELOAD_HTML}
          ></iframe>
        </div>
      </div>
    </div>
    </>
  );
}
