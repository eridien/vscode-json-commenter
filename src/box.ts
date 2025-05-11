import vscode from 'vscode';
import * as utils from './utils';

const dbgInvis = false;

export interface DrawBoxArgs {
  editor?: vscode.TextEditor | null;
  startLine:   number; lineCount:      number;
  padding:     number; indent:         number;   width: number;
  hdrLineStr?: string; footerLineStr?: string;
}

export async function drawBox(args: DrawBoxArgs){
  let textEditor: vscode.TextEditor | null = null;
  if (args.editor) { textEditor = args.editor; }
  textEditor ??= vscode.window.activeTextEditor ?? null;
  if (!textEditor) { throw new Error('No active textEditor found.'); }
  const document = textEditor.document;

  let { padding, startLine, lineCount, indent = 4, width = 40,
        hdrLineStr = '', footerLineStr = '' } = args;

  const delEdit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  delEdit.delete(document.uri, fullRange);
  await vscode.workspace.applyEdit(delEdit);

  let edit = new vscode.WorkspaceEdit();

  const addLineToDocument = (lineNumber: number, text: string) => {
    const position = new vscode.Position(lineNumber, 0);
    edit.insert(document.uri, position, text + '\n');
  };

  let invisKeyValNum = 0;

  function drawLine(lineNum:number, lastLine = false,
                    text = 'JSON Commenter: Click here to start editing.JSON',
                    hdrLineStr = '', footerLineStr = '') {

     // footerLineStr.repeat((width + padding*2)/footerLineStr.length + 1);

    function invisNum(numLft:number, numRgt:number) {
      const invisStr = utils.numberToInvBase4(numLft) + 
                       utils.numberToInvBase4(numRgt);
      if(dbgInvis) return utils.invBase4ToStr(invisStr);
      return invisStr;
    }
    const fullWidth    = width + (padding ? padding*2 : 0);
    let indentStr      = ' '.repeat(indent);
    let leftInvisChar  = '';
    let middleStr      = (padding === null ? '' : ' '.repeat(padding)) +
                             text.slice(0, width).padEnd(fullWidth, ' ') +
                         (padding === null ? '' : ' '.repeat(padding));
    let rightInvisChar = '';
    let endStr         = '';
    if(!lastLine) {
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
    addLineToDocument(lineNum, indentStr + '"' + leftInvisChar + 
                               middleStr +      rightInvisChar + '"' + endStr);
  }

  const fileStart    = `{`;
  const fileEnd      = `}`;

  let lineNumber = startLine;
  addLineToDocument(lineNumber++, fileStart);
  if(hdrLineStr !== '') {
    const header = hdrLineStr.repeat(
                     (width + padding*2)/hdrLineStr.length + 1);
    drawLine(lineNumber++, false, header, true);
  }
  for (; lineNumber < lineCount+2; lineNumber++)
    drawLine(lineNumber, footerLineStr === '' && lineNumber === lineCount+1);
  if(footerLineStr !== '') {
    drawLine(lineNumber++, true, footerLineStr, true);
  }
  addLineToDocument(lineNumber, fileEnd);

  await vscode.workspace.applyEdit(edit);
};
