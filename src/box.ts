import vscode     from 'vscode';
import * as utils from './utils';
import { Point }  from './parse';
import { getLog }    from './utils';
const { log, start, end } = getLog('boxx');

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
    hdrLineStr: 'x',
    footerLineStr: '-',
    lineCount: 1,
  };

const indentStr = ' '.repeat(settings.indent);
const padStr    = ' '.repeat(settings.padding);
const fullWidth = settings.width + settings.padding * 2;

export async function insertBox(document: vscode.TextDocument, point: Point) { 
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const docUri        = document.uri;
  let curLine         = point.line;
  let addedComma      = false;
  let textAfterBox    = '';
  let textAfterBoxOfs = 0;
  let lastInvNumber   = -1;

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
      textAfterBox = lineText;
      textAfterBoxOfs = 0;
      // log('Deleting line: ', line.range);
      edit.delete(docUri, line.range);
    }
    else {
      if(point.side == 'left') {
        let noEol = false;
        let removePos = pointPos;
        if(lineText.slice(0, curChar).trim().length == 0) {
          removePos = new vscode.Position(curLine, 0);
          noEol = true;
        }
        textAfterBox = lineText.slice(curChar);
        textAfterBoxOfs = curChar;
        const remTextRange = new vscode.Range(
            removePos, new vscode.Position(curLine, lineText.length));    
        // log('replace rest of line: ', remTextRange);
        edit.replace(docUri, remTextRange, noEol ? '' : eol); // type 2
        if(!noEol) curLine++;
      }
      else {
        if(!point.epilog || point.epilog.indexOf(',') == -1) {
          // no comma found, add one immediately after the point
          // log('insert comma + eol: ', pointPos);
          edit.insert(docUri, pointPos, ',' + eol);
          curLine++;
          addedComma = true;
        }
        else {
          // comma found, move the point to after the epilog
          const endEpilogPos = utils.movePosToEndOfStr(pointPos, point.epilog);
          curLine = endEpilogPos.line;
          curChar = endEpilogPos.character;
          const lineText  = document.lineAt(curLine).text;
          textAfterBox    = lineText.slice(curChar);
          textAfterBoxOfs = curChar;
          const remTextRange = new vscode.Range(
                endEpilogPos, new vscode.Position(curLine, lineText.length));
          // log('replace epilog with eol: ', remTextRange);
          edit.replace(docUri, remTextRange, eol);
          curLine++;
        }
      }
    }
    await vscode.workspace.applyEdit(edit);
  }
  
  async function insertLine(lineText: string) {
    const edit   = new vscode.WorkspaceEdit();
    const bolPos = new vscode.Position(curLine++, 0);
    // log('insert text line: ', bolPos, lineText);
    edit.insert(docUri, bolPos, lineText + eol);
    await vscode.workspace.applyEdit(edit);
  };

  async function drawLine(text: string, isBorder = false, lastLine = false ) {
    text = text.replaceAll(/"/g, settings.quoteStr);
    const end = (!lastLine || !addedComma  ? ',' : '') + eol;
    let linestr = `${indentStr}"${utils.numberToInvBase4(++lastInvNumber)}":"`;
    if(isBorder) {
      text ||= '-';
      linestr += text.repeat((fullWidth / text.length) + 1).slice(0, fullWidth);
    }
    else linestr += padStr + text.slice(0, settings.width)
                                 .padEnd(settings.width, ' ') + padStr;
    await insertLine(linestr + `"${end}`);
  }

  await prepareForInsertion();
  for (let i = 0; i < settings.marginTop; i++) await insertLine(eol);
  if (settings.hdrLineStr) await drawLine(settings.hdrLineStr, true);
  let initMsg = initialMsgLong;
  if(initMsg.length > settings.width) initMsg = initialMsgMed;
  if(initMsg.length > settings.width) initMsg = initialMsgShort;
  if(initMsg.length > settings.width) initMsg = '';
  for (let i = 0; i < settings.lineCount; i++)
    await drawLine((i == 0 ? initMsg : ''), false, 
                  (!settings.footerLineStr && i === (settings.lineCount - 1)));
  if (settings.footerLineStr)
    await drawLine(settings.footerLineStr, true, true);
  for (let i = 0; i < settings.marginBottom; i++) await insertLine('');
  if (textAfterBox.trim()) {
    const edit = new vscode.WorkspaceEdit();
    const lineTxt = ' '.repeat(textAfterBoxOfs) + textAfterBox;
    await insertLine(lineTxt);
  }
}
