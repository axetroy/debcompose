import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateControl, createControlData, formatControl } from '../../src/control/schema.js';

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

  it('returns errors for missing required fields', () => {
    const errors = validateControl({});
    assert.ok(errors.some(e => e.includes('package')));
    assert.ok(errors.some(e => e.includes('version')));
    assert.ok(errors.some(e => e.includes('architecture')));
    assert.ok(errors.some(e => e.includes('maintainer')));
    assert.ok(errors.some(e => e.includes('description')));
  });

  it('returns no errors for valid data', () => {
    assert.equal(validateControl(MINIMAL_PARAMS).length, 0);
  });
});

describe('createControlData', () => {
  it('fills defaults for optional fields', () => {
    const data = createControlData(MINIMAL_PARAMS);
    assert.equal(data.section, 'admin');
    assert.equal(data.priority, 'optional');
  });

  it('throws for missing required fields', () => {
    assert.throws(() => createControlData({}), /invalid control data/);
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
});
