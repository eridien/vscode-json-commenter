import vscode from 'vscode';
import * as utils from './utils';

 export async function drawBox(editorIn: vscode.TextEditor | null,
                               startLine: number, lineCount: number, 
                               indent: number = 4, width: number = 40) {
  let editor: vscode.TextEditor | null = null;
  if (editorIn) { editor = editorIn; }
  editor ??= vscode.window.activeTextEditor ?? null;
  if (!editor) { throw new Error('No active editor found.'); }
  const document = editor.document;

  let edit = new vscode.WorkspaceEdit();

  const addLineToDocument = (lineNumber: number, text: string) => {
    const position = new vscode.Position(lineNumber, 0);
    edit.insert(document.uri, position, text + '\n');
  };

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  edit.delete(document.uri, fullRange);

  const fileStart    = `{`;
  const fileEnd      = `}`;
  let invisKeyValNum = 0;
  
  function oddEven(lineNum:number, lastLine:number) {

    function invisNum(numLft:number, numRgt:number) {
      const invisStr = utils.numberToInvBase4(numLft) + 
                       utils.numberToInvBase4(numRgt);
      console.log(utils.invBase4ToStr(invisStr));
      return invisStr;
    }

    let indentStr      = ' '.repeat(indent);
    let leftInvisChar  = '';
    let middleStr      = ' '.repeat(width);
    let rightInvisChar = '';
    let endStr         = '';
    if(lineNum !== lastLine) {
      if(lineNum % 2 === 0) {
        leftInvisChar  = invisNum(2, invisKeyValNum);
        rightInvisChar = invisNum(3, invisKeyValNum);
        endStr    = ','; 
        invisKeyValNum++; 
      } else { 
        leftInvisChar  = invisNum(0, invisKeyValNum);
        rightInvisChar = invisNum(1, invisKeyValNum);
        endStr    = ':'; 
      } 
    } 
    else { 
      if(lineNum % 2 === 0) { 
        leftInvisChar  = invisNum(1, invisKeyValNum);
        rightInvisChar = invisNum(0, invisKeyValNum);
        endStr    = ''; 
      } else { 
        leftInvisChar  = invisNum(3, invisKeyValNum);
        rightInvisChar = invisNum(2, invisKeyValNum);
        endStr    = ':""';
        invisKeyValNum++;
      }
    }
    return indentStr + '"' + leftInvisChar + 
           middleStr + rightInvisChar + '"' + endStr;
  }

  let lineNumber = startLine;
  addLineToDocument(lineNumber++, fileStart);
  for (; lineNumber < lineCount+1; lineNumber++)
    addLineToDocument(lineNumber, oddEven(lineNumber, lineCount));
  addLineToDocument(lineNumber, fileEnd);

  await vscode.workspace.applyEdit(edit);
};
