# debcompose

**Deb Package Bundle Builder** — Aggregate multiple `.deb` packages into a single installable bundle.

In enterprise software, a product often consists of multiple Debian packages (runtime, driver, server, client, plugins). Distributing them as separate `.deb` files requires users to install each one manually:

```bash
dpkg -i runtime.deb
dpkg -i server.deb
dpkg -i client.deb
```

**debcompose** creates a bundle (wrapper `.deb`) that aggregates all sub-packages. Users install everything with a single command:

```bash
dpkg -i product-installer.deb
```

The bundle's `postinst` script automatically installs all sub-packages in order, and `postrm` removes them in reverse order.

---

## Installation

```bash
npm install -g debcompose
```

Requires **Node.js >= 22** and **dpkg-deb** (included with Debian/Ubuntu systems).

---

## Quick Start

```bash
# Create a directory with your .deb files
mkdir -p packages
cp /path/to/runtime.deb packages/
cp /path/to/server.deb packages/
cp /path/to/client.deb packages/

# Build the bundle
debcompose build packages --output ./dist --version 1.0.0 --name my-product-installer

# Install the bundle (on target system)
sudo dpkg -i dist/my-product-installer_1.0.0_amd64.deb
```

---

## CLI Reference

### `serve` — Start the HTTP server

```bash
debcompose serve
```

Starts a web server at `http://localhost:3000` for creating and debugging bundles via a web UI.

### `build` — Build a bundle

```bash
debcompose build <deb-dir> [options]
debcompose <deb-dir> [options]    # shortcut
```

| Option | Short | Description | Default |
|---|---|---|---|
| `--output` | `-o` | Output directory | current directory |
| `--version` | `-v` | Bundle version | `1.0.0` |
| `--name` | `-n` | Package name | auto-detected |
| `--arch` | | Architecture | `amd64` |
| `--maintainer` | | Maintainer field | `Unknown <unknown>` |
| `--description` | | Description field | auto-generated |

Example:

```bash
debcompose build ./packages \
  --output ./dist \
  --version 2.0.0 \
  --name enterprise-product \
  --arch amd64 \
  --maintainer "Acme Corp <support@acme.com>"
```

Shortcut (omitting `build`):

```bash
debcompose ./packages -o ./dist -v 1.2.0 -n my-product
```

---

## Bundle Structure

The generated `.deb` has the following internal layout:

```
product-installer.deb
│
├── DEBIAN/
│   ├── control              # Package metadata
│   ├── postinst             # Post-install script (installs sub-packages)
│   └── postrm               # Post-remove script (removes sub-packages)
│
└── opt/
    └── bundle/
        ├── manifest.json    # Package manifest
        ├── runtime.deb      # Sub-package
        ├── server.deb       # Sub-package
        └── client.deb       # Sub-package
```

### manifest.json

```json
{
    "version": "1.0.0",
    "packages": [
        { "name": "runtime", "file": "runtime_1.0.0_amd64.deb" },
        { "name": "server",  "file": "server_2.0.0_amd64.deb" },
        { "name": "client",  "file": "client_2.0.0_amd64.deb" }
    ]
}
```

---

## How It Works

### Installation Flow

```
dpkg -i bundle.deb
       ↓
  postinst executes
       ↓
  Reads opt/bundle/manifest.json
       ↓
  Installs packages in manifest order
       ↓
  dpkg -i runtime.deb
  dpkg -i server.deb
  dpkg -i client.deb
```

### Uninstallation Flow

```
dpkg -r product-installer
       ↓
  postrm executes (remove/purge)
       ↓
  Reads opt/bundle/manifest.json
       ↓
  Removes packages in REVERSE order
       ↓
  dpkg -r client
  dpkg -r server
  dpkg -r runtime
```

All operations are logged to `/var/log/product-installer.log`.

### Error Handling

- **Installation**: If a sub-package fails to install, the process stops with an error (atomic-like behavior).
- **Removal**: If a sub-package fails to remove, a warning is logged but removal continues.

---

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

The project uses **zero external dependencies** — only Node.js >= 22 built-in APIs (`node:test`, `node:assert`, `node:fs/promises`, `node:child_process`, `node:util`).

### Project Structure

```
src/
├── cli.js                 CLI entry point
├── logger/                 Logging abstraction
├── error/                  Error types
├── deb/                    dpkg-deb wrapper
├── manifest/               Manifest read/write/validate
├── control/                DEBIAN/control generator
├── scripts/                postinst/postrm generator
├── packager/               dpkg-deb -b wrapper
└── builder/                Build orchestrator
```

---

## License

MIT
