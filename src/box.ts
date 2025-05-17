import vscode         from 'vscode';
import * as parse     from './parse';
import type { Point } from './parse';
import * as edit      from './edit';
import * as utils     from './utils';
const { log, start, end } = utils.getLog('boxx');

const DBG_IDSTR = false; 

const initialMsgLong  = 'JSON Commenter: Click here and start typing.';
const initialMsgMed   = 'Click here and start typing.';
const initialMsgShort = 'Click here.';

const settings = {
    indent: 4,
    marginTop: 2,
    marginBottom: 2,
    padding: 2,
    width: 40,
    quoteStr: "'",
    headerStr: '-',
    footerStr: '-',
    lineCount: 1,
    beforeClickPos: false,
  };

const indentStr = ' '.repeat(settings.indent);
const padStr    = ' '.repeat(settings.padding);
const fullWidth = settings.width + settings.padding * 2;

export async function insertBox(document: vscode.TextDocument, point: Point) { 
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const docUri      = document.uri;
  let curLine       = point.line;
  let addedComma    = false;
  let textAfter     = '';
  let textAfterOfs  = 0;
  let lastInvNumber = 0;

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
    const wsEdit     = new vscode.WorkspaceEdit();

    if (curChar == 0) {
      textAfter = lineText;
      textAfterOfs = 0;
      wsEdit.delete(docUri, line.range);
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
        wsEdit.replace(docUri, remTextRange, noEol ? '' : eol); // type 2
        if(!noEol) curLine++;
      }
      else { 
        const hasComma = (point.epilog && 
                                     point.epilog.indexOf(',') != -1);
        if(point.side == 'right' && !hasComma) {
          // no comma found, add one immediately after the point
          wsEdit.insert(docUri, pointPos, ',' + eol);
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
          wsEdit.replace(docUri, remTextRange, end);
        }
      }
    }
    await vscode.workspace.applyEdit(wsEdit);
  }
  
  async function insertLine(lineText: string) {
    const wsEdit   = new vscode.WorkspaceEdit();
    const bolPos = new vscode.Position(curLine++, 0);
    wsEdit.insert(docUri, bolPos, lineText);
    await vscode.workspace.applyEdit(wsEdit);
  };

  async function drawLine(text: string, isBorder = false, lastLine = false ) {
    let idStr      = utils.numberToInvBase4(++lastInvNumber, edit.ID_WIDTH);
    let typeStr    = utils.num2inv((isBorder ? 2 : 0) + (lastLine ? 1 : 0))
    let paddingStr = utils.num2inv(settings.padding);
    if(DBG_IDSTR) {
      idStr      = utils.invBase4ToVisStr(idStr);
      typeStr    = utils.invBase4ToVisStr(typeStr);
      paddingStr = utils.invBase4ToVisStr(paddingStr);
    }
    text = text.replaceAll(/"/g, settings.quoteStr);
    const end = (!lastLine ||
                 (point.side != 'both' && !addedComma)  ? ',' : '') + eol;
    let linestr = `${indentStr}"${idStr + typeStr + paddingStr}":"`;
    if(isBorder) {
      text ||= '-';
      linestr += text.repeat((fullWidth / text.length) + 1).slice(0, fullWidth);
    }
    else linestr += padStr + 
         text.slice(0, settings.width).padEnd(settings.width, ' ') + padStr;   
    await insertLine(linestr + `"${end}`);
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
  if(initMsg.length > settings.width) initMsg = initialMsgMed;
  if(initMsg.length > settings.width) initMsg = initialMsgShort;
  if(initMsg.length > settings.width) initMsg = '';
  for (let i = 0; i < settings.minLineCount; i++)
    await drawLine((i == 0 ? initMsg : ''), false, 
                (!settings.footerStr && i === (settings.minLineCount - 1)));
  if (settings.footerStr) await drawLine(settings.footerStr, true, true);
  const haveTextAfter = (textAfter.trim().length > 0);
  let mgnBelow = settings.marginBottom;
  if(!haveTextAfter) mgnBelow = adjMargin(curLine, mgnBelow, false)-1;
  for (let i = 0; i < mgnBelow; i++) await insertLine(eol);
  if (haveTextAfter)
         await insertLine(' '.repeat(textAfterOfs) + textAfter);
}

export async function openCommand() {
  const textEditor = vscode.window.activeTextEditor;
  const document   = textEditor?.document;
  if(!document) {
    log('info', 'No active textEditor found.');
    return;
  }
  if(document.languageId !== 'json' && document.languageId !== 'jsonc') {
    log('info', 'Not a json file.');
    return;
  }
  const clickPos = textEditor?.selection?.active;
  if (!clickPos) {
    log('info', 'No position selected.');
    return;
  }

  const points = parse.getPoints(document);
  if (points.length === 0) {
    log('info', 'No object found to place comment in.');
    return;
  }
  if (points[0].line === -1) {
    log(points[0].side, points[0].epilog);
    return;
  }
  let pointBeforeClick: parse.Point | null= null;
  let pointAfterClick : parse.Point | null= null;

  for (const point of points) {
    if (point.line > clickPos.line ||
        (point.line === clickPos.line &&
          point.character >= clickPos.character)) {
      pointAfterClick = point;
      break;
    }
    if (point.line < clickPos.line ||
        (point.line === clickPos.line &&
         point.character <= clickPos.character)) {
      pointBeforeClick = point;
    }
  }
  
  if(settings.beforeClickPos) {
    if(pointBeforeClick) {
      // log('json Point before click:', pointBeforeClick, clickPos);
      await insertBox(document, pointBeforeClick);
      return;
    }
    else if(pointAfterClick) {
      // log('No json point before click, using after:', 
      //              pointBeforeClick, clickPos);
      await insertBox(document, pointAfterClick);
      return;
    }
  }
  else {
    if(pointAfterClick) {
        // log('Json point after click:', pointAfterClick, clickPos);
        await insertBox(document, pointAfterClick);
        return;
    }
    if(pointBeforeClick) {
      // log(' No json point after click, using before:', 
      //               pointBeforeClick, clickPos);
      await insertBox(document, pointBeforeClick);
      return;
    }
  }
}