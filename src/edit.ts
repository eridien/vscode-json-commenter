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
  startLine:  number;
  endLine:    number;
  startText:  number;
  endText:    number;
  text:       string;
  hasComma:   boolean;
  blocklines: Array<BlockLine>;
}

let curEditor: vscode.TextEditor | null = null;
let editingBlock: Block | null | undefined = null;

export function decorateBlock() {
  if (!curEditor || !editingBlock) return;
  const startLine = editingBlock.startLine;
  const endLine   = editingBlock.endLine;
  const startChar = editingBlock.startText;
  const endChar   = editingBlock.endText;
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
                  clickPos: vscode.Position): Block | undefined | null {
  let lineNumber = clickPos.line;
  const line     = document.lineAt(lineNumber);
  if(!line || !invChrRegEx.test(line.text)) return undefined;
  const blockLine = getBlockLine(document, lineNumber, line);
  if(!blockLine) return null;
  const blocklines = [blockLine];
  let lineNum = lineNumber;
  let blkLine: BlockLine | null | undefined;
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
  let hasComma = false;
  const firstLine = blocklines[0];
  const textLen   = firstLine.text.length;
  for(let i = 0; i < blocklines.length; i++) {
    const blkLine = blocklines[i];
    if(blkLine.text.length != textLen) return null;
    if(i  < blocklines.length-1 &&  blkLine.lastLine) return null;
    if(i == blocklines.length-1) { 
      if(!blkLine.lastLine) return null;
      hasComma = blkLine.hasComma;
    }
    if(!blkLine.border) text += blkLine.text + ' ';
  }
  text = text.trim();
  const startText = firstLine.indentLen + 1 + ID_WIDTH + 5 + firstLine.padLen;
  const endText   = startText + firstLine.text.length;
  return { startLine, endLine, startText, endText, text, hasComma, blocklines };
}

export function stopEditing() {
  if (!editingBlock) return;
  clrDecoration();
  curEditor    = null;
  editingBlock = null;
  log('Editing ended.');
}

export function chgVisibleEditors(editors: readonly vscode.TextEditor[]) {
  if (!editingBlock) return;
  let editorIsVisible = false;
  editors.forEach(editor => {
    if(editor.document.uri === curEditor?.document.uri) editorIsVisible = true;
  });
  if(!editorIsVisible) stopEditing();
}

export function selectionChanged(event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  if(curEditor && editor !== curEditor) { stopEditing(); return; }
  if(editingBlock) return;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    editingBlock = getBlock(editor.document, clickPos);
    if(editingBlock === undefined) return;
    if(editingBlock === null) {
      log('infoerr', 'Comment is corrupted. Create a new comment.');
      return;
    }
    curEditor = editor;
    decorateBlock();
    log('Editing started.');
  }
}

export function textEdited(event: vscode.TextDocumentChangeEvent) {
  if (!editingBlock) return;
  if(event.document.uri !== curEditor?.document.uri) stopEditing(); 
}

