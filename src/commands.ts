import vscode      from 'vscode';
import * as box    from './box';
import * as parse  from './parse';
import { getLog }  from './utils';
const { log, start, end } = getLog('cmds');

const settings = {
  beforeClickPos: true,
};

export function test() {
  const textEditor = vscode.window.activeTextEditor;
  const document = textEditor?.document;
  if(!document) return;
  const points = parse.getPoints(document);
  for(const point of points) {
    console.log(point);
  }
}

export async function openClick() {
  const textEditor = vscode.window.activeTextEditor;
  const document   = textEditor?.document;
  if(!document) {
    log('info', 'No active textEditor found.');
    return;
  }
  if(document.languageId !== 'json') {
    log('info', 'Not a json file.');
    return;
  }
  const clickPos = textEditor?.selection?.active;
  if (!clickPos) {
    log('info', 'No position selected.');
    return;
  }
  // log('Click position: ', clickPos);

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
      await box.insertBox(document, pointBeforeClick);
      return;
    }
    else if(pointAfterClick) {
      // log('No json point before click, using after:', 
      //              pointBeforeClick, clickPos);
      await box.insertBox(document, pointAfterClick);
      return;
    }
  }
  else {
    if(pointAfterClick) {
        // log('Json point after click:', pointAfterClick, clickPos);
        await box.insertBox(document, pointAfterClick);
        return;
    }
    if(pointBeforeClick) {
      // log(' No json point after click, using before:', 
      //               pointBeforeClick, clickPos);
      await box.insertBox(document, pointBeforeClick);
      return;
    }
  }
  log('err', 'Impossible: No json point before or after the click position.');
}