import vscode      from 'vscode';
import * as box    from './box';
import * as parse  from './parse';
import { getLog }  from './utils';
const { log, start, end } = getLog('cmds');

export function test() {
  const textEditor = vscode.window.activeTextEditor;
  const document = textEditor?.document;
  if(!document) return;
  const points = parse.getPoints(document);
  for(const point of points) {
    console.log(point);
  }
}

export function toggleClick() {
  const textEditor = vscode.window.activeTextEditor;
  const document   = textEditor?.document;
  if(!document) {
    log('info', 'No active textEditor found.');
    return;
  }
  if(document.languageId !== 'json') {
    log('info', 'Not a JSON file.');
    return;
  }
  const clickPos = textEditor?.selection?.active;
  if (!clickPos) {
    log('info', 'No position selected.');
    return;
  }
  log('Click position: ', clickPos);

  const points = parse.getPoints(document);
  if (points.length === 0) {
    log('info', 'No object found to place comment in.');
    return;
  }
  if (points[0].line === -1) {
    log(points[0].side, points[0].epilog);
    return;
  }
  let tgtPoint: parse.Point | null = null;
  let foundAfterClick = false;

  for (const point of points) {
    if (point.line === clickPos.line &&
        point.character === clickPos.character) {
      tgtPoint = point;
      break;
    }
    if (!foundAfterClick) {
      if (point.line > clickPos.line ||
          (point.line === clickPos.line &&
           point.character > clickPos.character)) {
        tgtPoint = point;
        foundAfterClick = true;
        break;
      }
    }
    if (point.line < clickPos.line ||
        (point.line === clickPos.line &&
         point.character <= clickPos.character)) {
      tgtPoint = point;
    }
  }
  if (tgtPoint) {
    log('Target JSON Point:', tgtPoint);
    box.insertBox(document, tgtPoint);
  } else {
    log('No JSON point found before or after the click position.');
  }
}