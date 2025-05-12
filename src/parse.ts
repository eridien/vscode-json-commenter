import * as vscode from 'vscode';
import jsonAsty    from 'json-asty';
import { getLog }  from './utils';
const { log, start, end } = getLog('pars');

const keyLocs: Array<any> = [];
const seen = new WeakSet();

function walkRecursive(obj: object): void {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) return;
    seen.add(obj);

    // Use a type assertion to access the `node` property
    const t = (obj as any).T || null;
    const c = (obj as any).C || null;

    if (t === 'member') {
      const {L, C, O} = (c[0].L as any);
      keyLocs.push([L, C, O]);
    }

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

export function getJsonPoints(jsonText: string): [number, number, string][] {
  keyLocs.length = 0;
  let ast: object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error: any) {
    return [[-1, -1, error.message]];
  }
  walkRecursive(ast);
  return keyLocs;
}

