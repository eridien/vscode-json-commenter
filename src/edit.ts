import vscode     from 'vscode';
import * as utils from './utils';
const { log, start, end } = utils.getLog('edit');

interface BlockLine {
  startQuote: number;
  startFull:  number;
  padWidth:   number;
  textWidth:  number;
  endQuote:   number;
  text:       string;
  lineId:     string;
  lineType:   string;
}

interface Block {
  startLine: number;
  endLine:   number;
  startChar: number;
  endChar:   number;
  text:      string;
  lines: Array<BlockLine>;
}

let editingBlock: Block | null = null;

const lineRegEx = new RegExp(`"([\\u200B\\u200C\\u200D\\u2060]+)` +
                              `([\\u200B\\u200C\\u200D\\u2060]{3})":(.*?)` +
                              `([\\u200B\\u200C\\u200D\\u2060]+)"/g`);

function ChkLine(document: vscode.TextDocument, 
                 lineNumber: number): BlockLine | null {
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

function getRawBlock(document: vscode.TextDocument, 
                         clickPos: vscode.Position): RawBlock | null {
  let lineNumber = clickPos.line;
  const lineData = ChkLine(document, lineNumber);
  if( !lineData) return null;
  const { startChar, endChar } = lineData;
  const lines = [lineData];
  let lineNum = lineNumber;
  do{
    const lineData = ChkLine(document, --lineNum);
    if(lineData) lines.unshift(lineData);
  } while(lineData);
  const startLine = lineNum + 1;
  lineNum = lineNumber;
  do{
    const lineData = ChkLine(document, ++lineNum);
    if(lineData) lines.push(lineData);
  } while(lineData);
  const endLine   = lineNum - 1;
  return { startLine, endLine, startChar, endChar, lines };
}

/*
interface RawBlock {
  startLine: number;
  endLine:   number;
  startChar: number;
  endChar:   number;
  lines: Array<BlockLine>;
}

interface Block {
  startLine: number;
  endLine:   number;
  startChar: number;
  endChar:   number;
  text:      string;
  lines: Array<BlockLine>;
}
*/

function fixBlock(rawBlock: RawBlock): Block | null {
  if (!rawBlock) return null;
  const text = rawBlock.lines.map(line => line.text.trim()).join(' ');
  for(let lineNum = rawBlock.startLine; lineNum <= rawBlock.endLine; lineNum++) {
    const line = rawBlock.lines[lineNum - rawBlock.startLine];
    const { startChar, text } = line;
    if(startChar !== rawBlock.startChar ||
         endChar !== rawBlock.endChar) {
      const lineData = rawBlock.lines[lineNum - rawBlock.startLine];
      const { startChar, endChar } = lineData;
      const line = document.lineAt(lineNum);
      const range = new vscode.Range(lineNum, startChar, lineNum, endChar);
    }
  }
  return { ...rawBlock, text };
}

function startEditing() {
  if (!editingBlock) return;
  // editor.setDecorations(decorationType, [range]);
  log('info', 'Editing started.');
}

export function stopEditing() {
  if (!editingBlock) return;
  // clear decorations
  editingBlock = null;
  log('info', 'Editing ended.');
}

export function selectionChanged(event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    const rawBlock = getRawBlock(editor.document, clickPos);
    if(rawBlock) {
      startEditing(rawBlock);
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

