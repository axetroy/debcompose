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
 * Sub-package dpkg -i commands are generated at build time from the manifest,
 * eliminating the need for runtime manifest parsing (awk), retry loops, or
 * lock-contention detection.
 *
 * Runs the install operations in a background process to avoid dpkg lock
 * contention with the parent dpkg invocation.
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @param {{ onInstallError?: OnInstallErrorStrategy, bundleName?: string }} [options]
 * @returns {string} Bash script content
 */
export function generatePostinst(manifest, options = {}) {
  const { onInstallError = 'stop', bundleName = 'product-installer' } = options;
  const version = escapeShellString(manifest.version);
  const hasRollback = onInstallError === 'rollback';
  const DEB_DIR = debDirPath(bundleName);
  const LOG_FILE = logFilePath(bundleName);

  const installBody = manifest.packages.map(pkg => {
    const file = escapeShellString(pkg.file);
    const name = escapeShellString(pkg.name);
    const pkgPath = `${DEB_DIR}/${file}`;

    if (hasRollback) {
      return `    if dpkg -i "${pkgPath}" >> "$LOG_FILE" 2>&1; then
        log "ExitCode=0 Installed: ${file}"
        INSTALLED="$INSTALLED ${name}"
    else
        exit_code=$?
        log "ExitCode=$exit_code ERROR: Failed to install: ${file}"
        rollback
        exit 1
    fi`;
    }

    return `    if dpkg -i "${pkgPath}" >> "$LOG_FILE" 2>&1; then
        log "ExitCode=0 Installed: ${file}"
    else
        exit_code=$?
        log "ExitCode=$exit_code ERROR: Failed to install: ${file}"
        exit 1
    fi`;
  }).join('\n\n');

  return `#!/bin/bash
set -e

DEB_DIR="${DEB_DIR}"
LOG_FILE="${LOG_FILE}"${hasRollback ? `
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

# Ignore SIGHUP before launching background process so the ignored
# disposition is inherited by the child (survives main shell exit).
trap '' HUP

# Launches sub-package installation in a background process to avoid dpkg
# lock contention with the parent dpkg invocation.
{
${installBody}

    log "Bundle v${version} installation completed"
} < /dev/null &

exit 0
`;
}

/**
 * Generate a postrm (post-removal) bash script.
 *
 * Sub-package dpkg -r commands are generated at build time from the manifest
 * (in reverse order), eliminating the need for runtime file-reading, retry
 * loops, or crash-recovery file mechanics.
 *
 * Only runs on "remove" or "purge".
 *
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @param {{ bundleName?: string }} [options]
 * @returns {string} Bash script content
 */
export function generatePostrm(manifest, options = {}) {
  const { bundleName = 'product-installer' } = options;
  const version = escapeShellString(manifest.version);
  const LOG_FILE = logFilePath(bundleName);

  const removeBody = [...manifest.packages].reverse().map(pkg => {
    const name = escapeShellString(pkg.name);

    return `    if dpkg -r "${name}" >> "$LOG_FILE" 2>&1; then
        log "ExitCode=0 Removed: ${name}"
    else
        exit_code=$?
        log "ExitCode=$exit_code WARN: Failed to remove: ${name} (may not be installed)"
    fi`;
  }).join('\n\n');

  return `#!/bin/bash
set -e

if [ "$1" != "remove" ] && [ "$1" != "purge" ]; then
    exit 0
fi

LOG_FILE="${LOG_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "Bundle v${version} removal started"

# Ignore SIGHUP before launching background process so the ignored
# disposition is inherited by the child (survives main shell exit).
trap '' HUP

# Launches sub-package removal in a background process to avoid dpkg lock
# contention with the parent dpkg invocation.
{
${removeBody}

    log "Bundle v${version} removal completed"
} < /dev/null &

exit 0
`;
}
