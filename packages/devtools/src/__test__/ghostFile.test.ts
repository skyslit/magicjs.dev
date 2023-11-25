import fs from 'fs';
import { createGhostFile } from '../ghost-file';

jest.mock('fs', () => {
  const memfs = require('memfs');
  return memfs.createFsFromVolume(
    memfs.Volume.fromJSON(
      {
        'test.template.ejs': `console.log('<%= message %>');`,
      },
      '/'
    )
  );
});

describe('ghostFile', () => {
  test('should eject rendered file', () => {
    const { eject } = createGhostFile('/test.template.ejs', 'src/index.js', {
      message: 'This is rendered from template',
    });
    eject('/');
    const ejectedFileOutput = fs.readFileSync('/src/index.js', 'utf-8');
    expect(ejectedFileOutput).toBe(
      `console.log('This is rendered from template');`
    );
  });

  test('should provide rendered file to virtual volume', () => {
    const { provide } = createGhostFile(
      '/test.template.ejs',
      'src/new.index.js',
      {
        message: 'This is provided from template',
      }
    );
    const volSnapshot = provide('/');
    expect(volSnapshot['src/new.index.js']).toBe(
      `console.log('This is provided from template');`
    );
  });

  test('should not provide rendered file to virtual volume', () => {
    const { provide } = createGhostFile('/test.template.ejs', 'src/index.js', {
      message: 'This is provided from template',
    });
    const volSnapshot = provide('/');
    expect(Object.keys(volSnapshot)).toHaveLength(0);
  });
});
