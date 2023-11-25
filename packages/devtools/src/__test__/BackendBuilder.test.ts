/* eslint-disable require-jsdoc */
import { BackendBuilder } from '../backend-builder';
import { SPABuilder } from '../frontend-builder';
import path from 'path';
import * as fs from 'fs';
import execa from 'execa';
import createRequest from 'supertest';
import puppeteer from 'puppeteer';

describe('SPA app builder', () => {
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
          done();
        } catch (e) {
          done(e);
        }
      });

      builderInstance.build(
        {
          mode: 'production',
          cwd: testProjectDir,
        },
        fs,
        outputFileSystem
      );
    },
    120 * 1000
  );
});

describe('backend builder', () => {
  const testProjectDir: string = path.join(__dirname, './test-project');
  let outputFileSystem: any;

  beforeEach(() => {
    // Setup Output Filesystem
    outputFileSystem = fs;
  });

  test(
    'successfull build',
    (done) => {
      const builderInstance = new BackendBuilder(
        path.join(__dirname, './test-project/src/services/mock.server.tsx')
      );

      builderInstance.attachMonitor((err, result) => {
        try {
          if (err) throw err;
          expect(result.compilation.errors).toHaveLength(0);
          expect(result.compilation.warnings).toHaveLength(0);
          done();
        } catch (e) {
          done(e);
        }
      });

      builderInstance.build(
        {
          mode: 'development',
          cwd: testProjectDir,
        },
        fs,
        outputFileSystem
      );
    },
    120 * 1000
  );

  test(
    'artifacts should run without error',
    (done) => {
      const testProcess = execa('node', [
        path.join(testProjectDir, 'build', 'server', 'main.js'),
      ]);

      testProcess.catch((e) => done(e));

      setTimeout(() => {
        const request = createRequest('http://localhost:3001/test');
        request
          .get('/')
          .then((res) => {
            testProcess.kill();
            expect(res.status).toBe(200);
            done();
          })
          .catch((err) => {
            testProcess.kill();
            done(err);
          });
      }, 10 * 1000);
    },
    120 * 1000
  );

  test(
    'server side rendering should work',
    (done) => {
      const testProcess = execa('node', [
        path.join(testProjectDir, 'build', 'server', 'main.js'),
      ]);

      testProcess.catch((e) => done(e));

      setTimeout(() => {
        const request = createRequest('http://localhost:3001');
        request
          .get('/')
          .then((res) => {
            testProcess.kill();
            expect(res.text).toContain('Page 1 SSR Test');
            expect(res.text).not.toContain('Content from Heavy Component');
            expect(res.status).toBe(200);
            done();
          })
          .catch((err) => {
            testProcess.kill();
            done(err);
          });
      }, 10 * 1000);
    },
    120 * 1000
  );

  test(
    'lazy loading / code-splitting should work',
    (done) => {
      const testProcess = execa('node', [
        path.join(testProjectDir, 'build', 'server', 'main.js'),
      ]);

      testProcess.catch((e) => done(e));

      setTimeout(() => {
        puppeteer
          .launch()
          .then((browser) => {
            return browser
              .newPage()
              .then((page) => {
                return page.goto('http://localhost:3001').then(async () => {
                  const bodyHTML = await page.evaluate(
                    () => document.body.innerHTML
                  );
                  expect(bodyHTML).toContain('Content from Heavy Component');
                });
              })
              .then(() => {
                return browser.close();
              });
          })
          .then(() => {
            testProcess.kill();
            done();
          })
          .catch(() => {
            testProcess.kill();
            done();
          });
      }, 10 * 1000);
    },
    120 * 1000
  );
});
