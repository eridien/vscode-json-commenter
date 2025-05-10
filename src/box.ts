import vscode from 'vscode';
import * as utils from './utils';

const invBase4 = utils.numberToInvBase4;

let editor: vscode.TextEditor;
let edit  : vscode.WorkspaceEdit;

export const addLineToDocument = (lineNumber: number, text: string) => {
  const position = new vscode.Position(lineNumber, 0);
  edit.insert(editor.document.uri, position, text + '\n');
};

export const addLinesToDocument = async (lines: { lineNumber: number; text: string }[]) => {
  for (const { lineNumber, text } of lines) {
    const position = new vscode.Position(lineNumber, 0);
    edit.insert(editor.document.uri, position, text + '\n');
  }
};

 export async function drawBox(editorIn: vscode.TextEditor | null,
                               startLine: number, lineCount: number, 
                               indent: number = 4, width: number = 40) {
  if (editorIn) { editor = editorIn; }
  else if (!editor) { editor = vscode.window.activeTextEditor || editor; }
  if (!editor) {
    throw new Error('No active editor found.');
  }
  edit = new vscode.WorkspaceEdit();

  const document = editor.document;
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  edit.delete(document.uri, fullRange);

  const fileStart = `{`;
  function oddEven(lineNum:number, lastLine:number) {
    let resStr = `${' '.repeat(indent)}"${
                    invBase4(lineNum) + ' '.repeat(width)}"`;
    if(lineNum !== lastLine) {
      if(lineNum % 2 === 0) resStr += `,`;
      else                  resStr += `:`;
    }
    else {
      if(lineNum % 2 === 0) resStr += ``;
      else                  resStr += `:""`;
    }
    return resStr;
  }
  const fileEnd = `}`;

  let lineNumber = startLine;
  addLineToDocument(lineNumber++, fileStart);
  for (; lineNumber < lineCount+1; lineNumber++)
    addLineToDocument(lineNumber, oddEven(lineNumber, lineCount));
  addLineToDocument(lineNumber, fileEnd);

  await vscode.workspace.applyEdit(edit);
};
