import { Configuration } from 'webpack';
import { BuilderBase, ConfigurationOptions } from './builder-base';
import path from 'path';
import HTMLWebpackPlugin from 'html-webpack-plugin';
import { GhostFileActions, createGhostFile } from './ghost-file';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import Case from 'case';
import fs from 'fs';
import WatchExternalFilesPlugin from 'webpack-watch-files-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';

/**
 * SPA Builder
 */
export class SPABuilder extends BuilderBase {
  private appFilePath: string;
  private appId: string;
  private virtualModules: VirtualModulesPlugin;
  /**
   * Creates a new SPA builder instance
   * @param {string} id
   * @param {string} appFilePath
   */
  constructor(id: string, appFilePath: string) {
    super();
    this.appId = id;
    this.appFilePath = appFilePath;
    this.virtualModules = new VirtualModulesPlugin({
      [`src/${this.appId}.tsx`]: `
        // @ts-nocheck
        import React from 'react';
        import ReactDOM from 'react-dom';
        import { startApp } from '@skyslit/ark-frontend';
        import { initializeModules } from './auto-loader.tsx';

        initializeModules();
        startApp();
      `
    })

    if (!this.appId) {
      throw new Error('App ID should not be null');
    }
  }
  /**
   * Get Ghost Files
   * @param {ConfigurationOptions} opts
   * @return {GhostFileActions[]}
   */
  getGhostFiles(opts: ConfigurationOptions): GhostFileActions[] {
    let importExpressions: string = '';
    let registrationExpressions: string = '';

    const arkJSONPath = path.join(opts.cwd, 'src', 'ark.json');
    const arkJSON: any = JSON.parse(fs.readFileSync(arkJSONPath, 'utf-8'));
    if (Array.isArray(arkJSON.routes)) {
      const importables = arkJSON.routes.map((route) => {
        return {
          filePath: `./${path.relative(path.join(opts.cwd, 'src'), path.join(opts.cwd, 'src', route.view))}`,
          fileId: Case.camel(route.view)
        }
      });

      importExpressions = importables.map((importable: any) => `import ${importable.fileId} from '${importable.filePath}';`).join('\n');
      registrationExpressions = importables.map((importable: any) => `registerView('${importable.fileId}', ${importable.fileId});`).join('\n');
    }

    return [
      // createGhostFile(
      //   path.join(__dirname, '../assets/frontend/boot.tsx.ejs'),
      //   `src/${this.appId}.tsx`,
      //   {
      //     relativeAppFilePath: path.relative(
      //       path.join(opts.cwd, 'src'),
      //       path.join(this.appFilePath)
      //     ),
      //   }
      // ),
      // createGhostFile(
      //   path.join(__dirname, '../assets/frontend/auto-loader.tsx.ejs'),
      //   `src/auto-loader.tsx`,
      //   {
      //     importExpressions,
      //     registrationExpressions
      //   }
      // ),
    ];
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

      this.virtualModules.writeModule('src/auto-loader.tsx', `
        import { registerView } from '@skyslit/ark-frontend';

        ${importExpressions}
        
        export function initializeModules() {
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
      sourceMaps: mode === 'development' ? 'inline' : false,
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
        [this.appId]: path.join(cwd, 'src', `client.tsx`),
      },
      output: {
        publicPath: '/',
        filename: `_browser/[name].js`,
        path: path.resolve(cwd, 'build'),
        assetModuleFilename: './assets/[hash][ext][query]',
        chunkFilename: '_browser/[name].[contenthash].js',
      },
      plugins: [
        new HTMLWebpackPlugin({
          filename: '[name].html',
          template: path.resolve(__dirname, '../assets/index.template.html'),
        }),
        new MiniCssExtractPlugin({
          filename: './assets/[name].css',
          chunkFilename: './assets/[name].[contenthash:8].chunk.css',
        }),
        new WatchExternalFilesPlugin({
          files: [
            './src/ark.json'
          ]
        }),
        this.virtualModules
      ],
      stats: {
        loggingTrace: false,
        errorStack: false,
      },
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
            test: /\.(png|jpg|jpeg|gif|woff2|woff|ttf)$/i,
            use: [
              {
                loader: require.resolve('file-loader'),
                options: {
                  name: '[contenthash].[ext]',
                  outputPath: 'assets',
                },
              },
            ],
          },
          {
            test: this.getStyleTestExp(),
            use: [
              {
                loader: MiniCssExtractPlugin.loader,
              },
              {
                loader: require.resolve('css-loader'),
              },
              {
                loader: require.resolve('sass-loader'),
              },
            ],
          },
        ],
      },
      performance: {
        maxEntrypointSize: 5242880,
        maxAssetSize: 5242880,
      },
      optimization: {
        minimize: mode === 'production',
        minimizer: [new TerserPlugin()],
        splitChunks: {
          chunks: 'async',
          minSize: 20000,
          minRemainingSize: 0,
          maxSize: 5242880,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          enforceSizeThreshold: 5242880,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
        runtimeChunk: {
          name: (entrypoint: any) => `runtime-${entrypoint.name}`,
        },
      },
    };
  }
}
