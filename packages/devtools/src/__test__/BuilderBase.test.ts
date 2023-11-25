/* eslint-disable require-jsdoc */
import { Configuration } from 'webpack';
import { BuilderBase, ConfigurationOptions } from '../builder-base';
import path from 'path';
import memfs from 'memfs';
import { Union } from 'unionfs';
import * as fs from 'fs';

describe('builder utils', () => {
  test('mapPeerDependencies() default behaviour', () => {
    const builder = new BuilderBase();
    const processCwd = process.cwd();
    const result = builder.mapPeerDependencies(['react-router-dom', 'react']);
    expect(result['react-router-dom']).toContain(processCwd);
    expect(result['react']).toContain(processCwd);
  });

  test('mapPeerDependencies() custom cwd should map to process.cwd', () => {
    const builder = new BuilderBase();
    const processCwd = process.cwd();
    const customCwd = path.resolve(__dirname, '../__test__/test-project');
    const result = builder.mapPeerDependencies(
      ['react-router-dom', 'react'],
      customCwd
    );
    expect(result['react-router-dom']).toContain(processCwd);
    expect(result['react']).toContain(processCwd);
  });

  test('mapPeerDependencies() custom cwd should map to custom cwd', () => {
    const builder = new BuilderBase();
    const customCwd = path.resolve(__dirname, '../../../ark-frontend');
    const result = builder.mapPeerDependencies(
      ['react-router-dom', 'react'],
      customCwd
    );
    expect(result['react-router-dom']).toContain(customCwd);
    expect(result['react']).toContain(customCwd);
  });

  test('getVirtualFile() should output existing file', () => {
    const projectCwd = path.join(__dirname, './test-project');
    const templatePath = path.join(
      __dirname,
      './test-assets/virtual-optional-file.template.ejs'
    );
    const builder = new BuilderBase();
    const data = builder.getOptionalFile(
      projectCwd,
      './src/optional.admin.client.tsx',
      templatePath,
      {
        message: 'Hello John Doe',
      }
    );
    expect(data).toContain(`console.log('Hello there');`);
  });

  test('getVirtualFile() should render template if file not exist', () => {
    const projectCwd = path.join(__dirname, './test-project');
    const templatePath = path.join(
      __dirname,
      './test-assets/virtual-optional-file.template.ejs'
    );
    const builder = new BuilderBase();
    const data = builder.getOptionalFile(
      projectCwd,
      './src/optional-missing.admin.client.tsx',
      templatePath,
      {
        message: 'Hello John Doe',
      }
    );
    expect(data).toContain(`console.log('Hello John Doe');`);
  });

  // eslint-disable-next-line max-len
  test('getVirtualFile() should throw error if no template file is found', () => {
    const projectCwd = path.join(__dirname, './test-project');
    const templatePath =
      // eslint-disable-next-line max-len
      path.join(
        __dirname,
        './test-assets/virtual-optional-missing-file.template.ejs'
      );
    const builder = new BuilderBase();
    const t = () =>
      builder.getOptionalFile(
        projectCwd,
        './src/optional-missing.admin.client.tsx',
        templatePath,
        {
          message: 'Hello John Doe',
        }
      );
    expect(t).toThrowError();
  });
});

describe('builder base configuration', () => {
  class SampleBuilder extends BuilderBase {
    getConfiguration({ cwd, mode }: ConfigurationOptions): Configuration {
      return {
        mode,
      };
    }
  }

  test('getFullyQualifiedConfiguration() fn', () => {
    const builderInstance = new SampleBuilder();
    const configuration = builderInstance.getConfiguration({
      cwd: '/test',
      mode: 'production',
    });
    expect(configuration.mode).toEqual('production');
  });
});

describe('build stage: production', () => {
  class SampleBuilder extends BuilderBase {
    private entryPathname: string;
    constructor(entryPath: string) {
      super();
      this.entryPathname = entryPath;
    }

    getConfiguration({ cwd, mode }: ConfigurationOptions): Configuration {
      return {
        mode,
        entry: this.entryPathname,
        output: {
          filename: 'main.js',
          path: path.resolve(cwd, 'build'),
        },
        module: {
          rules: [
            {
              test: /\.(ts|tsx|js|jsx)$/,
              use: [
                {
                  loader: path.resolve(
                    __dirname,
                    '../../node_modules',
                    'babel-loader'
                  ),
                },
              ],
            },
          ],
        },
      };
    }
  }

  const cwd: string = process.cwd();
  const testRoot: string = '__webpack__test';
  let vol: any;
  let outputFileSystem: any;
  let inputFileSystem: any;

  beforeEach(() => {
    // Setup Output Filesystem
    vol = memfs.Volume.fromJSON(
      {
        [`${testRoot}/main.server.ts`]: `console.log('Server program');`,
        [`${testRoot}/main-error.server.ts`]: `console.log('Server program);`,
        [`${testRoot}/dashboard.client.js`]: `console.log('Dashboard client program');`,
        [`${testRoot}/admin.client.js`]: `console.log('Admin client program');`,
      },
      cwd
    );
    outputFileSystem = memfs.createFsFromVolume(vol);

    // Setup Input Filesystem
    inputFileSystem = new Union();
    inputFileSystem.use(fs).use(vol as any);
  });

  test(
    'success operation',
    (done) => {
      const builderInstance = new SampleBuilder(
        path.join(cwd, testRoot, 'main.server.ts')
      );
      builderInstance.attachMonitor((err) => {
        if (err) {
          done(err);
        } else {
          try {
            const buildOutput: string = outputFileSystem.readFileSync(
              path.join(cwd, 'build', 'main.js'),
              'utf-8'
            );
            expect(buildOutput).toContain('Server program');
            expect(buildOutput).toMatchSnapshot();
            done();
          } catch (e) {
            done(e);
          }
        }
      });

      builderInstance.build(
        {
          mode: 'production',
          cwd: process.cwd(),
        },
        inputFileSystem,
        outputFileSystem
      );
    },
    120 * 1000
  );

  test(
    'error operation',
    (done) => {
      const builderInstance = new SampleBuilder(
        path.join(cwd, testRoot, 'main-error.server.ts')
      );

      builderInstance.attachMonitor((err, result) => {
        if (err) {
          done(err);
        } else {
          expect(result.compilation.errors).toHaveLength(1);
          expect(result.compilation.warnings).toHaveLength(0);
          done();
        }
      });

      builderInstance.build(
        {
          mode: 'production',
          cwd: process.cwd(),
        },
        inputFileSystem,
        outputFileSystem
      );
    },
    120 * 1000
  );
});
