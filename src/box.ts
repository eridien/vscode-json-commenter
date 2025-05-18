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
    marginTop: 1,
    marginBottom: 1,
    padding: 2,
    width: 40,
    quoteStr: "'",
    headerStr: '-',
    footerStr: '-',
    beforeClickPos: false,
  };

const indentStr = ' '.repeat(settings.indent);
const padStr    = ' '.repeat(settings.padding);
const fullWidth = settings.width + settings.padding * 2;

// lineNum is the line where the box starts -- must be empty
// lines above and below lineNum will not be affected
/**
 * Draws a box starting on a blank line with settings for padding, 
 * margins, and content. Includes functions to insert lines, 
 * draw border lines, adjust margins, 
 * and handle additional text after the box contents.
 * @export
 * @async
 * @param {vscode.TextDocument} document 
 * @param {number} lineNum 
 * @param {string[]} textLines 
 * @param {boolean} [addComma=true] 
 * @param {string} [textAfter=''] 
 * @param {number} [textAfterOfs=0] 
 * @returns {*} Asynchronous function
 */
export async function drawBox( document: vscode.TextDocument, lineNum: number, 
                               textLines: string[], addComma = true, 
                               textAfter = '', textAfterOfs = 0) {
  const docUri = document.uri;
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  utils.initIdNumber(document);

  /**
   * Async function to insert a line of text 
   * at a specified line number in a document.
   * @async
   * @param {number} lineNum 
   * @param {string} [lineText=''] 
   * @param {boolean} [noEol=false] 
   * @returns {unknown} Inserts a new line at the specified line
   */
  async function insertLine(lineNum: number, lineText = '', noEol = false) {
    const wsEdit = new vscode.WorkspaceEdit();
    const bolPos = new vscode.Position(lineNum, 0);
    wsEdit.insert(docUri, bolPos, lineText + (noEol ? '' : eol));
    await vscode.workspace.applyEdit(wsEdit);
    return lineNum + 1;
  };

  /**
   * Async function to draw a line with customizable properties like
   * line number, border, last line indicator, text, comma, and end of line.
   *
   * @async
   * @param {number} lineNum 
   * @param {boolean} [isBorder=false] 
   * @param {boolean} [lastLine=false] 
   * @param {string} [text=''] 
   * @param {boolean} [addComma=true] 
   * @param {boolean} [noEol=false] 
   * @returns {unknown} A function that draws a line in a specified format with optional parameters for customizing the line
   */
  async function drawLine(lineNum: number, isBorder = false, lastLine = false,
                          text = '', addComma = true, noEol = false) {
    let idStr      = utils.getIdStr();
    let typeStr    = utils.num2inv((isBorder ? 2 : 0) + (lastLine ? 1 : 0));
    let paddingStr = utils.num2inv(settings.padding);
    if(DBG_IDSTR) {
      idStr      = utils.invBase4ToVisStr(idStr);
      typeStr    = utils.invBase4ToVisStr(typeStr);
      paddingStr = utils.invBase4ToVisStr(paddingStr);
    }
    let linestr = `${indentStr}"${idStr + typeStr + paddingStr}":"`;
    if(isBorder) {
      text ||= '-';
      linestr += text.repeat((fullWidth / text.length) + 1).slice(0, fullWidth);
    }
    else linestr += padStr + 
         text.slice(0, settings.width).padEnd(settings.width, ' ') + padStr;   
    return await insertLine(lineNum, linestr + '"' 
                         + (addComma ? ',' : ''), noEol);
  }

  /**
   * A function that adjusts the margin by a specified number of lines
   * either above or below a given line number.
   *
   * @param {number} lineNum 
   * @param {number} marginLines 
   * @param {boolean} above 
   * @returns {number}
   */
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

  ///////////////// body of addbox /////////////////
  const mgnAbove = adjMargin(lineNum, settings.marginTop, true);
  for (let i = 0; i < mgnAbove; i++) lineNum = await insertLine(lineNum);
  if (settings.headerStr) 
       lineNum = await drawLine(lineNum, true, false, settings.headerStr, true);
  if (textLines.length == 0) {
    let initMsg = initialMsgLong;
    if(initMsg.length > settings.width) initMsg = initialMsgMed;
    if(initMsg.length > settings.width) initMsg = initialMsgShort;
    if(initMsg.length > settings.width) initMsg = '';
    textLines = [initMsg];
  }
  for (const [i, textLine] of textLines.entries()) {
    const lastLine = (i == textLines.length - 1 && !settings.footerStr);
    lineNum = await drawLine(lineNum, false, lastLine,
                             textLine, (lastLine ? addComma : true), lastLine);
  }
  if (settings.footerStr) lineNum = await drawLine(
                      lineNum, true, true, settings.footerStr, addComma);
  const haveTextAfter = (textAfter.trim().length > 0);
  let mgnBelow = settings.marginBottom;
  if(!haveTextAfter) mgnBelow = adjMargin(lineNum, mgnBelow, false)-1;
  for (let i = 0; i < mgnBelow; i++) lineNum = await insertLine(lineNum, '');
  if (haveTextAfter)
         await insertLine(lineNum, ' '.repeat(textAfterOfs) + textAfter, true);
}

/**
 * A function that inserts a box at a specific point 
 * @export
 * @param {vscode.TextDocument} document 
 * @param {Point} point 
 */
export async function insertBox(document: vscode.TextDocument, point: Point) { 
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  const docUri      = document.uri;
  let lineNum       = point.line;
  let addedComma    = false;
  let textAfter     = '';
  let textAfterOfs  = 0;

  /**
   * Async function that prepares a document for insertion 
   based on the current character position and the context of the point. 
   Handles various scenarios including deletion, insertion of commas, 
   and moving the point within the document.
   * @async
   * @returns {*} 
   */
  async function prepareForInsertion() {
    let   curChar  = point.character;
    const pointPos = new vscode.Position(lineNum, curChar);
    const line     = document.lineAt(lineNum);
    const lineText = line.text;
    const wsEdit   = new vscode.WorkspaceEdit();

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
          removePos = new vscode.Position(lineNum, 0);
          noEol = true;
        }
        textAfter = lineText.slice(curChar);
        textAfterOfs = curChar;
        const remTextRange = new vscode.Range(
            removePos, new vscode.Position(lineNum, lineText.length));    
        wsEdit.replace(docUri, remTextRange, noEol ? '' : eol); // type 2
        if(!noEol) lineNum++;
      }
      else { 
        const hasComma = (point.epilog && 
                          point.epilog.indexOf(',') != -1);
        if(point.side == 'right' && !hasComma) {
          // no comma found, add one immediately after the point
          wsEdit.insert(docUri, pointPos, ',' + eol);
          lineNum++;
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
          const remTextRange = new vscode.Range(
                 endEpilogPos, new vscode.Position(lineNum, lineText.length));
          let end = '';
          if(point.side == 'both') {
            end = eol;
            lineNum++;
          }
          wsEdit.replace(docUri, remTextRange, end);
        }
      }
    }
    await vscode.workspace.applyEdit(wsEdit);
  }
  await prepareForInsertion();
  await drawBox(document, lineNum, [], 
               !addedComma, textAfter, textAfterOfs);
}

/**
 * Function to open a command in a JSON or JSONC file 
 * based on the cursor position in the text editor.
 * @export
 * @async
 * @returns {*} 
 */
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