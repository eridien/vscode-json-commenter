import vscode     from 'vscode';
import * as utils from './utils';
import { Point }  from './parse';
import { getLog }    from './utils';
const { log, start, end } = getLog('boxx');

const initialMsgLong  = 'JSON Commenter: Click here and start typing.';
const initialMsgMed   = 'Click here and start typing.';
const initialMsgShort = 'Click here.';

const settings = {
    indentWidth:  4,
    paddingWidth: 2,
    textWidth:   40,
    marginTop:    2,
    marginBottom: 2,
    quoteStr:   "'",
    headerStr:  '-',
    footerStr:  '-',
    lineCount:    1,
  };

const indentWidth  = settings.indentWidth;
const paddingWidth = Math.min(63, settings.paddingWidth);
const textWidth    = settings.textWidth;
const fullWidth    = textWidth + paddingWidth * 2;
const indentStr    = ' '.repeat(indentWidth);
const padStr       = ' '.repeat(paddingWidth);

export async function insertBox(document: vscode.TextDocument, point: Point) { 
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const docUri      = document.uri;
  let curLine       = point.line;
  let addedComma    = false;
  let textAfter     = '';
  let textAfterOfs  = 0;
  let lastInvNumber = -1;

  const docText = document.getText();
  const matches = [...docText.matchAll(/"([\u200B\u200C\u200D\u2060]+)":/g)];
  for(const match of matches) {
    const num = utils.invBase4ToNumber(match[1]);
    lastInvNumber = Math.max(num, lastInvNumber);
  }

  async function prepareForInsertion() {
    let curChar    = point.character;
    const pointPos = new vscode.Position(curLine, curChar);
    const line     = document.lineAt(curLine);
    const lineText = line.text;
    const edit     = new vscode.WorkspaceEdit();

    if (curChar == 0) {
      textAfter = lineText;
      textAfterOfs = 0;
      edit.delete(docUri, line.range);
    }
    else {
      if(point.side == 'left' || point.side == 'both') {
        let noEol = false;
        let removePos = pointPos;
        if(lineText.slice(0, curChar).trim().length == 0) {
          removePos = new vscode.Position(curLine, 0);
          noEol = true;
        }
        textAfter = lineText.slice(curChar);
        textAfterOfs = curChar;
        const remTextRange = new vscode.Range(
            removePos, new vscode.Position(curLine, lineText.length));    
        edit.replace(docUri, remTextRange, noEol ? '' : eol); // type 2
        if(!noEol) curLine++;
      }
      else { 
        const hasComma = (point.epilog && 
                                     point.epilog.indexOf(',') != -1);
        if(point.side == 'right' && !hasComma) {
          // no comma found, add one immediately after the point
          edit.insert(docUri, pointPos, ',' + eol);
          curLine++;
          addedComma = true;
        }
        else {
          // comma found, move the point to after the epilog
          const endEpilogPos = utils.movePosToEndOfStr(pointPos, point.epilog);
          curLine = endEpilogPos.line;
          curChar = endEpilogPos.character;
          // if(!/\r?\n/.test(point.epilog)) curLine++;
          const lineText = document.lineAt(curLine).text;
          textAfter      = lineText.slice(curChar);
          textAfterOfs   = curChar;
          const remTextRange = new vscode.Range(
                endEpilogPos, new vscode.Position(curLine, lineText.length));
          let end = '';
          if(point.side == 'both') {
            end = eol;
            curLine++;
          }
          edit.replace(docUri, remTextRange, end);
        }
      }
    }
    await vscode.workspace.applyEdit(edit);
  }
  
  async function insertLine(lineText: string) {
    const edit   = new vscode.WorkspaceEdit();
    const bolPos = new vscode.Position(curLine++, 0);
    edit.insert(docUri, bolPos, lineText);
    await vscode.workspace.applyEdit(edit);
  };

  let firstLine = true;

  async function drawLine(text: string, isBorder = false, lastLine = false ) {
    text = text.replaceAll(/"/g, settings.quoteStr);
    let linestr = `${indentStr}"${utils.numberToInvBase4(++lastInvNumber)}":"`;
    let lineCode = '';
    if(firstLine) lineCode += '\u200B';
    if(isBorder)  lineCode += '\u200C';
    else          lineCode += '\u200D';
    if(lastLine)  lineCode += '\u2060';
    if(isBorder) {
      text ||= '-';
      linestr += text.repeat((fullWidth / text.length) + 1).slice(0, fullWidth);
    }
    else linestr += padStr + text.slice(0, textWidth)
                                 .padEnd(textWidth, ' ') + padStr;
    const end = (!lastLine || 
                 (point.side != 'both' && !addedComma)  ? ',' : '') + eol;
    await insertLine(linestr + `${lineCode}"${end}`);
    firstLine = false;
  }

  function adjMargin(lineNum: number, 
                          marginLines: number, above: boolean): number {
    const dir = above ? -1 : 1;
    let count = 1;
    while(marginLines > 0) {
      const lineToChk = lineNum + dir * count;
      if((lineToChk < 0 || lineToChk >= document.lineCount) ||
          document.lineAt(lineToChk).text.trim().length != 0) break;
      count++;
      marginLines--;
    }
    return marginLines;
  }

  await prepareForInsertion();
  const mgnAbove = adjMargin(curLine, settings.marginTop, true);
  for (let i = 0; i < mgnAbove; i++) await insertLine(eol);
  if (settings.headerStr) await drawLine(settings.headerStr, true);
  let initMsg = initialMsgLong;
  if(initMsg.length > textWidth) initMsg = initialMsgMed;
  if(initMsg.length > textWidth) initMsg = initialMsgShort;
  if(initMsg.length > textWidth) initMsg = '';
  for (let i = 0; i < settings.lineCount; i++)
    await drawLine((i == 0 ? initMsg : ''), false, 
                (!settings.footerStr && i === (settings.lineCount - 1)));
  if (settings.footerStr) await drawLine(settings.footerStr, true, true);
  const haveTextAfter = (textAfter.trim().length > 0);
  let mgnBelow = settings.marginBottom;
  if(!haveTextAfter) mgnBelow = adjMargin(curLine, mgnBelow, false)-1;
  for (let i = 0; i < mgnBelow; i++) await insertLine(eol);
  if (haveTextAfter)
         await insertLine(' '.repeat(textAfterOfs) + textAfter);
}
