import { Configuration } from 'webpack';
import { BuilderBase, ConfigurationOptions } from './builder-base';
import path from 'path';
import HTMLWebpackPlugin from 'html-webpack-plugin';
import { GhostFileActions, createGhostFile } from './ghost-file';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';

/**
 * SPA Builder
 */
export class SPABuilder extends BuilderBase {
  private appFilePath: string;
  private appId: string;
  /**
   * Creates a new SPA builder instance
   * @param {string} id
   * @param {string} appFilePath
   */
  constructor(id: string, appFilePath: string) {
    super();
    this.appId = id;
    this.appFilePath = appFilePath;

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
    return [
      createGhostFile(
        path.join(__dirname, '../../assets/Frontend/root.tsx.ejs'),
        `src/${this.appId}.tsx`,
        {
          relativeAppFilePath: path.relative(
            path.join(opts.cwd, 'src'),
            path.join(this.appFilePath)
          ),
        }
      ),
    ];
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
        [this.appId]: path.join(cwd, 'src', `${this.appId}.tsx`),
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
          template: path.resolve(__dirname, '../../assets/index.template.html'),
        }),
        new MiniCssExtractPlugin({
          filename: './assets/[name].css',
          chunkFilename: './assets/[name].[contenthash:8].chunk.css',
        }),
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
