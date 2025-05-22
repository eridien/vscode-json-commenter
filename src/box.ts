import vscode         from 'vscode';
import * as parse     from './parse';
import type { Point } from './parse';
import * as sett      from './settings';
import * as utils     from './utils';
const { log, start, end } = utils.getLog('boxx');

const DBG_IDSTR = false; 

export const blockInitialMsg = 'Click here.';

export let settings = sett.getJsonCommenterSettings();

export function refreshSettings() {
  settings = sett.getJsonCommenterSettings();
}

export function getEditAreaDecorationType(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: settings.editingBackgroundColor,
    borderRadius: '2px',
    border: '1px solid #cccccc',
    isWholeLine: false,
  });
}

const indentStr = ' '.repeat(settings.indent);
const padStr    = ' '.repeat(settings.padding);

export async function drawBox(params: any)  {
  let fullWidth = settings.maxWidth;
  let { document, lineNumber: startLine, curChar: startChar, 
        textLines, addComma = true, 
        textAfter = '', textAfterOfs = 0, noMgn = false, wsEdit } = params;
  const doApplyEdit = (wsEdit === undefined);
  wsEdit ??= new vscode.WorkspaceEdit();
  const docUri = document.uri;
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  utils.initIdNumber(document);
  const startLinePos = new vscode.Position(startLine, startChar);
  fullWidth = settings.minWidth;
  for(const line of textLines) {
    if(line.length > fullWidth) fullWidth = line.length;
  }

  function insertLine(params: any) {
    const {lineText = '', noEol = false} = params;
    wsEdit.insert(docUri, startLinePos, lineText + (noEol ? '' : eol));
  }

  function drawLine(params: any) {
    let { isBorder = false, lastLine = false, text = '',
          addComma  = true, noEol = false, hasBreak = false } = params;
    let idStr       = utils.getIdStr();
    let hasBreakStr = utils.num2inv( hasBreak ? 1 : 0);
    let typeStr     = utils.num2inv((isBorder ? 2 : 0) + (lastLine ? 1 : 0));
    let paddingStr  = utils.num2inv(settings.padding);
    if(DBG_IDSTR) {
      idStr       = utils.invBase4ToVisStr(idStr);
      hasBreakStr = utils.invBase4ToVisStr(hasBreakStr);
      typeStr     = utils.invBase4ToVisStr(typeStr);
      paddingStr  = utils.invBase4ToVisStr(paddingStr);
    }
    text = text.replace(/\r\n.*/, '');
    let linestr = `${indentStr}"${idStr + hasBreakStr + 
                                 typeStr + paddingStr}":"`;
    if(isBorder) {
      text ||= '-';
      const width = fullWidth + settings.padding * 2;
      linestr    += text.repeat((width / text.length) + 1)
                        .slice(0, width);
    }
    else linestr += padStr + 
         text.slice(0, fullWidth)
             .padEnd(fullWidth, ' ') + padStr;
    return insertLine({lineText: linestr + '"' + 
                      (addComma ? ',' : ''), noEol });
  }

  function adjMargin(params: any): number {
    const {marginLines, above } = params;
    const dir = above ? -1 : 1;
    let count = 1;
    let mLines = marginLines;
    while(mLines > 0) {
      const lineToChk = startLine + dir * count;
      if((lineToChk < 0 || lineToChk >= document.lineCount) ||
          document.lineAt(lineToChk).text.trim().length != 0) break;
      count++;
      mLines--;
    }
    return mLines;
  }

  ///////////////// body of addbox /////////////////
  if(!noMgn) {
    const mgnAbove = adjMargin({ marginLines: settings.marginTop, above: true });
    for (let i = 0; i < mgnAbove+1; i++) insertLine({ });
  }
  if (settings.headerString) 
       drawLine({ isBorder: true, lastLine: false, 
                                  text: settings.headerString, addComma: true });
  if (textLines.length == 0) textLines = [blockInitialMsg];
  for (let [i, textLine] of textLines.entries()) {
    const lastLine = (i == textLines.length - 1 && !settings.footerString);
    const parts = textLine.split('\x00');
    textLine = parts[0];
    const hasBreak = (parts.length > 1);
    drawLine({ isBorder: false, lastLine, text: textLine, hasBreak,
               addComma: (lastLine ? addComma : true), noEol: lastLine });
  }
  if (settings.footerString) drawLine( { isBorder: true, lastLine: true, 
                                        text: settings.footerString, addComma });
  const haveTextAfter = (textAfter.trim().length > 0);
  if(!noMgn) {
    let mgnBelow = settings.marginBottom;
    if(!haveTextAfter) 
        mgnBelow = adjMargin({ marginLines: mgnBelow, above: false })-1;
    for (let i = 0; i < mgnBelow; i++) insertLine({});
  }
  if (haveTextAfter) insertLine(
     { lineText: ' '.repeat(textAfterOfs) + textAfter, noEol: true });
  if(doApplyEdit) await vscode.workspace.applyEdit(wsEdit);
}
 
