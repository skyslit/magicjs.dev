import fs from 'fs';
import path from 'path';
import ejs from 'ejs';

export type GhostFileActions = {
  eject: (contextPath: string) => void;
  provide: (contextPath: string) => { [key: string]: string };
};

/**
 * Read EJS template
 * @param {string} templatePath
 * @return {string}
 */
function readTemplate(templatePath: string): string {
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Creates Ghost file
 * @param {string} templatePath
 * @param {string} relPath
 * @param {any=} data
 * @return {GhostFileActions}
 */
export function createGhostFile(
  templatePath: string,
  relPath: string,
  data?: any
): GhostFileActions {
  return {
    eject: (contextPath: string) => {
      const output = ejs.render(readTemplate(templatePath), data);
      const targetDirPath = path.dirname(path.join(contextPath, relPath));

      if (!fs.existsSync(targetDirPath)) {
        fs.mkdirSync(targetDirPath, { recursive: true });
      }

      fs.writeFileSync(path.join(contextPath, relPath), output);
    },
    provide: (contextPath: string) => {
      // Check if file already exists
      const targetFilePath = path.join(contextPath, relPath);
      if (fs.existsSync(targetFilePath)) {
        return {};
      } else {
        const output = ejs.render(readTemplate(templatePath), data);
        return {
          [relPath]: output,
        };
      }
    },
  };
}
