declare var require: any;
import vscode from 'vscode';
const jsonAsty = require('json-asty');
import * as utils from './utils';
const { log, start, end } = utils.getLog('pars');

export interface Point {
  side: string;      
  line: number;      
  character: number; 
  epilog: string; 
}

function stripTrailingComments(text: string, eol: string): string {
  return text.split(/\r?\n/).map(line => {
    let inString = false;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      if (char === '\\' && !escaped) {
        escaped = true;
      } else {
        escaped = false;
      }
      if (!inString && char === '/' && line[i + 1] === '/') {
        return line.slice(0, i);
      }
    }
    return line;
  }).join(eol);
}

export function getPoints(document: vscode.TextDocument): Point[] {
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const jsonText     = stripTrailingComments(document.getText(), eol);
  const jsonLines    = jsonText.split(/\r?\n/);
  const linesInBlock = [] as number[];
  jsonLines.forEach((line, lineNum) => {
    if(utils.invChrRegEx.test(line)) linesInBlock.push(lineNum);
  });
  let left = true;
  function jsonAstWalk(ast: any): Point[]  {
    if (typeof ast !== "object")
      return [{side: 'err', line: -1, character: 0, epilog: "Invalid AST"}];
    let json = "";
    const points: Point[] = [];
    let lastDepth = 0;
    try {
      ast.walk((node: any, depth: number, parent: any, when: string) => {
        // console.log('node', {node, depth, when});
        if(depth > lastDepth) left = true;
        if(depth < lastDepth) left = false;
        lastDepth = depth;

        if(node.T === "object" && when === 'upward') {
          if(Array.isArray(node.C) && node.C.length === 0) {
            // log('Empty object', node, when, json.length);
            if(!linesInBlock.includes(node.L.L))
              points.push({side: 'both', line: node.L.L-1, 
                           character: node.L.C, epilog:  node.get("epilog")});
          }
          else {
            if(node.A.epilog.indexOf('}') !== -1) {
              //log('upward object with } in epilog', node, when, json.length);
              let pos = document.positionAt(json.length);
              pos = utils.movePosToAfterPrevChar(document, pos);
              if(!linesInBlock.includes(node.L.L))
                points.push({side: 'right', line: pos.line,
                        character: pos.character, epilog: node.get("epilog")});
              left = true;
            }
          }
        }

        if(node.T === "member") {
          let pos = document.positionAt(json.length);
          pos = utils.movePosToAfterPrevChar(document, pos);
          if(left) {
            if(!linesInBlock.includes(pos.line)) 
              points.push({side: 'left', line: pos.line, 
                           character: pos.character, epilog: ''});
            left = false;
          } 
          else {
            if(!linesInBlock.includes(pos.line)) 
              points.push({side: 'right', line: pos.line, 
                character: pos.character, epilog: node.get("epilog")});
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
            json += epilog;
          }
        }
      }, "both");
    } catch (error: any) {
      return [{side: 'err', line: -1, character: 0, epilog: error.message}];
    }
    return points;
  }

  let ast: object;
  try {
    ast = jsonAsty.parse(jsonText);
  } catch (error: any) {
    return [{side: 'infoerr', line: -1, character: 0, epilog: error.message}];
  }
  return jsonAstWalk(ast);
}