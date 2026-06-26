# Changelog

## [0.1.0] - 2026-06-26

### Added

- **CLI** — `build`, `manifest generate`, `generate debian` commands
- **Bundle builder** — Orchestrates full build pipeline: scan .deb files → generate manifest → control → postinst/postrm scripts → md5sums → dpkg-deb -b
- **Manifest module** — manifest.json read/write/validation
- **Control module** — DEBIAN/control generation with Installed-Size auto-calculation
- **Scripts module** — postinst (sequential install) / postrm (reverse-order removal) generation
- **Packager module** — dpkg-deb wrapper with pre-flight availability check
- **Logger** — Level-filtered console logger (debug/info/warn/error)
- **Error handling** — Structured errors with machine-readable codes and context

### Infrastructure

- **Zero external dependencies** — Built on Node.js >= 22 native APIs only
- **Test suite** — 34 unit tests via node:test, integration test (Linux-only, auto-skip on macOS)
- **CI** — GitHub Actions (ubuntu-latest, Node 22)
- **Documentation** — README with CLI reference, architecture diagrams, quick-start guide
- **JSDoc** — Complete coverage of all public exports
