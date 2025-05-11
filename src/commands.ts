import vscode     from 'vscode';
import * as box   from './box';
import * as parse from './parse';

export async function test() {
  const textEditor = vscode.window.activeTextEditor;
  const document = textEditor?.document;
  if(!document) return;
  console.log(parse.parseJsonDocument(document));
}

export function draw() {
	box.drawBox({ startLine: 0, lineCount: 3, 
                hdrLineStr: '-', footerLineStr: '-' });
}
