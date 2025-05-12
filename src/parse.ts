declare var require: any;
import vscode      from 'vscode';
import * as util from 'util';
const jsonAsty     = require('json-asty');
import { getLog }    from './utils';
const { log, start, end } = getLog('pars');

function jsonAstWalk(ast: any): [number, string][]  {
  if (typeof ast !== "object")
    return [[-2, "Invalid AST"]];
  let json = "";
  const points: [number, string][] = [];
  try {
    ast.walk((node: any, depth: number, parent: any, when: string) => {

      console.log(node);

      if (when === "downward") {
        if (node.T == "member" ) {
          console.log([json.length, when + ' member']);
        }
      
        const prolog = node.get("prolog");
        if (prolog !== undefined) {
          json += prolog;
          points.push([json.length, when + ' prolog']);
        }
        const body = node.get("body");
        if (body !== undefined) {
          json += body;
          points.push([json.length, when + ' body']);
        } else {
          const value = node.get("value");
          if (value !== undefined) {
            json += JSON.stringify(value);
            points.push([json.length, when + ' value']);
          }
        }
      } else if (when === "upward") {
        const epilog = node.get("epilog");
        if (epilog !== undefined) {
          json += epilog;
          points.push([json.length, when + ' epilog']);
        }
      }
    }, "both");
  } catch (error: any) {
    return [[-3, error.message]];
  }
  // console.log(json);
  return points;
}

export function getPoints(jsonText: string): [number, string][] {
  let ast: object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error: any) {
    return [[-1, error.message]];
  }
  return jsonAstWalk(ast);
}