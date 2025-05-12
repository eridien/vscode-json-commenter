import * as vscode from 'vscode';
import * as util from 'util';
import jsonAsty from 'json-asty';

const keyLocs: Array<any> = [];
const seen = new WeakSet();

function walkRecursive(obj: object): void {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) return;
    seen.add(obj);

    // Use a type assertion to access the `node` property
    const t = (obj as any).T || null;
    const c = (obj as any).C || null;

    if (t === 'member') keyLocs.push(c[0].L);

    // Recursively walk through all properties of the object
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        walkRecursive((obj as any)[key]);
      }
    }

    // If the object is an array, iterate through its elements
    if (Array.isArray(obj)) {
      for (const item of obj) {
        walkRecursive(item);
      }
    }
  }
}

export function parseJsonDocument(document: vscode.TextDocument): void {
  const jsonText = document.getText();
  let ast:object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
  }
  // console.log('RAW', ast);
  // console.log('DUMP:', json_asty_1.default.dump(ast, { colors: true }));
  // console.log(util.inspect(ast, { depth: null, colors: true }));

  walkRecursive(ast);

  console.log('Key Locations:', keyLocs);
}

