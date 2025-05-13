declare var require: any;
import vscode      from 'vscode';
const jsonAsty     = require('json-asty');
import { getLog }    from './utils';
const { log, start, end } = getLog('pars');

export function getPoints(document: vscode.TextDocument): 
                                  [string, number, number, string][] {

  function zeroToOne(num: number): [number, number] {
    const pos = document.positionAt(num);
    return [pos.line+1, pos.character+1];
  }

  let left = true;
  function jsonAstWalk(ast: any): [string, number, number, string][]  {
    if (typeof ast !== "object")
      return [['err', 1, 0, "Invalid AST"]];
    let json = "";
    const points: [string, number, number, string][] = [];
    let lastDepth = 0;
    try {
      ast.walk((node: any, depth: number, parent: any, when: string) => {
        if(depth > lastDepth) left = true;
        if(depth < lastDepth) left = false;
        lastDepth = depth;

        if(node.T === "member") {
          if(left) {
            const [line, character] = zeroToOne(json.length);
            points.push(['L', line, character, '']);
            left = false;
          } 
          else {
            const [line, character] = zeroToOne(json.length);
            points.push(['R', line, character, node.get("epilog")]);
            left = true;
          }
        }

        if (when === "downward") {
          const prolog = node.get("prolog");
          if (prolog !== undefined) {
            json += prolog;
          }
          const body = node.get("body");
          if (body !== undefined) {
            json += body;
          } else {
            const value = node.get("value");
            if (value !== undefined) {
              json += JSON.stringify(value);
            }
          }
        } else if (when === "upward") {
          const epilog = node.get("epilog");
          if (epilog !== undefined) {
            // console.log('B',zeroToOne(json.length));
            json += epilog;
            // console.log('A',zeroToOne(json.length));
          }
        }
      }, "both");
    } catch (error: any) {
      return [['err', 2, 0, error.message]];
    }
    return points;
  }

  const jsonText = document.getText();
  let ast: object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error: any) {
    return [['infoerr', 0, 0, error.message]];
  }
  return jsonAstWalk(ast);
}