import vscode     from 'vscode';
import * as utils from './utils';
import { get } from 'http';
const { log, start, end } = utils.getLog('edit');

export const ID_WIDTH = 6;

const decorSpec = {
  backgroundColor: 'rgba(255,255,0,0.3)',
  // border: '1px solid orange',
  // borderRadius: '2px',
  // overviewRulerColor: 'yellow',
  // overviewRulerLane: vscode.OverviewRulerLane.Right,
  // fontWeight: 'bold',
  // after: {
  //   contentText: ' ←',
  //   color: 'red',
};

let decorationType: vscode.TextEditorDecorationType | null = null;

interface BlockLine {
  lineLen:    number;
  indentLen:  number;
  id:         number;
  border:     boolean;
  lastLine:   boolean;
  padLen:     number;
  text:       string;
  hasComma:   boolean;
}

interface Block {
  startLine:       number;
  endLine:         number;
  padLen:          number;
  startText:       number;
  endText:         number;
  text:            string;
  hasTopBorder:    boolean;
  hasBottomBorder: boolean;
  hasComma:        boolean;
  blocklines:      Array<BlockLine>;
}

let curEditor:    vscode.TextEditor | null = null;
let editingBlock: Block | null | undefined = null;

export function decorateBlock() {
  if (!curEditor || !editingBlock) return;
  const startLine = editingBlock.startLine + 
                   (editingBlock.hasTopBorder    ? +1 : 0);
  const endLine   = editingBlock.endLine   + 
                   (editingBlock.hasBottomBorder ? -1 : 0);
  const startChar = editingBlock.startText - editingBlock.padLen;
  const endChar   = editingBlock.endText   + editingBlock.padLen;
  const ranges: vscode.Range[] = [];
  for (let lineIdx = startLine; lineIdx <= endLine; lineIdx++) 
      ranges.push(new vscode.Range(lineIdx, startChar, lineIdx, endChar));
  if(!decorationType) decorationType = 
                      vscode.window.createTextEditorDecorationType(decorSpec);
  curEditor.setDecorations(decorationType, ranges);
}

function clrDecoration() {
  if(curEditor && decorationType)
     curEditor.setDecorations(decorationType, []);
  if(decorationType) {
    decorationType.dispose();
    decorationType = null;
  }
}

const oneInvChar  = '[\u200B\u200C\u200D\u2060]';
export const invChrRegEx = new RegExp(oneInvChar);
const lineRegEx   = new RegExp(
  `^( *)"(${oneInvChar}{${ID_WIDTH}})(${oneInvChar})` +
        `(${oneInvChar})":"(.*?)"(\,?)\s*$`);

function getBlockLine(document: vscode.TextDocument, lineNumber: number, 
                          line: vscode.TextLine | null) : BlockLine | null {
  if (!line) return null;
  const groups = lineRegEx.exec(line.text);
  if(!groups) return null;
  const lineType = utils.inv2num(groups[3]);
  const blkLine = {
    lineLen:    groups[0].trimEnd().length,
    indentLen:  groups[1].length,
    id:         utils.invBase4ToNumber(groups[2]),
    border:     !!(lineType & 0x2),
    lastLine:   !!(lineType & 0x1),
    padLen:     utils.inv2num(groups[4]),
    text:       groups[5],
    hasComma:   groups[6] === ',',
  };
  if(!blkLine.border) {
    const padStr = ' '.repeat(blkLine.padLen);
    if(!blkLine.text.startsWith(padStr)) return null;
    if(!blkLine.text.endsWith(  padStr)) return null;
  }
  blkLine.text = blkLine.text.slice(blkLine.padLen,
                 blkLine.text.length - blkLine.padLen);
  return blkLine; 
}

