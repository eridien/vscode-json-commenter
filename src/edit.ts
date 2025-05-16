import vscode     from 'vscode';
import * as utils from './utils';
const { log, start, end } = utils.getLog('edit');

interface BoxLocation {
  startLine: number;
  endLine:   number;
  startChar: number;
  endChar:   number;
}

interface BoxLine {
  indentWidth: number;
  lineId: string;
  startChar: number;
  endChar: number;
  padWidth: number;
  text: string;
  lineType: string;
}

let editing = false;

function startEditing() {
  if (editing) return;
  editing = true;
  log('info', 'Editing started.');
}

export function stopEditing() {
  if (!editing) return;
  editing = false;
  log('info', 'Editing ended.');
}

const lineRegEx = new RegExp(`"([\\u200B\\u200C\\u200D\\u2060]+)` +
                              `([\\u200B\\u200C\\u200D\\u2060]{3})":(.*?)` +
                              `([\\u200B\\u200C\\u200D\\u2060]+)"/g`);

function ChkLine(document: vscode.TextDocument, 
                 lineNumber: number): BoxLine | null {
  const line   = document.lineAt(lineNumber);  if (!line)   return null;
  const groups = lineRegEx.exec(line.text);    if (!groups) return null;
  const [lineId, padWidthStr, fullText, lineTypeInv] = groups.slice(1);
  const padWidth    = utils.invBase4ToNumber(padWidthStr);
  const text        = fullText.slice(padWidth, -padWidth - 1);
  const indentWidth = groups.index;
  const startChar   = indentWidth + 1 + lineId.length + padWidthStr.length + 2;
  const endChar     = startChar + fullText.length + lineTypeInv.length + 1;
  const lineType    = utils.invBase4ToStr(lineTypeInv);
  return { indentWidth, lineId, startChar, endChar, padWidth, text, lineType };
}

function getBlockClicked(document: vscode.TextDocument, 
                         clickPos: vscode.Position): BoxLocation | null {
  let lineNumber = clickPos.line;
  const lineData = ChkLine(document, lineNumber);
  if( !lineData) return null;
  const { startChar, endChar, text, lineType } = lineData;
  const textLines = [text];
  let firstLineNumber = lineNumber;
  let lastLineNumber  = lineNumber;

  do{
    const lineData = ChkLine(document, lineNumber);
  } while(0);
  
  return null;
}

export function selectionChanged(event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    if(getBlockClicked(editor.document, clickPos)) {
      startEditing();
      log('info', `Selection changed at ${clickPos.line}:${clickPos.character}`);
    }
  }
}

export function textEdited(event: vscode.TextDocumentChangeEvent) {
  const textEditor = vscode.window.activeTextEditor;
  if (!textEditor) return;

  const clickPos = textEditor.selection.active;
  if (!clickPos) {
    log('info', 'No position selected.');
    return;
  }
}

