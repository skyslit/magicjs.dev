import { Configuration, HotModuleReplacementPlugin } from 'webpack';
import { BuilderBase, ConfigurationOptions } from './builder-base';
import path from 'path';
import HTMLWebpackPlugin from 'html-webpack-plugin';
import { GhostFileActions } from './ghost-file';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import Case from 'case';
import fs from 'fs';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { generateAutoloaderFile } from './utils/generate-auto-loader-file';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

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
      [path.join('src', `${this.appId}.tsx`)]: `
        import { startApp } from '@magicjs.dev/frontend';
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

    const arkJSONPath = path.join(opts.cwd, 'src', 'app.json');
    const arkJSON: any = JSON.parse(fs.readFileSync(arkJSONPath, 'utf-8'));
    if (Array.isArray(arkJSON.routes)) {
      const importables = arkJSON.routes.map((route) => {
        return {
          filePath: `.${path.sep}${path.relative(path.join(opts.cwd, 'src'), path.join(opts.cwd, 'src', route.view))}`,
          fileId: Case.camel(route.view)
        }
      });

      importExpressions = importables.map((importable: any) => `import ${importable.fileId} from '${importable.filePath}';`).join('\n');
      registrationExpressions = importables.map((importable: any) => `registerView('${importable.fileId}', ${importable.fileId});`).join('\n');
    }

    return [];
  }

  initCompiler(opts: ConfigurationOptions) {
    this.compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      const content = generateAutoloaderFile(opts.cwd, 'frontend');
      this.virtualModules.writeModule(path.join('src', 'auto-loader.tsx'), content);
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
        mode === 'development' && require.resolve('react-refresh/babel')
      ].filter(Boolean),
    };

    return {
      cache: true,
      devtool: mode === 'development' ? 'source-map' : false,
      context: cwd,
      mode,
      resolve: {
        fallback: {
          'path': require.resolve('path-browserify')
        },
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
        [this.appId]: [
          mode === 'development' && require.resolve('webpack-hot-middleware/client'),
          path.join(cwd, 'src', `client.tsx`)
        ].filter(Boolean),
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
        this.virtualModules,
        mode === 'development' && new HotModuleReplacementPlugin({
          autoConnect: true,
          timeout: 4000
        }),
        mode === 'development' && new ReactRefreshWebpackPlugin({
          overlay: false,
          forceEnable: true
        })
      ].filter(Boolean),
      stats: {
        loggingTrace: false,
        errorStack: false,
      },
      resolveLoader: {
        modules: ['node_modules', path.resolve(__dirname, 'loaders')]
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
              'remote-loader'
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
            test: /\.(png|jpg|jpeg|gif)$/i,
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
              (() => {
                if (mode === 'development') {
                  return {
                    loader: require.resolve('style-loader')
                  }
                }

                return {
                  loader: MiniCssExtractPlugin.loader
                }
              })(),
              {
                loader: require.resolve('css-loader'),
              },
              {
                loader: require.resolve('postcss-loader'),
              },
              {
                loader: require.resolve('sass-loader'),
              }
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
