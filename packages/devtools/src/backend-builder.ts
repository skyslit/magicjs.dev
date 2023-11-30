import { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';
import { BuilderBase, ConfigurationOptions } from './builder-base';
import path from 'path';
import WatchExternalFilesPlugin from 'webpack-watch-files-plugin';
import fs from 'fs';
import Case from 'case';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import glob from 'fast-glob';
import { extractBackendModuleId } from './utils/backend-module-extractor';

/**
 * Backend Builder
 */
export class BackendBuilder extends BuilderBase {
  private entryFilePath: string;
  private virtualModules: VirtualModulesPlugin;
  /**
   * Creates a new backend builder instance
   * @param {string} entryFilePath
   */
  constructor(entryFilePath: string) {
    super();
    this.entryFilePath = entryFilePath;
    this.virtualModules = new VirtualModulesPlugin({
      [`src/server.tsx`]: `
        // @ts-nocheck
        import React from 'react';
        import ReactDOM from 'react-dom';
        import { startApp } from '@skyslit/ark-frontend';
        import { initializeModules } from './auto-loader.tsx';
        import runApp from './app.tsx';

        initializeModules();
        runApp();
      `
    })
  }

  initCompiler(opts: ConfigurationOptions) {
    this.compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      let importExpressions: string = '';
      let registrationExpressions: string = '';

      const arkJSONPath = path.join(opts.cwd, 'src', 'ark.json');
      const arkJSON: any = JSON.parse(fs.readFileSync(arkJSONPath, 'utf-8'));
      if (Array.isArray(arkJSON.routes)) {
        const importables = arkJSON.routes.map((route) => {
          return {
            path: route.path,
            filePath: `./${path.relative(path.join(opts.cwd, 'src'), path.join(opts.cwd, 'src', route.view))}`,
            fileId: Case.camel(route.view)
          }
        });

        importExpressions = importables.map((importable: any) => `import ${importable.fileId} from '${importable.filePath}';`).join('\n');
        registrationExpressions = importables.map((importable: any) => `registerView('${importable.path}', '${importable.fileId}', ${importable.fileId});`).join('\n');
      }

      // Load all backend modules
      const entries = glob.sync(['src/**/**.server.tsx'], { dot: false, cwd: opts.cwd });

      const backendImportables = entries.map((filePath) => {
        return {
          filePath: `./${path.relative(path.join(opts.cwd, 'src'), path.join(opts.cwd, filePath))}`,
          moduleVarName: Case.camel(path.relative(path.join(opts.cwd, 'src', 'backend'), path.join(opts.cwd, filePath))),
          moduleId: extractBackendModuleId(opts.cwd, filePath)
        }
      });

      const backendImportExpressions = backendImportables.map((importable: any) => `import ${importable.moduleVarName} from '${importable.filePath}';`).join('\n');
      const backendregistrationExpressions = backendImportables.map((importable: any) => `registerBackendComponent('${importable.moduleId}', ${importable.moduleVarName});`).join('\n');


      this.virtualModules.writeModule('src/auto-loader.tsx', `
        import { registerView } from '@skyslit/ark-frontend';
        import { registerBackendComponent } from '@skyslit/ark-backend';

        ${backendImportExpressions}
        ${importExpressions}
        
        export function initializeModules() {
            ${backendregistrationExpressions}
            ${registrationExpressions}
        }
      `);
    });
  }

  /**
   * @param {ConfigurationOptions} opts
   * @return {Configuration}
   */
  getConfiguration({ cwd, mode }: ConfigurationOptions): Configuration {
    const babelLoaderOptions = {
      // Should not take any babelrc file located in the project root
      babelrc: false,
      inputSourceMap: mode === 'development',
      sourceMaps: mode === 'development' ? 'both' : false,
      compact: mode === 'production',
      presets: [
        [
          require.resolve('@babel/preset-env'),
          {
            targets: { browsers: ['last 2 versions'] },
            modules: false,
          },
        ],
        [
          require.resolve('@babel/preset-typescript'),
          { allowNamespaces: true },
        ],
        [require.resolve('@babel/preset-react')],
      ],
      cacheDirectory: true,
      cacheCompression: false,
      plugins: [
        require.resolve('@babel/plugin-proposal-class-properties'),
        require.resolve('@babel/plugin-syntax-dynamic-import'),
      ],
    };

    return {
      devtool: mode === 'development' ? 'source-map' : false,
      context: cwd,
      mode,
      resolve: {
        modules: ['scripts', 'node_modules'],
        extensions: ['.json', '.ts', '.tsx', '.js', '.jsx'],
        alias: {
          ...this.mapPeerDependencies(
            ['react', 'react-dom', 'react-router-dom'],
            cwd
          ),
        },
        symlinks: true,
      },
      entry: {
        ['server']: this.entryFilePath
      },
      output: {
        publicPath: '/',
        filename: 'main.js',
        path: path.resolve(cwd, 'build', 'server'),
        assetModuleFilename: './assets/[hash][ext][query]',
      },
      target: 'node',
      externals: [
        nodeExternals({
          allowlist: [
            '@skyslit/ark-backend',
            '@skyslit/ark-frontend',
            // Allow the stylesheet to be handled by ignore-loader
            this.getStyleTestExp(),
          ],
        }),
      ],
      stats: {
        loggingTrace: false,
        errorStack: false,
      },
      plugins: [
        new WatchExternalFilesPlugin({
          files: [
            './src/ark.json'
          ]
        }),
        this.virtualModules
      ],
      module: {
        rules: [
          {
            test: /\.js$/,
            enforce: 'pre',
            use: [require.resolve('source-map-loader')],
          },
          {
            test: /\.(js|mjs|jsx|ts|tsx)$/,
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve('babel-loader'),
                options: babelLoaderOptions,
              },
            ],
          },
          {
            test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
            use: [
              {
                loader: require.resolve('babel-loader'),
                options: babelLoaderOptions,
              },
              {
                loader: require.resolve('@svgr/webpack'),
                options: {
                  babel: false,
                  icon: true,
                },
              },
            ],
          },
          {
            test: /\.(png|jpg|jpeg|gif|woff2|woff|ttf|eot)$/i,
            use: [
              {
                loader: require.resolve('file-loader'),
                options: {
                  name: '[contenthash].[ext]',
                  outputPath: 'assets',
                  emitFile: false,
                },
              },
            ],
          },
          {
            test: this.getStyleTestExp(),
            loader: require.resolve('ignore-loader'),
          },
          {
            test: this.getLESSStyleTestExp(),
            loader: require.resolve('ignore-loader'),
          },
        ],
      },
    };
  }
}