function getBlock(document: vscode.TextDocument, 
                  clickPos: vscode.Position,
                  line: vscode.TextLine): Block | null {
  let lineNumber = clickPos.line;
  const blockLine = getBlockLine(document, lineNumber, line);
  if(!blockLine) return null;
  const blocklines = [blockLine];
  let lineNum = lineNumber;
  let blkLine: BlockLine | null;
  do{
    const line  = document.lineAt(--lineNum);
    blkLine = getBlockLine(document, lineNum, line);
    if(blkLine) blocklines.unshift(blkLine);
  } while(blkLine);
  const startLine = lineNum+1;
  lineNum = lineNumber;
  do{
    const line  = document.lineAt(++lineNum);
    blkLine = getBlockLine(document, lineNum, line);
    if(blkLine) blocklines.push(blkLine);
  } while(blkLine);
  const endLine = lineNum-1;
  let text = '';
  const firstLine       = blocklines[0];
  const padLen          = firstLine.padLen;
  const textLen         = firstLine.text.length;
  const hasTopBorder    = firstLine.border;
  let   hasBottomBorder = false;
  let   hasComma        = false;
  for(let i = 0; i < blocklines.length; i++) {
    const blkLine = blocklines[i];
    if(blkLine.text.length != textLen || 
       blkLine.indentLen != firstLine.indentLen) return null;
    if(i != blocklines.length-1) {
      if(blkLine.lastLine) return null;
    } else {
      if(!blkLine.lastLine) return null;
      hasBottomBorder = blkLine.border;
      hasComma        = blkLine.hasComma;
    }
    if(!blkLine.border) text += blkLine.text + ' ';
  }
  text = text.trim();
  const startText = firstLine.indentLen + 1 + ID_WIDTH + 5 + padLen;
  const endText   = startText + firstLine.text.length;
  return { startLine, endLine, padLen, startText, endText, text, 
           hasTopBorder, hasBottomBorder, hasComma, blocklines };
}

export function selectionChanged(event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  if(curEditor && editor !== curEditor) { stopEditing(); return; }
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    const line = editor.document.lineAt(clickPos.line);
    if(!line || !invChrRegEx.test(line.text)) {
      stopEditing();
      return;
    }
    editingBlock = getBlock(editor.document, clickPos, line);
    if(editingBlock === null) {
      log('infoerr', 'Comment is corrupted. Create a new comment.');
      return;
    }
    curEditor = editor;
    decorateBlock();
    log('Editing started.');
  }
}

export function stopEditing() {
  if (!editingBlock) return;
  clrDecoration();
  curEditor    = null;
  editingBlock = null;
  log('Editing ended.');
}

function inEditLine(range: vscode.Range): boolean {
  if (!editingBlock) return false;
  const firstLineNum = editingBlock.startLine +
                      (editingBlock.hasTopBorder    ? +1 : 0);
  const lastLineNum  = editingBlock.endLine   +
                      (editingBlock.hasBottomBorder ? -1 : 0);
  const firstChar    = editingBlock.startText - editingBlock.padLen;
  const lastChar     = editingBlock.endText   + editingBlock.padLen;
  const { start, end } = range;
  return start.line      == end.line      &&
         start.line      >= firstLineNum  &&
         end.line        <= lastLineNum   &&
         start.character >= firstChar     &&
         end.character   <= lastChar;
}

export function documentEdited(event: vscode.TextDocumentChangeEvent) {
  const { document, contentChanges } = event;
  if (contentChanges.length === 0) return;
  if (curEditor && document !== curEditor.document) { 
    stopEditing(); 
    return; 
  }
  if (editingBlock) {
    for (const change of contentChanges) {
      const { range, rangeLength, text } = change;
      if (rangeLength === 0 && text.length === 0) continue;
      if(range.start.line < editingBlock.startLine ||
         range.end.line   > editingBlock.endLine) {
        stopEditing();
        return;
      }
      if(!inEditLine(range)) {
        log('infoerr', 'Cannot edit outside of text. Please fix.');
        stopEditing();
        return;
      }
      const line       = document.lineAt(range.start.line);
      const blockLine  = getBlockLine(document, range.start.line, line);
      if(!blockLine) {
        log('infoerr', 'Comment line is corrupted. Please fix.');
        stopEditing();
        return;
      }
    }
  }
}

export function chgVisibleEditors(editors: readonly vscode.TextEditor[]) {
  if (!editingBlock) return;
  let editorIsVisible = false;
  editors.forEach(editor => {
    if(editor.document.uri === curEditor?.document.uri) editorIsVisible = true;
  });
  if(!editorIsVisible) stopEditing();
}

