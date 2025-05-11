import vscode   from 'vscode';
import * as box from './box';

let chrPos = 10;

export async function test() {
  const textEditor = vscode.window.activeTextEditor;
  const document = textEditor?.document;
  if(!document) return;
  const range    = new vscode.Range(4, ++chrPos, 4, chrPos+1);
  let edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, 'x');
  await vscode.workspace.applyEdit(edit);
}
export function draw() {
	box.drawBox({ startLine: 0, lineCount: 4, 
                hdrLineStr: '-', footerLineStr: '-' });
}
