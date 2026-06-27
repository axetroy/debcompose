/**
 * Build the manifest path from the bundle package name.
 * @param {string} bundleName
 * @returns {string}
 */
function manifestPath(bundleName) {
  return `/opt/${escapeShellString(bundleName)}/manifest.json`;
}

/**
 * Build the deb directory path from the bundle package name.
 * @param {string} bundleName
 * @returns {string}
 */
function debDirPath(bundleName) {
  return `/opt/${escapeShellString(bundleName)}`;
}

/**
 * Build the log file path from the bundle package name.
 * @param {string} bundleName
 * @returns {string}
 */
function logFilePath(bundleName) {
  return `/var/log/${escapeShellString(bundleName)}.log`;
}

/**
 * Build the persistent package list path from the bundle package name.
 * @param {string} bundleName
 * @returns {string}
 */
function packageListPath(bundleName) {
  return `/var/lib/${escapeShellString(bundleName)}/packages`;
}

/**
 * Escape a string for safe interpolation in single-quoted shell contexts.
 * @param {string} str
 * @returns {string}
 */
function escapeShellString(str) {
  return str.replace(/'/g, "'\\''");
}

/**
 * @typedef {'stop' | 'rollback'} OnInstallErrorStrategy
 */

/**
 * Generate a postinst (post-installation) bash script.
 *
 * The script reads the manifest from /opt/<bundleName>/manifest.json and
 * installs each sub-package in order using dpkg -i.
 * Package names are saved to a persistent file for postrm.
 *
 * When onInstallError is "rollback", the script uninstalls all
 * successfully installed packages in reverse order if any
 * single package fails, then exits with error.
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @param {{ onInstallError?: OnInstallErrorStrategy }} [options]
 * @returns {string} Bash script content
 */
export function generatePostinst(manifest, options = {}) {
  const { onInstallError = 'stop', bundleName = 'product-installer' } = options;
  const version = escapeShellString(manifest.version);
  const hasRollback = onInstallError === 'rollback';
  const MANIFEST_PATH = manifestPath(bundleName);
  const DEB_DIR = debDirPath(bundleName);
  const LOG_FILE = logFilePath(bundleName);
  const PACKAGE_LIST_FILE = packageListPath(bundleName);

  return `#!/bin/bash
set -e

MANIFEST_PATH="${MANIFEST_PATH}"
DEB_DIR="${DEB_DIR}"
LOG_FILE="${LOG_FILE}"
PACKAGE_LIST_FILE="${PACKAGE_LIST_FILE}"${hasRollback ? `
INSTALLED=""` : ''}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}${hasRollback ? `

rollback() {
    log "ROLLBACK: Installation failed, reverting installed packages"
    for rb_pkg in $INSTALLED; do
        log "ROLLBACK: Removing $rb_pkg"
        dpkg -r "$rb_pkg" >> "$LOG_FILE" 2>&1 || true
    done
    log "ROLLBACK: Reverted all installed packages"
}` : ''}

# Detect upgrade vs fresh install ($2 is old version during upgrade)
if [ -n "$2" ]; then
    log "Bundle v${version} upgrade from v$2 started"
else
    log "Bundle v${version} fresh installation started"
fi

if [ ! -f "$MANIFEST_PATH" ]; then
    log "ERROR: Manifest not found at $MANIFEST_PATH"
    exit 1
fi

# Save reverse-ordered package names for postrm (survives dpkg -r file removal)
mkdir -p "$(dirname "$PACKAGE_LIST_FILE")"
awk -F'"' '/"name": "/ {a[++c]=$4} END{for(i=c;i>0;i--) print a[i]}' "$MANIFEST_PATH" > "$PACKAGE_LIST_FILE"

# Launch sub-package installation in background to avoid dpkg lock contention
{
    while IFS='|' read -r pkg_name pkg_file; do
        pkg_path="$DEB_DIR/$pkg_file"
        if [ ! -f "$pkg_path" ]; then
            log "ERROR: Package file not found: $pkg_path"${hasRollback ? `
            rollback` : ''}
            exit 1
        fi
        log "Installing: $pkg_file"
        RETRY=0 MAX_RETRY=15
        while [ $RETRY -lt $MAX_RETRY ]; do
            if dpkg -i "$pkg_path" >> "$LOG_FILE" 2>&1; then
                log "ExitCode=0 Installed: $pkg_file"${hasRollback ? `
                INSTALLED="$INSTALLED $pkg_name"` : ''}
                break
            fi
            exit_code=$?; RETRY=$((RETRY + 1))
            [ $RETRY -lt $MAX_RETRY ] && sleep 2
        done
        if [ $RETRY -ge $MAX_RETRY ]; then
            log "ExitCode=$exit_code ERROR: Failed to install after $MAX_RETRY retries: $pkg_file"${hasRollback ? `
            rollback` : ''}
            exit 1
        fi
    done < <(awk -F'"' 'BEGIN{ORS=""} /"name": "/{n=$4} /"file": "/{print n "|" $4 "\n"}' "$MANIFEST_PATH")

    log "Bundle v${version} installation completed"
} & disown

exit 0
`;
}

/**
 * Generate a postrm (post-removal) bash script.
 *
 * The script reads the persistent package list (saved by postinst) and
 * removes each sub-package in reverse order using dpkg -r.
 * Only runs on "remove" or "purge".
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @returns {string} Bash script content
 */
export function generatePostrm(manifest, options = {}) {
  const { bundleName = 'product-installer' } = options;
  const version = escapeShellString(manifest.version);
  const LOG_FILE = logFilePath(bundleName);
  const PACKAGE_LIST_FILE = packageListPath(bundleName);

  return `#!/bin/bash
set -e

if [ "$1" != "remove" ] && [ "$1" != "purge" ]; then
    exit 0
fi

LOG_FILE="${LOG_FILE}"
PACKAGE_LIST_FILE="${PACKAGE_LIST_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Bundle v${version} removal started"

if [ ! -f "$PACKAGE_LIST_FILE" ]; then
    # Fallback: if uninstall previously crashed after renaming to .bak, use the .bak file directly
    if [ ! -f "\${PACKAGE_LIST_FILE}.bak" ]; then
        log "WARN: Package list not found at $PACKAGE_LIST_FILE, skipping sub-package removal"
        exit 0
    fi
    log "WARN: Using recovery file \${PACKAGE_LIST_FILE}.bak (previous uninstall may have crashed)"
else
    # Normal case: rename to .bak to survive mid-uninstall crash
    mv "$PACKAGE_LIST_FILE" "\${PACKAGE_LIST_FILE}.bak"
fi

PACKAGE_NAMES=$(cat "\${PACKAGE_LIST_FILE}.bak")
rm -f "$PACKAGE_LIST_FILE"

# Launch sub-package removal in background to avoid dpkg lock contention
{
    for name in $PACKAGE_NAMES; do
        log "Removing: $name"
        RETRY=0 MAX_RETRY=10
        while [ $RETRY -lt $MAX_RETRY ]; do
            if dpkg -r "$name" >> "$LOG_FILE" 2>&1; then
                log "ExitCode=0 Removed: $name"
                break
            fi
            exit_code=$?; RETRY=$((RETRY + 1))
            [ $RETRY -lt $MAX_RETRY ] && sleep 2
        done
        if [ $RETRY -ge $MAX_RETRY ]; then
            log "ExitCode=$exit_code WARN: Failed to remove after $MAX_RETRY retries: $name (may not be installed)"
        fi
    done

    # Clean up .bak file after successful uninstall
    rm -f "\${PACKAGE_LIST_FILE}.bak"

    log "Bundle v${version} removal completed"
} & disown

exit 0
`;
}
