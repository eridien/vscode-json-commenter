import vscode     from 'vscode';
import * as utils from './utils';
import { get } from 'http';
const { log, start, end } = utils.getLog('edit');

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
  lineText:   string;
  hasComma:   boolean;
}

interface Block {
  startLine:       number;
  startTextLine:   number;
  endTextLine:     number;
  endLine:         number;
  startPadChar:    number;
  startTextChar:   number;
  endTextChar:     number;
  endPadChar:      number;
  padLen:          number;
  text:            string;
  hasTopBorder:    boolean;
  hasBottomBorder: boolean;
  hasComma:        boolean;
  isNew:           boolean;
  isRect:          boolean;
  blocklines:      Array<BlockLine>;
}

let curEditor:    vscode.TextEditor | null = null;
let editingBlock: Block | null | undefined = null;

export function decorateBlock() {
  if (!curEditor || !editingBlock) return;
  const ranges: vscode.Range[] = [];
  for (let lineIdx = editingBlock.startTextLine; 
           lineIdx <= editingBlock.endTextLine; lineIdx++)
      ranges.push(new vscode.Range(lineIdx, editingBlock.startTextChar, 
                                   lineIdx, editingBlock.endTextChar));
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

function getBlockLine(document: vscode.TextDocument, 
                      lineNumber: number): BlockLine | null {
  const line = document.lineAt(lineNumber);
  if (!line) return null;
  const groups = utils.lineRegEx.exec(line.text);
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
    lineText:   line.text,
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
  const blockLine = getBlockLine(document, lineNumber);
  if(!blockLine) return null;
  const blocklines = [blockLine];
  let lineNum = lineNumber;
  let blkLine: BlockLine | null;
  do{
    const line = document.lineAt(--lineNum);
    blkLine = getBlockLine(document, lineNum);
    if(blkLine) blocklines.unshift(blkLine);
  } while(blkLine);
  const startLine = lineNum+1;
  lineNum = lineNumber;
  do{
    const line = document.lineAt(++lineNum);
    blkLine = getBlockLine(document, lineNum);
    if(blkLine) blocklines.push(blkLine);
  } while(blkLine);
  const endLine = lineNum-1;

  let   startTextLine   = -1;
  let   endTextLine     = 0;
  const firstLine       = blocklines[0];
  const padLen          = firstLine.padLen;
  const startPadChar    = firstLine.indentLen + 1 + utils.ID_WIDTH + 5;
  const startTextChar   = startPadChar + padLen;
  const textLen         = firstLine.text.length;
  const endTextChar     = startTextChar + textLen;
  const endPadChar      = endTextChar + padLen;

  let   text            = '';
  const hasTopBorder    = firstLine.border;
  let   hasBottomBorder = false;
  let   hasComma        = false;
  let   isNew           = true;
  let   isRect          = true;
  for(let i = 0; i < blocklines.length; i++) {
    const blkLine = blocklines[i];
    if(blkLine.indentLen != firstLine.indentLen) return null;
    if(startTextLine == -1 && !blkLine.border) startTextLine = lineNumber;
    if(!blkLine.border) endTextLine = lineNumber;
    if(i != blocklines.length-1) {
      if(blkLine.lastLine) return null;
    } else {
      if(!blkLine.lastLine) return null;
      hasBottomBorder = blkLine.border;
      hasComma        = blkLine.hasComma;
    }
    if(!blkLine.border) text += blkLine.text + ' ';
    if(blkLine.text.length != textLen) isRect = false;
  }
  text = text.trim();
  return { startLine, startTextLine, endTextLine, endLine, 
           startPadChar, startTextChar, endTextChar, endPadChar, padLen, text, 
           hasTopBorder, hasBottomBorder, hasComma, isNew, isRect, blocklines };
}

function duplicateFirstTextLine(wsEdit: vscode.WorkspaceEdit) {
  if (!editingBlock || !curEditor) return;
  const document = curEditor.document;
  const firstTextLine = editingBlock.blocklines[
                        editingBlock.startTextLine - editingBlock.startLine];
  let lineText = firstTextLine.lineText;
  let idChar = editingBlock.startPadChar - 5 - utils.ID_WIDTH;
  lineText = lineText.slice(0, idChar) + utils.getIdStr() + 
             lineText.slice(idChar + utils.ID_WIDTH);
  const bolPos = new vscode.Position(editingBlock.startTextLine+1, 0);
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
  wsEdit.insert(document.uri, bolPos, lineText + eol);
}

async function updateBlock() {
  if (!curEditor || !editingBlock) return;
  const document = curEditor.document;
  const newLines: [vscode.Range, string][] = [];
  const docUri        = document.uri;
  const startTextLine = editingBlock.startTextLine;
  const endTextLine   = editingBlock.endTextLine;
  const startTextChar = editingBlock.startTextChar;
  const blockLine     = getBlockLine(document, startTextLine);
  if(!blockLine) {
    log('infoerr', 'Comment line is corrupted. Please fix it.');
    stopEditing();
    return;
  }
  const textWidth     = blockLine.text.length;
  const endTextChar   = startTextChar + textWidth;


  let text            = editingBlock.text;


  let lineText = '';
  let lineNumber  = startTextLine;
  let matches     = [...text.matchAll(/(\S+)(\s*)/g)]
                     .map(m => [m[0], m[1], m[2]] as [string, string, string]);
  let match: [string, string, string] | undefined;
  while((match = matches.shift())) {
    let word   = match[1];
    let spaces = match[2];
    const addWordParts: [string, string, string][] = [];
    while(word.length > textWidth-1) {
      const oneLineWord = word.slice(0, textWidth-1) + '-';
      addWordParts.push([oneLineWord, oneLineWord, '']);
      word = word.slice(textWidth-1);
    }
    if(addWordParts.length > 0) {
      if(word.length > 0) addWordParts.push([word, word, '']);
      matches.shift();
      matches.unshift(...addWordParts);
      match  = matches.shift();
      word   = match![1];
      spaces = '';
    }
    if((lineText.length + word.length) > textWidth) {
      matches.unshift(match!);
      lineText = lineText.slice(0, textWidth) + 
                       (' '.repeat(textWidth - lineText.length));
      const lineRange = new vscode.Range(
                           lineNumber, startTextChar, lineNumber, endTextChar);
      newLines.push([lineRange, lineText]);
      lineText = '';
    }
    else {
      lineText += word + spaces;
      lineText = lineText.slice(0, textWidth);
    }
    lineNumber++;
  }
  lineText += ' '.repeat(textWidth - lineText.length);
  const lineRange = new vscode.Range(lineNumber, startTextChar, 
                                     lineNumber, endTextChar);
  newLines.push([lineRange, lineText]);
  const wsEdit = new vscode.WorkspaceEdit();
  let curNumLines = endTextLine - startTextLine  + 1;
  while(newLines.length > curNumLines) {
    duplicateFirstTextLine(wsEdit);
    curNumLines++;
  }
  while(newLines.length < curNumLines) {
    const remTextRange = new vscode.Range(
                               startTextLine+1, 0, startTextLine+2, 0);
    wsEdit.replace(docUri, remTextRange, ''); // type 2
    curNumLines--;
  }
  for(const [range, text] of newLines) wsEdit.replace(docUri, range, text);
  await vscode.workspace.applyEdit(wsEdit);
  const pos = new vscode.Position(startTextLine, startTextChar);
  const line = curEditor.document.lineAt(startTextLine);
  editingBlock = getBlock(curEditor.document, pos, line) as Block;
  decorateBlock();
}

export async function selectionChanged(
                                 event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  if(curEditor && editor !== curEditor) { stopEditing(); return; }
  const document = editor.document;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    const line = document.lineAt(clickPos.line);
    if(!line || !utils.invChrRegEx.test(line.text)) {
      stopEditing();
      return;
    }
    editingBlock = getBlock(document, clickPos, line);
    if(editingBlock === null) {
      log('infoerr', 'Comment is corrupted. Fix it or create a new comment.');
      return;
    }
    utils.initIdNumber(document);
    curEditor = editor;
    decorateBlock();
    if(editingBlock.isNew) {
      editingBlock.text = '';
      await updateBlock();
    }
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
  const { start, end } = range;
  return start.line      == end.line                   &&
         start.line      >= editingBlock.startTextLine &&
         end.line        <= editingBlock.endTextLine   &&
         start.character >= editingBlock.startPadChar  &&
         end.character   <= editingBlock.endPadChar;
}

export async function documentChanged(event: vscode.TextDocumentChangeEvent) {
  const { document, contentChanges } = event;
  if (contentChanges.length === 0) return;
  if (!curEditor || document !== curEditor.document) { 
    stopEditing(); 
    return; 
  }
  if (editingBlock) {
    for (const change of contentChanges) {
      const { range, rangeLength, text } = change;
      if (rangeLength === 0 && text.length === 0) continue;
      if (range.start.line < editingBlock.startLine ||
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
      const blockLine  = getBlockLine(document, range.start.line);
      if(!blockLine) {
        log('infoerr', 'Comment line is corrupted. Please fix.');
        stopEditing();
        return;
      }
      await updateBlock();
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

