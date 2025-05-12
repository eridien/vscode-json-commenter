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

export function click() {
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

  const activePos = textEditor?.selection?.active;
  if (!activePos) {
    log('info', 'No position selected.');
    return;
  }
  const clickPos = new vscode.Position(
                        activePos.line + 1, activePos.character + 1);
  log('Click position: ', clickPos);

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

  let closestJsonPos: vscode.Position | null = null;
  let minDistance = Infinity;

  for (const jsonPoint of jsonPoints) {
    const [line, char] = jsonPoint;
    const jsonPos = new vscode.Position(line, char);
    const distance = Math.abs(clickPos.line - jsonPos.line) * 1000 +
                     Math.abs(clickPos.character - jsonPos.character);
    if (distance < minDistance) {
      minDistance = distance;
      closestJsonPos = jsonPos;
    }
  }
  if (closestJsonPos) {
    log('Closest JSON Position:', closestJsonPos);
  } else {
    log('No JSON position found close to the click position.');
  }

  // log('jsonPoints:', jsonPoints);

	// box.drawBox({ startLine: 0, lineCount: 3, 
  //               hdrLineStr: '-', footerLineStr: '-' });

}
/*
Selection: {
  "start": {
    "line": 10,
    "character": 15
  },
  "end": {
    "line": 10,
    "character": 15
  },
  "active": {
    "line": 10,
    "character": 15
  },
  "anchor": {
    "line": 10,
    "character": 15
  }
}
*/