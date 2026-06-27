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

## Docker Deployment

You can run the DebCompose HTTP server in a Docker container using the provided `Dockerfile` and `docker-compose.yml`.

### Using docker-compose (recommended)

```bash
# Build and start the server
docker-compose up -d

# Or run in foreground
docker-compose up
```

This will start the server at `http://localhost:3000`. The server loads configuration from the following environment variables (set in `docker-compose.yml` or passed as `docker run -e`):

- `DEB_COMPOSE_NAME`
- `DEB_COMPOSE_VERSION`
- `DEB_COMPOSE_ARCH`
- `DEB_COMPOSE_MAINTAINER`
- `DEB_COMPOSE_DESCRIPTION`
- `DEB_COMPOSE_SECTION`
- `DEB_COMPOSE_PRIORITY`
- `DEB_COMPOSE_LICENSE`
- `DEB_COMPOSE_PORT` (default `3000`)

Default `docker-compose.yml` mounts `./packages` (your .deb files) and `./dist` (output bundles) so you can build bundles via the web UI or the HTTP API.

### Using Docker directly

```bash
# Build the image
docker build -t debcompose .

# Run the server (ports 3000)
docker run -d \
  --name debcompose \
  -p 3000:3000 \
  -e DEB_COMPOSE_NAME=my-product \
  -e DEB_COMPOSE_VERSION=1.0.0 \
  -e DEB_COMPOSE_ARCH=amd64 \
  -e DEB_COMPOSE_SECTION=misc \
  -e DEB_COMPOSE_PRIORITY=optional \
  -e DEB_COMPOSE_LICENSE=MIT \
  -v $(pwd)/packages:/app/packages \
  -v $(pwd)/dist:/app/dist \
  debcompose
```

### Building bundles via Docker

You can also build bundles without the HTTP server by running the CLI inside the container:

```bash
docker run --rm \
  -v $(pwd)/packages:/app/packages \
  -v $(pwd)/dist:/app/dist \
  debcompose build /app/packages \
  --output /app/dist \
  --version 2.0.0 \
  --name my-product
```

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

**Web UI features:**
- **Upload** `.deb` files via drag-and-drop or file picker
- **Reorder** packages with ↑↓ buttons to set installation order
- **Preview** bundle structure before building (directory tree, package list)
- **Build** with real-time progress bar and status polling
- **Download** the generated `.deb` bundle
- Error display with detailed failure information

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
| `--arch` | | Target architecture (amd64, i386, arm64, armhf, etc.) | `amd64` |
| `--maintainer` | | Maintainer field | `Unknown <unknown>` |
| `--description` | | Description field | auto-generated |
| `--section` | | Package section (e.g., utils, net, devel) | `misc` |
| `--priority` | | Package priority (required, important, standard, optional, extra) | `optional` |
| `--license` | | License identifier (e.g., GPL, MIT, Apache) | (empty) |

> **Note**: The control file format follows the [Debian Policy Manual](https://www.debian.org/doc/debian-policy/ch-controlfields.html).

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

### Environment Variables

You can set default configuration values using environment variables. These are useful for Docker deployments or CI/CD pipelines:

| Environment Variable | CLI Option | Description | Default |
|---------------------|------------|-------------|---------|
| `DEB_COMPOSE_NAME` | `--name` | Package name | auto-detected |
| `DEB_COMPOSE_VERSION` | `--version` | Bundle version | `1.0.0` |
| `DEB_COMPOSE_ARCH` | `--arch` | Target architecture | `amd64` |
| `DEB_COMPOSE_MAINTAINER` | `--maintainer` | Maintainer string | `Unknown <unknown>` |
| `DEB_COMPOSE_DESCRIPTION` | `--description` | Package description | auto-generated |
| `DEB_COMPOSE_SECTION` | `--section` | Package section | `misc` |
| `DEB_COMPOSE_PRIORITY` | `--priority` | Package priority | `optional` |
| `DEB_COMPOSE_LICENSE` | `--license` | License identifier | (empty) |
| `DEB_COMPOSE_PORT` | (server only) | HTTP server port | `3000` |
| `DEB_COMPOSE_LOG_LEVEL` | (server only) | Log level (debug, info, warn, error) | `info` |

Example:

```bash
export DEB_COMPOSE_NAME=my-product
export DEB_COMPOSE_VERSION=2.0.0
export DEB_COMPOSE_ARCH=arm64
export DEB_COMPOSE_SECTION=utils
export DEB_COMPOSE_PRIORITY=optional
export DEB_COMPOSE_LICENSE=MIT

debcompose build ./packages
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
│   ├── postrm               # Post-remove script (removes sub-packages)
│   └── md5sums              # MD5 checksums for payload files
│
└── opt/
    └── bundle/
        ├── manifest.json    # Package manifest (version + package list)
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
