#!/usr/bin/env bash
# build-shared-hosting.sh — Build a package that runs on ordinary PHP shared
# hosting (Apache/LiteSpeed + PHP 7.4+). The zip is extracted in the hosting
# account's home folder and contains:
#   public_html/   the site (web root)
#   office-data/   .env.example, tools; user files are stored here (outside the web root)
#
# Usage:
#   ./scripts/build-shared-hosting.sh [DS_ASSETS_DIR]
#
# DS_ASSETS_DIR must contain the ONLYOFFICE DocumentServer folders
# fonts/, sdkjs/, sdkjs-plugins/ and web-apps/ (as found in
# /var/www/onlyoffice/documentserver inside the official Docker image).
# When omitted, they are extracted from the Docker image automatically.
#
# Environment:
#   DS_VERSION   DocumentServer version (default 9.3.1)
#   DS_IMAGE     Docker image (default onlyoffice/documentserver:$DS_VERSION;
#                use mirror.gcr.io/onlyoffice/documentserver:$DS_VERSION if
#                Docker Hub rate-limits you)
#   HASH         asset cache-busting revision (default 1)
#   HELP_LANGS   editor help languages to keep (default "en tr")

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

DS_VERSION="${DS_VERSION:-9.3.1}"
DS_IMAGE="${DS_IMAGE:-onlyoffice/documentserver:${DS_VERSION}}"
HASH="${HASH:-1}"
HELP_LANGS="${HELP_LANGS:-en tr}"
APP_ROOT="/v${DS_VERSION}-${HASH}"
OUT="$ROOT/out"
DIST="$ROOT/dist"
DS_ASSETS="${1:-}"

echo "→ DocumentServer ${DS_VERSION}, assets at ${APP_ROOT}"

# --- 1. ONLYOFFICE assets ----------------------------------------------------
if [ -z "$DS_ASSETS" ]; then
  DS_ASSETS="$ROOT/.ds-assets/${DS_VERSION}"
  if [ ! -d "$DS_ASSETS/web-apps" ]; then
    echo "→ Extracting ONLYOFFICE assets from ${DS_IMAGE}"
    mkdir -p "$DS_ASSETS"
    container="office-ds-extract-$$"
    # AllFonts.js and the presentation themes are generated on first start.
    docker run --name "$container" --entrypoint /bin/bash "$DS_IMAGE" \
      -c "documentserver-generate-allfonts.sh false" >/dev/null
    for d in fonts sdkjs sdkjs-plugins web-apps; do
      docker cp "$container:/var/www/onlyoffice/documentserver/$d" "$DS_ASSETS/$d"
    done
    docker rm "$container" >/dev/null
  fi
fi
for d in fonts sdkjs web-apps; do
  [ -d "$DS_ASSETS/$d" ] || { echo "✗ $DS_ASSETS/$d not found"; exit 1; }
done

# --- 2. Static site ------------------------------------------------------------
echo "→ Building the web app"
NEXT_PUBLIC_APP_ROOT="$APP_ROOT" NEXT_PUBLIC_BACKEND=php pnpm build

# Assets bundled in public/ for other deployments are not used here.
rm -rf "$OUT"/v*-*/ "$OUT/x2t" "$OUT/_headers"

# --- 3. Editor assets ----------------------------------------------------------
echo "→ Copying ONLYOFFICE assets"
mkdir -p "$OUT$APP_ROOT"
for d in fonts sdkjs sdkjs-plugins web-apps; do
  [ -d "$DS_ASSETS/$d" ] && cp -r "$DS_ASSETS/$d" "$OUT$APP_ROOT/$d"
done
# api.js is a template rendered by DocumentServer at runtime; served as-is
# (the unrendered placeholder disables its version-path rewriting).
cp "$OUT$APP_ROOT/web-apps/apps/api/documents/api.js.tpl" \
   "$OUT$APP_ROOT/web-apps/apps/api/documents/api.js"

# The editor registers this service worker (asset cache) at the asset root.
cp "$OUT$APP_ROOT/sdkjs/common/serviceworker/document_editor_service_worker.js" "$OUT$APP_ROOT/"

# Help pages are large (~500 MB for all languages); keep only HELP_LANGS.
for help in "$OUT$APP_ROOT"/web-apps/apps/*/main/resources/help; do
  for lang_dir in "$help"/*/; do
    lang="$(basename "$lang_dir")"
    case " $HELP_LANGS images " in
      *" $lang "*) ;;
      *) rm -rf "$lang_dir" ;;
    esac
  done
done

# --- 4. x2t converter: plain files + brotli copies -----------------------------
# The repository stores x2t brotli-compressed. Ship plain files so any host
# can serve them, plus .br copies that .htaccess serves when possible.
echo "→ Preparing the x2t converter"
for x2t_dir in "$OUT"/x2t-*/; do
  for f in "$x2t_dir"*; do
    case "$f" in *.br) continue ;; esac
    mv "$f" "$f.br"
    node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync(process.argv[2],z.brotliDecompressSync(fs.readFileSync(process.argv[1])))" "$f.br" "$f"
  done
done

# --- 5. PHP backend and server configuration ----------------------------------
echo "→ Adding the PHP backend"
cp -r "$ROOT/php/." "$OUT/"

# --- 6. Package ------------------------------------------------------------------
STAGE="$DIST/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -r "$OUT" "$STAGE/public_html"
cp -r "$ROOT/deploy/office-data" "$STAGE/office-data"
cp "$ROOT/deploy/KURULUM.md" "$STAGE/KURULUM.md"
ZIP="$DIST/office-shared-hosting.zip"
rm -f "$ZIP"
(cd "$STAGE" && zip -qr -9 "$ZIP" .)
rm -rf "$STAGE"

# Update package for an existing installation: only the web app. Leaves out
# the large editor assets, the server settings (api/config.php, .htaccess)
# and hakkinda.html, which the site admin edits on the server.
UPDATE="$DIST/office-guncelleme.zip"
rm -f "$UPDATE"
mkdir -p "$STAGE/public_html"
(cd "$OUT" && tar cf - --exclude="./v${DS_VERSION}-*" --exclude='./x2t-*' --exclude=./files \
  --exclude=./api --exclude=./giris.php --exclude=./.htaccess --exclude=./hakkinda.html .) \
  | tar xf - -C "$STAGE/public_html"
(cd "$STAGE" && zip -qr -9 "$UPDATE" .)
rm -rf "$STAGE"
echo ""
echo "✓ Update package: $UPDATE ($(du -h "$UPDATE" | cut -f1))"
echo "✓ Package ready: $ZIP ($(du -h "$ZIP" | cut -f1))"
