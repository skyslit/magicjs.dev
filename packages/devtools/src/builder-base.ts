import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import webpack, { Configuration, Stats } from 'webpack';
import { EventEmitter } from 'events';
import { GhostFileActions } from './ghost-file';
import memfs from 'memfs';
import { ufs, IUnionFs } from 'unionfs';

export type BuilderMonitor = (err?: Error, result?: Stats) => void;

type Mode = 'development' | 'production';

export type ConfigurationOptions = {
    mode: Mode;
    cwd: string;
    watchMode?: boolean;
};

/**
 * Wrapper for Webpack
 */
export class BuilderBase extends EventEmitter {
    compiler: webpack.Compiler;
    watching: any;
    monitor: BuilderMonitor;
    options: ConfigurationOptions;
    /**
     * Creates a new builder base instance
     * @param {EventEmitterOptions} options
     */
    constructor(options?: any) {
        super(options);
    }

    initCompiler(opts: ConfigurationOptions) {}

    /**
     * Start build process
     * @param {ConfigurationOptions} opts
     * @param {any=} ifs Input filesystem
     * @param {any=} ofs Output filesystem
     * @param {any=} wfs Watch filesystem
     */
    build(opts: ConfigurationOptions, ifs?: any, ofs?: any, wfs?: any) {
        this.options = Object.assign<
            ConfigurationOptions,
            Partial<ConfigurationOptions>
        >(
            {
                mode: 'production',
                cwd: null,
                watchMode: false,
            },
            opts
        );
        const buildConfiguration = this.getConfiguration(this.options);
        if (!buildConfiguration) {
            throw new Error('webpack configuration should not be null');
        }
        this.compiler = webpack(buildConfiguration);
        if (ifs) {
            this.compiler.inputFileSystem = ifs;
        }
        if (ofs) {
            this.compiler.outputFileSystem = ofs;
        }
        if (wfs) {
            this.compiler.watchFileSystem = wfs;
        }

        // Set ghost files
        const volume = this.getGhostFiles(opts).reduce((acc, ghostFile) => {
            return {
                ...acc,
                ...ghostFile.provide(opts.cwd),
            };
        }, {});

        let _memfs: memfs.IFs;
        let _ufs: IUnionFs;

        if (Object.keys(volume).length > 0) {
            _memfs = memfs.createFsFromVolume(
                memfs.Volume.fromJSON(volume, opts.cwd)
            );

            _ufs = ufs
                .use(
                    _memfs as any
                )
                .use(fs);
            this.compiler.inputFileSystem = _ufs;
        }

        this.compiler.hooks.invalid.tap('invalid', () => {
            console.clear();
            console.log('Compiling...');
        });

        this.initCompiler(opts);

        if (opts.watchMode === true) {
            this.watching = this.compiler.watch({  }, this.handler.bind(this));
        } else {
            this.compiler.run(this.handler.bind(this));
        }
    }

    /**
     * Teardown logic
     * @return {Promise}
     */
    teardown() {
        return new Promise((resolve, reject) => {
            this.removeAllListeners('success');
            this.removeAllListeners('warning');
            this.removeAllListeners('error');
            if (this.watching) {
                this.watching.close((err: any, result: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Attaches a monitor that can be used to listen to events
     * @param {BuilderMonitor} mon
     */
    attachMonitor(mon: BuilderMonitor) {
        this.monitor = mon;
    }

    /**
     * Gets input ghost files
     * @param {ConfigurationOptions} opts
     * @return {GhostFileActions[]}
     */
    getGhostFiles(opts: ConfigurationOptions): GhostFileActions[] {
        return [];
    }

    /**
     * Supported events
     * @return {string[]}
     */
    eventNames(): string[] {
        return ['success', 'warning', 'error'];
    }

    /**
     * Gets configuration
     * @param {ConfigurationOptions} opts
     * @return {Configuration}
     */
    getConfiguration(opts: ConfigurationOptions): Configuration {
        return null;
    }

    /**
     * Gets stylesheet test expression
     * @return {RegExp}
     */
    getStyleTestExp(): RegExp {
        return /\.(scss|css|sass)$/i;
    }

    /**
     * Gets LESS stylesheet test expression
     * @return {RegExp}
     */
    getLESSStyleTestExp(): RegExp {
        return /\.less$/i;
    }

    /**
     * Create alias mapping with peer dependencies
     * @param {string[]} dependencies
     * @param {string=} cwd Defaults to process.cwd()
     * @return {any}
     */
    mapPeerDependencies(
        dependencies: string[],
        cwd?: string
    ): {
        [key: string]: string;
    } {
        return dependencies.reduce((acc, dependency) => {
            cwd = cwd || process.cwd();
            let peerNodeModulesPath = path.resolve(cwd, 'node_modules', dependency);
            if (!fs.existsSync(peerNodeModulesPath)) {
                cwd = process.cwd();
                peerNodeModulesPath = path.resolve(cwd, 'node_modules', dependency);
            }
            return {
                [dependency]: peerNodeModulesPath,
                ...acc,
            };
        }, {});
    }

    /**
     * Generate file from template / retreives optional file
     * @param {string} cwd Current Working Directory
     * @param {string} relativePath Relative path of the file from project root
     * @param {string} ejsFilePath Template file path
     * @param {object=} data (Optional) template render options
     * @return {string} Optional file from project dir / template output
     */
    getOptionalFile(
        cwd: string,
        relativePath: string,
        ejsFilePath: string,
        data?: any
    ): string {
        const optionalFile: string = path.join(cwd, relativePath);
        if (fs.existsSync(optionalFile)) {
            // Output read file from projects dir
            return fs.readFileSync(optionalFile, 'utf-8');
        } else {
            if (fs.existsSync(ejsFilePath)) {
                // Read template file
                const template = fs.readFileSync(ejsFilePath, 'utf-8');
                return ejs.render(template, data);
            }
            // eslint-disable-next-line max-len
            throw new Error(
                'Failed to compile replacement file. This indicates an error with Ark Build System, you may create an issue for this on GitHub.'
            );
        }
    }

    /**
     * Invokes monitor if one's attached
     * @param {Error} err
     * @param {Stats} result
     */
    private invokeMonitor(err?: Error, result?: Stats) {
        this.monitor && this.monitor(err, result);
    }

    /**
     * Handler
     * @param {Error} err
     * @param {Stats} result
     */
    private handler(err?: Error, result?: Stats): void {
        this.invokeMonitor(err, result);
    }
}
