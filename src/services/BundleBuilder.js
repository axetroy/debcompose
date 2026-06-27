import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class BundleBuilder {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Generates a Debian bundle package.
   * @param {Object} options
   * @param {Array} options.packages - List of deb files to include with name and path.
   * @param {string[]} options.order - The installation order of packages.
   * @param {string} options.outputDir - Where to save the generated bundle.
   * @param {Object} options.config - Runtime configuration overriding constructor config.
   */
  async build({ packages, order, outputDir = "dist", config = {} }) {
    const cfg = { ...this.config, ...config };
    const bundleRoot = path.join(outputDir, `bundle_${Date.now()}`);
    const debDir = path.join(bundleRoot, "opt", "bundle");
    const debianDir = path.join(bundleRoot, "DEBIAN");

    await fs.mkdir(debDir, { recursive: true });
    await fs.mkdir(debianDir, { recursive: true });

    // Copy deb files in specified order
    for (const pkg of order) {
      const pkgInfo = packages.find((p) => p.name === pkg);
      if (pkgInfo?.path && (await this._exists(pkgInfo.path))) {
        await fs.copyFile(
          pkgInfo.path,
          path.join(debDir, path.basename(pkgInfo.path)),
        );
      }
    }

    // Generate manifest.json
    const manifest = {
      version: cfg.version || "1.0.0",
      packages: order.map((name) => {
        const pkgInfo = packages.find((p) => p.name === name);
        return {
          name,
          file: pkgInfo ? path.basename(pkgInfo.path) : `${name}.deb`,
        };
      }),
    };
    await fs.writeFile(
      path.join(debianDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    // Generate control file
    const control = this._generateControl(cfg);
    await fs.writeFile(path.join(debianDir, "control"), control);

    // Generate postinst/postrm scripts
    await this._generatePostinst(debianDir, debDir, cfg);
    await this._generatePostrm(debianDir, cfg);

    // Build the package
    try {
      await execAsync(`dpkg-deb --build ${bundleRoot}`);
      return {
        success: true,
        bundlePath: `${bundleRoot}.deb`,
        bundleId: path.basename(`${bundleRoot}.deb`),
      };
    } catch (e) {
      return { success: false, error: "dpkg-deb not found or build failed" };
    }
  }

  _generateControl(cfg) {
    const fields = [
      `Package: ${cfg.name || "debcompose-bundle"}`,
      `Version: ${cfg.version || "1.0.0"}`,
      `Section: ${cfg.section || "misc"}`,
      `Priority: ${cfg.priority || "optional"}`,
      `Architecture: ${cfg.arch || "amd64"}`,
      `Maintainer: ${cfg.maintainer || "Unknown <unknown>"}`,
      `Description: ${cfg.description || "Aggregated deb bundle"}`,
    ];
    if (cfg.license) {
      fields.push(`License: ${cfg.license}`);
    }
    return fields.join("\n") + "\n";
  }

  async _generatePostinst(debianDir, debDir, cfg) {
    const script = `#!/bin/bash
set -e

LOG_FILE="/var/log/${cfg.name || "debcompose-bundle"}.log"
BUNDLE_DIR="${debDir}"
MANIFEST_FILE="${debianDir}/manifest.json"
INSTALLED_LIST=""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

rollback() {
    log "ERROR: Installation failed. Rolling back installed packages..."
    for pkg in $(echo "$INSTALLED_LIST" | tac); do
        log "Rolling back: $pkg"
        dpkg -r "$pkg" >> "$LOG_FILE" 2>&1 || true
    done
    log "Rollback completed"
    exit 1
}

log "Starting bundle installation: ${cfg.name || "debcompose-bundle"} version ${cfg.version || "1.0.0"}"

if [ ! -f "$MANIFEST_FILE" ]; then
    log "ERROR: Manifest file not found at $MANIFEST_FILE"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log "ERROR: jq is required but not installed"
    exit 1
fi

PACKAGES=$(jq -r '.packages[].name' "$MANIFEST_FILE" 2>/dev/null)
if [ -z "$PACKAGES" ]; then
    log "ERROR: No packages found in manifest"
    exit 1
fi

INSTALLED=""
for pkg in $PACKAGES; do
    DEB_FILE=$(jq -r --arg name "$pkg" '.packages[] | select(.name == $name) | .file' "$MANIFEST_FILE")
    if [ -z "$DEB_FILE" ] || [ "$DEB_FILE" = "null" ]; then
        log "WARNING: No deb file found for package $pkg, skipping"
        continue
    fi
    
    DEB_PATH="$BUNDLE_DIR/$DEB_FILE"
    if [ ! -f "$DEB_PATH" ]; then
        log "ERROR: Deb file not found: $DEB_PATH"
        rollback
    fi
    
    log "Installing package: $pkg ($DEB_FILE)"
    if dpkg -i "$DEB_PATH" >> "$LOG_FILE" 2>&1; then
        log "Successfully installed: $pkg"
        INSTALLED="$INSTALLED $pkg"
        INSTALLED_LIST="$INSTALLED"
    else
        log "ERROR: Failed to install $pkg"
        rollback
    fi
done

log "Bundle installation completed successfully"
exit 0
`;

    await fs.writeFile(path.join(debianDir, "postinst"), script);
    await fs.chmod(path.join(debianDir, "postinst"), "755");
  }

  async _generatePostrm(debianDir, cfg) {
    const script = `#!/bin/bash
set -e

LOG_FILE="/var/log/${cfg.name || "debcompose-bundle"}.log"
MANIFEST_FILE="${debianDir}/manifest.json"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting bundle removal: ${cfg.name || "debcompose-bundle"}"

if [ ! -f "$MANIFEST_FILE" ]; then
    log "WARNING: Manifest file not found at $MANIFEST_FILE, cannot determine packages to remove"
    exit 0
fi

PACKAGES=$(jq -r '.packages[].name' "$MANIFEST_FILE" 2>/dev/null | tac)
if [ -z "$PACKAGES" ]; then
    log "WARNING: No packages found in manifest"
    exit 0
fi

for pkg in $PACKAGES; do
    log "Removing package: $pkg"
    if dpkg -r "$pkg" >> "$LOG_FILE" 2>&1; then
        log "Successfully removed: $pkg"
    else
        log "WARNING: Failed to remove $pkg (may already be removed)"
    fi
done

log "Bundle removal completed"
exit 0
`;

    await fs.writeFile(path.join(debianDir, "postrm"), script);
    await fs.chmod(path.join(debianDir, "postrm"), "755");
  }

  async _exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