export async function insertNewBox(
                         document: vscode.TextDocument, point: Point) {
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const docUri     = document.uri;
  let lineNum      = point.line;
  let curChar      = point.character;
  let addedComma   = false;
  let textAfter    = '';
  let textAfterOfs = 0;
  const wsEdit     = new vscode.WorkspaceEdit();

  function prepareForInsertion(point: Point) {
    const pointPos = new vscode.Position(lineNum, curChar);
    const line     = document.lineAt(lineNum);
    const lineText = line.text;
    if (curChar == 0) {
      textAfter = lineText;
      textAfterOfs = 0;
    }
    else {
      if(point.side == 'left' || point.side == 'both') {
        textAfter = lineText.slice(curChar);
        textAfterOfs = curChar;
        const remTextRange = new vscode.Range(
                      pointPos, new vscode.Position(lineNum, lineText.length));
        wsEdit.delete(docUri, remTextRange);
      }
      else {
        const hasComma = (point.epilog && 
                          point.epilog.indexOf(',') != -1);
        if(point.side == 'right' && !hasComma) {
          wsEdit.insert(docUri, pointPos, ',');
          addedComma = true;
        }
        else {
          // comma found, move the point to after the epilog
          const endEpilogPos = utils.movePosToEndOfStr(pointPos, point.epilog);
          lineNum = endEpilogPos.line;
          curChar = endEpilogPos.character;
          const lineText = document.lineAt(lineNum).text;
          textAfter      = lineText.slice(curChar);
          textAfterOfs   = curChar;
          let startPos = new vscode.Position(lineNum, curChar);
          const endPos = new vscode.Position(lineNum, lineText.length);
          if(lineText.slice(0, curChar).trim().length == 0) {
            if(lineNum == 0) startPos = new vscode.Position(0, 0);
            else {
              lineNum--;
              curChar = document.lineAt(lineNum).text.length;
              startPos = new vscode.Position(lineNum, curChar);
            }
          }
          const remTextRange = new vscode.Range(startPos, endPos);
          wsEdit.delete(docUri, remTextRange);
        }
      }
    }
  }

  ///////////////// body of insertNewBox /////////////////
  prepareForInsertion(point);
  await drawBox({
    document, lineNumber: lineNum, curChar, textLines: [],
    addComma: !addedComma, textAfter, textAfterOfs, wsEdit
  });
  await vscode.workspace.applyEdit(wsEdit);
}

export async function openCommand() {
  const textEditor = vscode.window.activeTextEditor;
  const document   = textEditor?.document;
  if(!document) {
    log('info', 'No active textEditor found.');
    return;
  }
  const insertPosition = textEditor?.selection?.active;
  if (!insertPosition) {
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
  let pointBeforeClick: any = null;
  let pointAfterClick : any = null;

  for (const point of points) {
    if (point.line > insertPosition.line ||
        (point.line === insertPosition.line &&
          point.character >= insertPosition.character)) {
      pointAfterClick = point;
      break;
    }
    if (point.line < insertPosition.line ||
        (point.line === insertPosition.line &&
         point.character <= insertPosition.character)) {
      pointBeforeClick = point;
    }
  }
  
  if(settings.insertPosition == 'above') {
    if(pointBeforeClick) {
      // log('json Point before click:', pointBeforeClick, insertPosition);
      await insertNewBox(document, pointBeforeClick);
      return;
    }
    else if(pointAfterClick) {
      // log('No json point before click, using after:', 
      //              pointBeforeClick, insertPosition);
      await insertNewBox(document, pointAfterClick);
      return;
    }
  }
  else {
    if(pointAfterClick) {
        // log('Json point after click:', pointAfterClick, insertPosition);
        await insertNewBox(document, pointAfterClick);
        return;
    }
    if(pointBeforeClick) {
      // log(' No json point after click, using before:', 
      //               pointBeforeClick, insertPosition);
      await insertNewBox(document, pointBeforeClick);
      return;
    }
  }
}