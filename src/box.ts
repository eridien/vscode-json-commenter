import vscode     from 'vscode';
import * as utils from './utils';
import { Point }  from './parse';

const initialMsgLong  = 'JSON Commenter: Click here and start typing.';
const initialMsgMed   = 'Click here and start typing.';
const initialMsgShort = 'Click here.';

const settings = {
    indent: 4,
    marginTop: 1,
    marginBottom: 1,
    padding: 2,
    width: 40,
    quoteStr: "'",
    hdrLineStr: '-',
    footerLineStr: '-',
    lineCount: 1,
  };

export async function insertBox(document: vscode.TextDocument, point: Point) { 
  const indentStr = ' '.repeat(settings.indent);
  const padStr    = ' '.repeat(settings.padding);
  const fullWidth = settings.width + settings.padding * 2;

  /**
   * Insert a line in the document, adding new lines if needed.
   *
   * @async
   * @param {number} lineNumber
   * @param {string} text
   */
  const setLine = async (lineNumber: number, text: string) => {
    const totalLines = document.lineCount;
    if (lineNumber >= totalLines - 1) {
      const editPadding = new vscode.WorkspaceEdit();
      for (let i = totalLines; i <= lineNumber + 1; i++) {
        const position = new vscode.Position(i, 0);
        editPadding.insert(document.uri, position, '\n');
      }
      await vscode.workspace.applyEdit(editPadding);
    }
    const position = new vscode.Position(lineNumber, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, position, text + '\n');
    await vscode.workspace.applyEdit(edit);
  };

  /**
   * Draw one line of margin, border, or body.
   *
   * @param {number} lineNum
   * @param {string} text
   * @param {boolean} [border=false]
   * @param {boolean} [lastLine=false]
   */
  async function drawLine( lineNum: number, text: string,
                           border = false, lastLine = false ) {
    text = text.replaceAll(/"/g, settings.quoteStr);
    const end = ','; // lastLine ? '' : ',';
    let linestr = `${indentStr}"${utils.numberToInvBase4(lineNum)}":"`;
    if (border)
      linestr += text.repeat(fullWidth / text.length + 1).slice(0, fullWidth);
    else
      linestr += padStr + text.slice(0, settings.width)
                          .padEnd(settings.width, ' ') + padStr;
    linestr += `"${end}`;

    // Insert the line instead of replacing it
    const position = new vscode.Position(lineNum, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, position, linestr + '\n');
    await vscode.workspace.applyEdit(edit);
  }

  let lineNumber = point.line;
  for (let i = 0; i < settings.marginTop; i++) await setLine(lineNumber++, '');
  if (settings.hdrLineStr) await drawLine(
                                   lineNumber++, settings.hdrLineStr, true);
  let initMsg = initialMsgLong;
  if(initMsg.length > settings.width) initMsg = initialMsgMed;
  if(initMsg.length > settings.width) initMsg = initialMsgShort;
  if(initMsg.length > settings.width) initMsg = '';

  for (let i = 0; i < settings.lineCount; i++)
    await drawLine(
      lineNumber++,
        i == 0 ? 'JSON Commenter: "Click here and start typing.'
               : '' + lineNumber,
      false,
      !settings.footerLineStr && i === settings.lineCount - 1
    );
  if (settings.footerLineStr) await drawLine(
                          lineNumber++, settings.footerLineStr, true, true);
  for (let i = 0; i < settings.marginBottom; i++) 
                              await setLine(lineNumber++, '');
}
