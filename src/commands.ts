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

export async function toggleClick() {
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
  // log('Click position: ', clickPos);

  const text = document.getText();
  const jsonPoints = parse.getPoints(document);
  // if (jsonPoints[0][0] === -1) {
  //   log('info', jsonPoints[0][1]);
  //   return;
  // }
  // if (jsonPoints[0][0] < -1) {
  //   log('err', jsonPoints[0][1]);
  //   return;
  // }
  if (jsonPoints.length === 0) {
    log('info', 'No object found to place comment in.');
    return;
  }

  let tgtPoint: vscode.Position | null = null;
  let foundAfterClick = false;

  for (const jsonPoint of jsonPoints) {
    const [line] = jsonPoint;
    const jsonPos = new vscode.Position(+line, 0);
    if(jsonPos.line === clickPos.line &&
       jsonPos.character === clickPos.character) {
      tgtPoint = jsonPos;
      break;
    }
    if (!foundAfterClick) {
      if ( jsonPos.line > clickPos.line ||
          (jsonPos.line === clickPos.line && 
           jsonPos.character >= clickPos.character) ) {
        tgtPoint = jsonPos;
        foundAfterClick = true;
        break;
      }
    }
    if ( jsonPos.line < clickPos.line ||
        (jsonPos.line === clickPos.line && 
         jsonPos.character <= clickPos.character)
    ) {
      tgtPoint = jsonPos;
    }
  }
  if (tgtPoint) {
    // log('Target JSON Position:', tgtPoint);
    const indentStr = ' '.repeat(tgtPoint.character);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, tgtPoint, `\n${indentStr}`);
    await vscode.workspace.applyEdit(edit);
    await box.openBox(document, tgtPoint.line + 1);
  } else {
    log('No JSON position found before or after the click position.');
  }
}
