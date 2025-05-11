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

  const indentStr     = ' '.repeat(indent);
  const padStr        = ' '.repeat(padding);
  const fullWidth     = width + padding*2;

  await utils.clrDoc(document);


  const setLine = async (lineNumber: number, text: string) => {
    const totalLines = document.lineCount;
    if (lineNumber >= totalLines-1) {
      const editPadding = new vscode.WorkspaceEdit();
      for (let i = totalLines; i <= lineNumber+1; i++) {
        const position = new vscode.Position(i, 0);
        editPadding.insert(document.uri, position, '\n');
      }
      await vscode.workspace.applyEdit(editPadding);
    }
    const range = document.lineAt(lineNumber).range;
    const edit  = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, text);
    await vscode.workspace.applyEdit(edit);
  };

  /**
   * Draw one line of margin, border, or body
   *
   * @param {number}   lineNum
   * @param {string}   text
   * @param {boolean} [border=false]
   * @param {boolean} [lastLine=false]
   */
  async function drawLine(lineNum:number, text:string,
                    border = false, lastLine = false) {
    text = text.replaceAll(/"/g, quoteStr);
    const end = lastLine ? '' : ',';
    let linestr = `${indentStr}"${utils.numberToInvBase4(lineNum)}":"`;
    if(border) 
      linestr += text.repeat(fullWidth/text.length + 1).slice(0, fullWidth); 
    else 
      linestr += padStr + text.slice(0, width).padEnd(width, ' ') + padStr;
    linestr += `"${end}`;
    await setLine(lineNum, linestr);
  }

  let lineNumber = startLine;
  await setLine(lineNumber++, fileStart);
  for (let i = 0; i < marginTop; i++) await setLine(lineNumber++, '');
  if(hdrLineStr) await drawLine(lineNumber++, hdrLineStr, true);
  for (let i = 0; i < lineCount; i++)
          await drawLine(lineNumber++,
             (lineNumber === 4 ? 'JSON Commenter: "Click here and start typing."'
                               : ''+lineNumber),
              false, !footerLineStr && i === lineCount-1);
  if(footerLineStr) await drawLine(lineNumber++, footerLineStr, true, true);
  for (let i = 0; i < marginBottom; i++) await setLine(lineNumber++, '');
  await setLine(lineNumber, fileEnd);
};
