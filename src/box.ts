import vscode     from 'vscode';
import * as utils from './utils';

// settings
const quoteStr = "'";

//debug
const fileStart = `{`;
const fileEnd   = `}`;

export interface DrawBoxArgs {
  editor?: vscode.TextEditor | null;
  startLine: number; lineCount: number;
  indent?: number; marginTop?: number; marginBottom?: number;
  padding?: number; width?: number;
  hdrLineStr?: string; footerLineStr?: string;
}

/**
  * Draw the entire edit box
  *
  * @type {(vscode.TextEditor | null)}
  */
export async function drawBox(args: DrawBoxArgs){
  let textEditor: vscode.TextEditor | null = null;
  if (args.editor) { textEditor = args.editor; }
  textEditor ??= vscode.window.activeTextEditor ?? null;
  if (!textEditor) { throw new Error('No active textEditor found.'); }
  const document = textEditor.document;

  let { startLine, lineCount,
        indent = 4, marginTop = 1, marginBottom = 1, padding = 2, width = 60,
        hdrLineStr = '', footerLineStr = '' } = args;

  const padStr    = ' '.repeat(padding);
  const indentStr = ' '.repeat(indent);
  const fullWidth = width + padding*2;

  await utils.clrDoc(document);

  let edit = new vscode.WorkspaceEdit();

  const addLineToDocument = (lineNumber: number, text: string) => {
    const position = new vscode.Position(lineNumber, 0);
    edit.insert(document.uri, position, text + '\n');
  };

  /**
   * Draw one line of margin, border, or body
   *
   * @param {number}   lineNum
   * @param {string}   text
   * @param {boolean} [border=false]
   * @param {boolean} [lastLine=false]
   */
  function drawLine(lineNum:number, text:string,
                    border = false, lastLine = false) {
    text = text.replaceAll(/"/g, quoteStr);
    const end = lastLine ? '' : ',';
    let linestr = `${indentStr}"${utils.numberToInvBase4(lineNum)}":"`;
    if(border) 
      linestr += text.repeat(fullWidth/text.length + 1).slice(0, fullWidth); 
    else 
      linestr += padStr + text.slice(0, width).padEnd(width, ' ') + padStr;
    linestr += `"${end}`;
    addLineToDocument(lineNum, linestr);
  }

  let lineNumber = startLine;
  addLineToDocument(lineNumber++, fileStart);
  for (let i = 0; i < marginTop; i++) addLineToDocument(lineNumber++, '');
  if(hdrLineStr) drawLine(lineNumber++, hdrLineStr, true);
  for (let i = 0; i < lineCount; i++) 
          drawLine(lineNumber++, 
             (lineNumber === 4 ? 'JSON Commenter: "Click here and start typing."' 
                               : ''+lineNumber),
                   false, !footerLineStr && lineNumber === lineCount+1);
  if(footerLineStr) drawLine(lineNumber++, footerLineStr, true, true);
  for (let i = 0; i < marginBottom; i++) addLineToDocument(lineNumber++, '');
  addLineToDocument(lineNumber, fileEnd);

  await vscode.workspace.applyEdit(edit);
};
