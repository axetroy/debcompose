import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateControl, createControlData, formatControl, CONTROL_FIELDS } from '../../src/control/schema.js';
import { DebComposeError } from '../../src/error/index.js';

const MINIMAL_PARAMS = {
  package: 'test-installer',
  version: '1.0.0',
  architecture: 'amd64',
  maintainer: 'Test <test@test.com>',
  description: 'Test package',
};

describe('validateControl', () => {
  it('returns errors for null', () => {
    assert.ok(validateControl(null).length > 0);
  });

  it('returns errors for undefined', () => {
    assert.ok(validateControl(undefined).length > 0);
  });

  it('returns errors for arrays', () => {
    assert.ok(validateControl([]).length > 0);
  });

  it('returns errors for missing required fields', () => {
    const errors = validateControl({});
    assert.ok(errors.some(e => e.includes('package')));
    assert.ok(errors.some(e => e.includes('version')));
    assert.ok(errors.some(e => e.includes('architecture')));
    assert.ok(errors.some(e => e.includes('maintainer')));
    assert.ok(errors.some(e => e.includes('description')));
  });

  it('returns errors for whitespace-only required fields', () => {
    const errors = validateControl({
      package: '   ',
      version: '',
      architecture: '\t',
      maintainer: '\n',
      description: '',
    });
    assert.ok(errors.length > 0);
  });

  it('returns no errors for valid data', () => {
    assert.equal(validateControl(MINIMAL_PARAMS).length, 0);
  });

  it('does not require optional fields', () => {
    const errors = validateControl({
      package: 'test',
      version: '1.0.0',
      architecture: 'amd64',
      maintainer: 'Test',
      description: 'Test',
    });
    assert.equal(errors.length, 0);
  });
});

describe('createControlData', () => {
  it('fills defaults for optional fields', () => {
    const data = createControlData(MINIMAL_PARAMS);
    assert.equal(data.section, 'misc');
    assert.equal(data.priority, 'optional');
  });

  it('throws for missing required fields', () => {
    assert.throws(() => createControlData({}), /invalid control data/);
  });

  it('throws for empty string required fields', () => {
    assert.throws(
      () => createControlData({ ...MINIMAL_PARAMS, package: '' }),
      /invalid control data/
    );
  });

  it('throws DebComposeError with INVALID_INPUT code', () => {
    assert.throws(
      () => createControlData({}),
      (err) => {
        assert.ok(err instanceof DebComposeError);
        assert.equal(err.code, 'INVALID_INPUT');
        return true;
      }
    );
  });

  it('overrides defaults when explicit values provided', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      section: 'admin',
      priority: 'required',
    });
    assert.equal(data.section, 'admin');
    assert.equal(data.priority, 'required');
  });

  it('does not include undefined optional fields', () => {
    const data = createControlData(MINIMAL_PARAMS);
    assert.equal(data.depends, undefined);
    assert.equal(data.license, undefined);
  });

  it('includes defined optional fields', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      depends: 'jq',
      license: 'MIT',
    });
    assert.equal(data.depends, 'jq');
    assert.equal(data.license, 'MIT');
  });
});

describe('formatControl', () => {
  it('formats control file correctly', () => {
    const data = createControlData(MINIMAL_PARAMS);
    const output = formatControl(data);
    assert.ok(output.includes('Package: test-installer\n'));
    assert.ok(output.includes('Version: 1.0.0\n'));
    assert.ok(output.includes('Architecture: amd64\n'));
    assert.ok(output.endsWith('\n'));
  });

  it('handles multi-line description', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      description: 'Line one\nLine two\nLine three',
    });
    const output = formatControl(data);
    assert.ok(output.includes('Description: Line one\n'));
    assert.ok(output.includes(' Line two\n'));
    assert.ok(output.includes(' Line three\n'));
  });

  it('includes depends when provided', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      depends: 'jq, python3',
    });
    const output = formatControl(data);
    assert.ok(output.includes('Depends: jq, python3\n'));
  });

  it('excludes undefined fields', () => {
    const data = createControlData(MINIMAL_PARAMS);
    const output = formatControl(data);
    assert.ok(!output.includes('Depends:'));
    assert.ok(!output.includes('License:'));
  });

  it('includes installed size as integer', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      installedSize: 1024,
    });
    const output = formatControl(data);
    assert.ok(output.includes('Installed-Size: 1024\n'));
  });

  it('includes license when provided', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      license: 'MIT',
    });
    const output = formatControl(data);
    assert.ok(output.includes('License: MIT\n'));
  });

  it('handles single line description correctly', () => {
    const data = createControlData({
      ...MINIMAL_PARAMS,
      description: 'Simple description',
    });
    const output = formatControl(data);
    assert.ok(output.includes('Description: Simple description\n'));
    // Description line should not be followed by continuation lines
    const lines = output.split('\n');
    const descLineIndex = lines.findIndex(l => l.startsWith('Description:'));
    // The next line (if any) should not start with a space
    const nextLine = lines[descLineIndex + 1];
    assert.ok(!nextLine || !nextLine.startsWith(' '), 'Single line description should not have continuation');
  });
});

describe('CONTROL_FIELDS', () => {
  it('defines all expected fields', () => {
    assert.ok(CONTROL_FIELDS.package);
    assert.ok(CONTROL_FIELDS.version);
    assert.ok(CONTROL_FIELDS.architecture);
    assert.ok(CONTROL_FIELDS.maintainer);
    assert.ok(CONTROL_FIELDS.description);
    assert.ok(CONTROL_FIELDS.section);
    assert.ok(CONTROL_FIELDS.priority);
  });

  it('marks required fields correctly', () => {
    assert.equal(CONTROL_FIELDS.package.required, true);
    assert.equal(CONTROL_FIELDS.version.required, true);
    assert.equal(CONTROL_FIELDS.architecture.required, true);
    assert.equal(CONTROL_FIELDS.maintainer.required, true);
    assert.equal(CONTROL_FIELDS.description.required, true);
    assert.equal(CONTROL_FIELDS.section.required, false);
    assert.equal(CONTROL_FIELDS.priority.required, false);
  });

  it('has correct labels', () => {
    assert.equal(CONTROL_FIELDS.package.label, 'Package');
    assert.equal(CONTROL_FIELDS.version.label, 'Version');
    assert.equal(CONTROL_FIELDS.architecture.label, 'Architecture');
    assert.equal(CONTROL_FIELDS.installedSize.label, 'Installed-Size');
  });
});
