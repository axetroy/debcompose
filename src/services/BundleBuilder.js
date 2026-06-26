import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class BundleBuilder {
  /**
   * Generates a Debian bundle package.
   * @param {Object} options
   * @param {string[]} options.packages - List of deb files to include.
   * @param {string[]} options.order - The installation order of packages.
   * @param {string} options.outputDir - Where to save the generated bundle.
   */
  async build({ packages, order, outputDir = 'dist' }) {
    console.log('Building bundle...');
    
    try {
      // 1. Create bundle directory structure
      const bundleRoot = path.join(outputDir, `bundle_${Date.now()}`);
      const debDir = path.join(bundleRoot, 'opt', 'bundle');
      const debianDir = path.join(bundleRoot, 'DEBIAN');

      await fs.mkdir(debDir, { recursive: true });
      await fs.mkdir(debianDir, { recursive: true });

      // 2. Copy deb files in specified order
      for (const pkg of order) {
        // In a real scenario, we find the file by name
        // For this implementation, we assume packages are already paths or we search for them
        const src = packages.find(p => p.name === pkg)?.path || pkg;
        if (typeof src === 'string' && await this._exists(src)) {
          await fs.copyFile(src, path.join(debDir, path.basename(src)));
        }
      }

      // 3. Generate manifest.json
      const manifest = {
        version: '1.0.0',
        packages: order.map(name => ({ name, file: `${name}.deb` }))
      };
      await fs.writeFile(
        path.join(debianDir, 'manifest.json'), 
        JSON.stringify(manifest, null, 2)
      );

      // 4. Generate control file
      const control = `Package: debcompose-bundle\nVersion: 1.0.0\nSection: misc\nPriority: optional\nArchitecture: amd64\nMaintainer: DebCompose\nDescription: Aggregated deb bundle\n`;
      await fs.writeFile(path.join(debianDir, 'control'), control);

      // 5. Generate postinst/postrm scripts (Simplified mock)
      await fs.writeFile(
        path.join(debianDir, 'postinst'), 
        `#!/bin/bash\n# Install packages based on manifest\n`
      );
      await fs.chmod(path.join(debianDir, 'postinst'), '755');

      await fs.writeFile(
        path.join(debianDir, 'postrm'), 
        `#!/bin/bash\n# Uninstall packages based on manifest\n`
      );
      await fs.chmod(path.join(debianDir, 'postrm'), '755');

      // 6. Call dpkg-deb to build the package
      // Note: This requires dpkg-deb installed on the host system
      try {
        await execAsync(`dpkg-deb --build ${bundleRoot}`);
        return { 
          success: true, 
          bundlePath: `${bundleRoot}.deb`,
          bundleId: path.basename(`${bundleRoot}.deb`)
        };
      } catch (e) {
        console.error('dpkg-deb failed. Is it installed?');
        return { success: false, error: 'dpkg-deb not found' };
      }
    } catch (error) {
      console.error('Build error:', error);
      throw error;
    }
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
