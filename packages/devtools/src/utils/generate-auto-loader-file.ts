import fs from 'fs-extra';
import Case from 'case';
import glob from 'fast-glob';
import path from 'path';
import { extractBackendModuleId } from './backend-module-extractor';

function* infinite() {
    let index = 0;
    let timestamp = (new Date()).valueOf();

    const g = () => `${index}`;

    while (true) {
        index++;

        yield g();
    }

    return g();
}

export const generator = infinite();

export function generateAutoloaderFile(cwd: string, target: 'frontend' | 'backend') {
    let lazyLoadingEnabled = target === 'frontend';
    let importExpressions: string = '';
    let registrationExpressions: string = '';

    const arkJSONPath = path.join(cwd, 'src', 'ark.json');
    const arkJSON: any = JSON.parse(fs.readFileSync(arkJSONPath, 'utf-8'));
    if (Array.isArray(arkJSON.routes)) {
        const importables = arkJSON.routes.map((route) => {
            return {
                path: route.path,
                type: 'view',
                pageId: route?.pageId || null,
                filePath: `./${path.relative(path.join(cwd, 'src'), path.join(cwd, 'src', route.view))}`,
                fileId: Case.pascal(route.view)
            }
        });

        // Load applets
        if (fs.existsSync(path.join(cwd, 'src', 'features'))) {
            const dirs = fs.readdirSync(path.join(cwd, 'src', 'features'), { withFileTypes: true }).filter((f) => f.isDirectory()).map((f) => f.name);
            for (const feature of dirs) {
                const featurePath = path.join(cwd, 'src', 'features', feature);
                let config: any = null;

                try {
                    if (fs.existsSync(path.join(featurePath, 'config.json'))) {
                        config = JSON.parse(fs.readFileSync(path.join(featurePath, 'config.json'), 'utf-8'));
                    }
                } catch (e) {
                    console.error(e);
                }

                if (!config) {
                    config = {};
                }

                if (!Array.isArray(config.applets)) {
                    config.applets = [];
                }

                const applets = glob.sync(['**/**.applet.tsx'], { dot: false, cwd: featurePath });
                for (const appletFileName of applets) {
                    const relativePathToApplet = `${path.relative(path.join(cwd, 'src'), path.join(featurePath, appletFileName))}`;
                    const genricPath = path.join(path.dirname(relativePathToApplet), path.parse(path.basename(relativePathToApplet)).name);
                    const defaultLabel = path.relative('features', genricPath);
                    const appletConfig = config.applets.find((a) => {
                        return a.fileName === appletFileName
                    });
                    importables.push({
                        path: null,
                        type: 'applet',
                        featurePath: path.relative(path.join(cwd, 'src'), featurePath),
                        filePath: `./${relativePathToApplet}`,
                        fileId: Case.pascal(path.join(feature, appletFileName)),
                        resolvers: [
                            genricPath,
                            appletConfig?.alias || null
                        ].filter(Boolean),
                        mounts: (appletConfig?.mounts || []),
                        genricPath,
                        defaultLabel,
                        appletConfig
                    })
                }
            }
        }

        const uniqueImportables = (importables as any[]).reduce((acc: any[], importable, index, items) => {
            const alreadyAdded = acc.findIndex((a) => a.fileId === importable.fileId) > -1;
            if (alreadyAdded === false) {
                acc.push(importable);
            }
            return acc;
        }, []);

        importExpressions = uniqueImportables.map((importable: any) => {
            if (lazyLoadingEnabled === true) {
                return `const ${importable.fileId} = lazy(() => import('${importable.filePath}'));`;
            }
            
            return `import ${importable.fileId} from '${importable.filePath}';`;
        }).join('\n');
        registrationExpressions = importables.map((importable: any) => {
            if (importable.type === 'view') {
                if (lazyLoadingEnabled === true) {
                    const id = generator.next().value;
                    return `
                        const ${importable.fileId}_COMP${id} = (props: any) => {
                        return (
                            <${importable.fileId} {...props} />
                        )
                        }
                
                        registerView('${importable.path}', '${importable.fileId}', attachRouteMeta(${JSON.stringify(importable)}, ${importable.fileId}_COMP${id}));
                    `;
                } else {
                    return `
                        registerView('${importable.path}', '${importable.fileId}', attachRouteMeta(${JSON.stringify(importable)}, ${importable.fileId}));
                    `;
                }
                
            } else if (importable.type === 'applet') {
                const id = generator.next().value;
                if (lazyLoadingEnabled === true) {
                    return (
                        `
                        const ${importable.fileId}_COMP${id} = (props: any) => {
                            return (
                            <${importable.fileId} {...props} />
                            )
                        }
    
                        registerApplet(${JSON.stringify(importable)}, attachAppletMeta(${JSON.stringify(importable)}, ${importable.fileId}_COMP${id}));
                        `
                    )
                } else {
                    return `
                        registerApplet(${JSON.stringify(importable)}, attachAppletMeta(${JSON.stringify(importable)}, ${importable.fileId}));
                    `;
                }
            }

            return '';
        }).join('\n');
    }

    let arkBackendImportSt: string = '';
    let backendImportExpressions: string = '';
    let backendregistrationExpressions: string = '';

    if (target === 'backend') {
        arkBackendImportSt = `import { registerBackendComponent } from '@skyslit/ark-backend'`;
        // Load all backend modules
        const entries = glob.sync(['src/**/**.server.tsx'], { dot: false, cwd });

        const backendImportables = entries.map((filePath) => {
            return {
                filePath: `./${path.relative(path.join(cwd, 'src'), path.join(cwd, filePath))}`,
                moduleVarName: Case.camel(path.relative(path.join(cwd, 'src', 'backend'), path.join(cwd, filePath))),
                moduleId: extractBackendModuleId(cwd, filePath)
            }
        });

        backendImportExpressions = backendImportables.map((importable: any) => `import ${importable.moduleVarName} from '${importable.filePath}';`).join('\n');
        backendregistrationExpressions = backendImportables.map((importable: any) => `registerBackendComponent('${importable.moduleId}', ${importable.moduleVarName});`).join('\n');
    }

    const content = `
      import React, { lazy } from 'react';
      import { registerView, registerApplet, controllerRef, attachRouteMeta, attachAppletMeta } from '@skyslit/ark-frontend';
      import './root.scss';
      import arkConfig from './ark.json';
      ${arkBackendImportSt}

      ${backendImportExpressions}
      ${importExpressions}
      
      controllerRef.arkConfig = arkConfig;
      
      export function initializeModules() {
          ${backendregistrationExpressions}
          ${registrationExpressions}
      }
    `

    return content;
}