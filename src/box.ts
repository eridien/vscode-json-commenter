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
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const indentStr = ' '.repeat(settings.indent);
  const padStr    = ' '.repeat(settings.padding);
  const fullWidth = settings.width + settings.padding * 2;

  let curLine         = point.line;
  let firstLineInsert = true;
  let addedComma      = false;
  let textAfterBox    = '';

  async function insertLine(newLineText: string) {
    const edit = new vscode.WorkspaceEdit();
    if (firstLineInsert) {
      firstLineInsert = false;
      let curChar    = point.character;
      const pointPos = new vscode.Position(curLine, curChar);
      const line     = document.lineAt(curLine);
      const lineText = line.text;
      if (curChar == 0) {
        textAfterBox = lineText;
        edit.delete(document.uri, line.range);
      }
      else {
        if(point.side == 'left') {
          textAfterBox = lineText.slice(curChar);
          const remTextRange = new vscode.Range(
                     pointPos, new vscode.Position(curLine, lineText.length));
          edit.replace(document.uri, remTextRange, eol);
          curLine++;
        }
        else {
          let numCharsBeforeComma = point.epilog.indexOf(',');
          if(numCharsBeforeComma == -1) {
            // no comma found, add one immediately after the point
            edit.insert(document.uri, pointPos, ',' + eol);
            curLine++;
            addedComma = true;
          }
          else {
            // comma found, move the point to after the epilog
            const endEpilogPos = utils.movePosToEndOfStr(pointPos, point.epilog);
            curLine = endEpilogPos.line;
            curChar = endEpilogPos.character;
            const lineText = document.lineAt(curLine).text;
            textAfterBox = lineText.slice(curChar);
            const remTextRange = new vscode.Range(
                  endEpilogPos, new vscode.Position(curLine, lineText.length));
            edit.replace(document.uri, remTextRange, eol);
            curLine++;
          }
        }
      }
    }
    // after adding the line there is always an empty line after at curLine
    const bolPos = new vscode.Position(curLine++, 0);
    edit.insert(document.uri, bolPos, newLineText + eol);
    await vscode.workspace.applyEdit(edit);
  };

  let firstNewLine = true;

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

    if(firstNewLine) {
      firstNewLine = false;    
      const prevLine = lineNum;

    }

    const position = new vscode.Position(lineNum, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, position, linestr + eol);
    await vscode.workspace.applyEdit(edit);
  }

  let lineNumber = point.line;
  for (let i = 0; i < settings.marginTop; i++) await insertLine(lineNumber++, '');
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
                              await insertLine(lineNumber++, '');
}
