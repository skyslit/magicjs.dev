/* eslint-disable require-jsdoc */
import { SPABuilder } from '../frontend-builder';
import path from 'path';
import * as fs from 'fs';

describe('SPA app builder (in WATCH MODE)', () => {
  const testProjectDir: string = path.join(__dirname, './test-project');
  let outputFileSystem: any;

  beforeEach(() => {
    // Setup Output Filesystem
    outputFileSystem = fs;
  });

  test(
    'successfull build',
    (done) => {
      const builderInstance = new SPABuilder(
        'admin',
        path.join(__dirname, './test-project/src/admin.client.tsx')
      );

      builderInstance.attachMonitor((err, result) => {
        try {
          if (err) throw err;

          expect(result.compilation.errors).toHaveLength(0);
          expect(result.compilation.warnings).toHaveLength(0);

          builderInstance
            .teardown()
            .then(() => {
              done();
            })
            .catch(done);
        } catch (e) {
          done(e);
        }
      });

      builderInstance.build(
        {
          mode: 'development',
          cwd: testProjectDir,
          watchMode: true,
        },
        fs,
        outputFileSystem
      );
    },
    120 * 1000
  );
});
