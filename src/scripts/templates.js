const MANIFEST_PATH = '/opt/bundle/manifest.json';
const DEB_DIR = '/opt/bundle';
const LOG_FILE = '/var/log/product-installer.log';

/**
 * Escape a string for safe interpolation in single-quoted shell contexts.
 * @param {string} str
 * @returns {string}
 */
function escapeShellString(str) {
  return str.replace(/'/g, "'\\''");
}

/**
 * Generate a postinst (post-installation) bash script.
 *
 * The script reads the manifest from /opt/bundle/manifest.json and
 * installs each sub-package in order using dpkg -i.
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @returns {string} Bash script content
 */
export function generatePostinst(manifest) {
  const version = escapeShellString(manifest.version);

  return `#!/bin/bash
set -e

MANIFEST_PATH="${MANIFEST_PATH}"
DEB_DIR="${DEB_DIR}"
LOG_FILE="${LOG_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Bundle v${version} installation started"

if [ ! -f "$MANIFEST_PATH" ]; then
    log "ERROR: Manifest not found at $MANIFEST_PATH"
    exit 1
fi

# Launch sub-package installation in background to avoid dpkg lock contention
{
    if command -v fuser >/dev/null 2>&1; then
        while fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock >/dev/null 2>&1; do
            sleep 1
        done
    fi

    while IFS= read -r file; do
        pkg_path="$DEB_DIR/$file"
        if [ ! -f "$pkg_path" ]; then
            log "ERROR: Package file not found: $pkg_path"
            exit 1
        fi
        log "Installing: $file"
        if dpkg -i "$pkg_path" >> "$LOG_FILE" 2>&1; then
            log "Installed: $file"
        else
            log "ERROR: Failed to install: $file"
            exit 1
        fi
    done < <(awk -F'"' '/"file": "/ {print $4}' "$MANIFEST_PATH")

    log "Bundle v${version} installation completed"
} &

exit 0
`;
}

/**
 * Generate a postrm (post-removal) bash script.
 *
 * The script reads the manifest and removes each sub-package in
 * reverse order using dpkg -r. Only runs on "remove" or "purge".
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @returns {string} Bash script content
 */
export function generatePostrm(manifest) {
  const version = escapeShellString(manifest.version);

  return `#!/bin/bash
set -e

if [ "$1" != "remove" ] && [ "$1" != "purge" ]; then
    exit 0
fi

MANIFEST_PATH="${MANIFEST_PATH}"
LOG_FILE="${LOG_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Bundle v${version} removal started"

if [ ! -f "$MANIFEST_PATH" ]; then
    log "WARN: Manifest not found at $MANIFEST_PATH, skipping sub-package removal"
    exit 0
fi

# Read package names now; manifest will be removed before the background process runs
PACKAGE_NAMES=$(awk -F'"' '/"name": "/ {a[++c]=$4} END{for(i=c;i>0;i--) print a[i]}' "$MANIFEST_PATH")

# Launch sub-package removal in background to avoid dpkg lock contention
{
    if command -v fuser >/dev/null 2>&1; then
        while fuser /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock >/dev/null 2>&1; do
            sleep 1
        done
    fi

    for name in $PACKAGE_NAMES; do
        log "Removing: $name"
        if dpkg -r "$name" >> "$LOG_FILE" 2>&1; then
            log "Removed: $name"
        else
            log "WARN: Failed to remove: $name (may not be installed)"
        fi
    done

    log "Bundle v${version} removal completed"
} &

exit 0
`;
}
