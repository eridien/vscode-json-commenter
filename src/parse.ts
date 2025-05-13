declare var require: any;
import vscode      from 'vscode';
import * as util from 'util';
const jsonAsty     = require('json-asty');
import { getLog }    from './utils';
const { log, start, end } = getLog('pars');

export function getPoints(document: vscode.TextDocument): [number, string][] {

  function zeroToOne(num: number): vscode.Position {
    const pos = document.positionAt(num);
    return new vscode.Position(pos.line+1, pos.character+1);
  }
  let left = true;
  function jsonAstWalk(ast: any): [number, string][]  {
    if (typeof ast !== "object")
      return [[-2, "Invalid AST"]];
    let json = "";
    const points: [number, string][] = [];
    let lastDepth = 0;
    try {
      ast.walk((node: any, depth: number, parent: any, when: string) => {

        let didDump = false;

        function dump(at:string) {
          const pos = document.positionAt(json.length);
          // console.log({pos, L:node.L, when,  
          //             value: node.get("value"),
          //             body: node.get("body"),
          //             plen: node.get("prolog")?.length,
          //             elen: node.get("epilog")?.length,
          //             prolog: node.get("prolog"),
          //             epilog: node.get("epilog"),
          //             T: node.T,
          //             depth,
          //             jlen: json.length,
          //             at});  
          didDump = true;
        }

        // if(node.T === "object") {
        //   console.log('O', 
        //               zeroToOne(json.length), 
        //               node.get("epilog")?.length, 
        //               node.get("epilog"));
        //   left = true;
        // }
        
        if(depth > lastDepth) left = true;
        if(depth < lastDepth) left = false;
        lastDepth = depth;

        if(node.T === "member") {
          if(left) {
            left = false;
            console.log('L', depth, zeroToOne(json.length));
          } 
          else {
            left = true;
            console.log('R', depth, 
                        zeroToOne(json.length), 
                        node.get("epilog")?.length, 
                        node.get("epilog"));
          }
        }

        if (when === "downward") {
          const prolog = node.get("prolog");
          if (prolog !== undefined) {
            json += prolog;
            dump('prolog');
          }
          const body = node.get("body");
          if (body !== undefined) {
            json += body;
            dump('body');
          } else {
            const value = node.get("value");
            if (value !== undefined) {
              json += JSON.stringify(value);
            dump('value');
            }
          }
        } else if (when === "upward") {
          const epilog = node.get("epilog");
          if (epilog !== undefined) {
            // console.log('B',zeroToOne(json.length));
            json += epilog;
            // console.log('A',zeroToOne(json.length));
            dump('epilog');
          }
        }
        if(!didDump) {
          dump('nodump');
        }
      }, "both");
    } catch (error: any) {
      return [[-3, error.message]];
    }
    // console.log(json);
    return points;
  }

  const jsonText = document.getText();
  let ast: object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error: any) {
    return [[-1, error.message]];
  }
  return jsonAstWalk(ast);
}