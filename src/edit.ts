import vscode     from 'vscode';
import { getLog } from './utils';
const { log, start, end } = getLog('edit');

interface BoxLocation {
  startLine: number;
  endLine:   number;
  startChar: number;
  endChar:   number;
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

const lineRegEx = new RegExp(`"([\\u200B\\u200C\\u200D\\u2060]+)":(.*?)` +
                              `([\\u200B\\u200C\\u200D\\u2060]+)"/g`);

function ChkLine(document: vscode.TextDocument, lineNumber: number): 
                      [startChar: number, endChar: number, 
                       lineId: string, text: string, lineType: string] | null {
  const line   = document.lineAt(lineNumber);  if (!line)   return null;
  const groups = lineRegEx.exec(line.text);    if (!groups) return null;
  const [lineId, text, lineType] = groups.slice(1);
  const startChar = groups.index + 1 + lineId.length + 2;
  const endChar   = startChar + text.length + lineType.length + 1;
  return [startChar, endChar, lineId, text, lineType];
}

function getBlockClicked(document: vscode.TextDocument, 
                         clickPos: vscode.Position): BoxLocation | null {
  let lineNumber = clickPos.line;
  const lineData = ChkLine(document, lineNumber);
  if( !lineData) return null;
  const [startChar, endChar, lineId, text, lineType] = lineData;
  const textLines = [text];
  let firstLineNumber = lineNumber;
  let lastLineNumber  = lineNumber;

  do{
    const lineData = ChkLine(document, lineNumber);
  } while(0);

  const start = new vscode.Position(clickPos.line, 0);
  const end   = new vscode.Position(clickPos.line, line.text.length);
  
  // Check if the click position is within the line
  if (clickPos.isEqual(start) || clickPos.isEqual(end) ||
      (clickPos.character > start.character && clickPos.character < end.character)) {

    return { StartLine: start.line,      EndLine: end.line, 
             StartChar: start.character, EndChar: end.character };
  }
  
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

