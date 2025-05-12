import vscode          from 'vscode';
import * as box        from './box';
import {getJsonPoints} from './parse';
import { getLog }  from './utils';
const { log, start, end } = getLog('cmds');

export async function test() {
  const textEditor = vscode.window.activeTextEditor;
  const document = textEditor?.document;
  if(!document) return;
  const jsonPoints = getJsonPoints(document.getText());
}

export async function click() {
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
  const jsonPoints = getJsonPoints(text);
  if (jsonPoints[0][0] === -1) {
    log('info', jsonPoints[0][2]);
    return;
  }
  if (jsonPoints.length === 0) {
    log('info', 'No object found to place comment in.');
    return;
  }

  let tgtPoint: vscode.Position | null = null;
  let foundAfterClick = false;

  for (const jsonPoint of jsonPoints) {
    const [line, char] = jsonPoint;
    const jsonPos = new vscode.Position(line - 1, char - 1);
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
