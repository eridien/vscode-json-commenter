import vscode     from 'vscode';
import * as box   from './box';
import * as utils from './utils';
import { get } from 'http';
const { log, start, end } = utils.getLog('edit');

const startEditTagRegex = new RegExp(`<${utils.oneInvChar}comment>`);
const endEditTagRegex   = new RegExp(`</comment(${utils.oneInvChar})>`);

const startEditTag = `<${utils.num2inv(0)}comment>`;
function getEndEditTag(hasComma: boolean): string {
  return `</comment${utils.num2inv(hasComma? 1 : 0)}>`;
} 
const endEditTagLen = 11;
const backgroundColor: vscode.DecorationRenderOptions = 
                                    { backgroundColor: 'rgba(255,255,0,0.3)' };

interface BlockLine {
  lineLen:    number;
  indentLen:  number;
  id:         number;
  border:     boolean;
  lastLine:   boolean;
  padLen:     number;
  text:       string;
  hasBreak:   boolean;
  lineText:   string;
  hasComma:   boolean;
}

interface Block {
  document:        vscode.TextDocument;
  blocklines:      Array<BlockLine>;
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
  eol:             string;
}

interface EditArea {
  editor:         vscode.TextEditor;
  startLine:      number;
  startChar:      number;
  startTextChar:  number;
  endTextChar:    number;
  endChar:        number;
  endLine:        number;
  text:           string;
  hasComma:       boolean;
}

let editArea: EditArea | null = null;
let decorationType: vscode.TextEditorDecorationType | null = null;

export function decorateEditArea() {
  if (!editArea) return;
  const ranges: vscode.Range[] = [];
  for (let lineNum  = editArea.startLine; 
           lineNum <= editArea.endLine; lineNum++)
      ranges.push(new vscode.Range(lineNum, editArea.startTextChar, 
                                   lineNum, editArea.endTextChar));
  decorationType ??= vscode.window
                           .createTextEditorDecorationType(backgroundColor);
  editArea.editor.setDecorations(decorationType, ranges);
}

function clrDecoration() {
  if(!editArea || !decorationType) return;
  editArea.editor.setDecorations(decorationType, []);
  decorationType.dispose();
  decorationType = null;
}

function getBlockLine(document: vscode.TextDocument, 
                      lineNumber: number): BlockLine | null {
  const line = document.lineAt(lineNumber);
  if (!line) return null;
  const groups = utils.lineRegEx.exec(line.text);
  if(!groups) return null;
  const lineType = utils.inv2num(groups[4]);
  const blkLine = {
    lineLen:    groups[0].trimEnd().length,
    indentLen:  groups[1].length,
    id:         utils.invBase4ToNumber(groups[2]),
    border:     !!(lineType & 0x2),
    lastLine:   !!(lineType & 0x1),
    padLen:     utils.inv2num(groups[5]),
    text:       groups[6],
    lineText:   line.text,
    hasBreak:   !!(utils.inv2num(groups[3]) & 0x1),
    hasComma:   groups[7] === ',',
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

function getBlock(document: vscode.TextDocument, lineNumber: number): Block | null {
  const eol = (document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
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
  const startPadChar    = firstLine.indentLen + 1 + 6 + 3 + 3;
  const startTextChar   = startPadChar + padLen;
  const textLen         = firstLine.text.length;
  const endTextChar     = startTextChar + textLen;
  const endPadChar      = endTextChar + padLen;
  let   text            = '';
  const hasTopBorder    = firstLine.border;
  let   hasBottomBorder = false;
  let   hasComma        = false;
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
    if(!blkLine.border) {
      let blkLineText = blkLine.text.trim();
      if (blkLine.hasBreak) blkLineText += eol;
      else                  blkLineText += ' ';
      text += blkLineText;
    }
  }
  text = text.trim();
  return { document, startLine, startTextLine, endTextLine, endLine,
           startPadChar, startTextChar, endTextChar, endPadChar, padLen, text,
           hasTopBorder, hasBottomBorder, hasComma, eol, blocklines };
}

function getEditArea(editor: vscode.TextEditor): EditArea | null | undefined {
  const document = editor.document;
  const docText  = document.getText();
  const startGroups = startEditTagRegex.exec(docText);
  const endGroups   = endEditTagRegex.exec(docText);
  if(startGroups  === null && endGroups === null) return undefined;
  if (startGroups === null && endGroups !== null) {
    log('infoerr', 'JSON Commenter: <comment> tag is missing.');
    return null;
  }
  if (startGroups !== null && endGroups === null) {
    log('infoerr', 'JSON Commenter: </comment> tag is missing.');
    return null;
  }
  const startIdx = startGroups!.index;
  let   endIdx   = endGroups!.index;
  if(endIdx < startIdx) {
    log('infoerr', 'JSON Commenter: </comment> is before <comment>.');
    return null;
  }
  const startPos = document.positionAt(startIdx );
  const endPos   = document.positionAt(endIdx);
  let endCharIdx = endIdx + endEditTagLen;
  if (docText.slice(endCharIdx, endCharIdx+2) === '\r\n') endCharIdx += 2;
  if (docText.slice(endCharIdx, endCharIdx+1) ===   '\n') endCharIdx += 1;
  const endCharPos = document.positionAt(endCharIdx);
  const editArea: EditArea = {
    editor,
    startLine:      startPos.line,
    startChar:      startPos.character,
    startTextChar:  startPos.character + startEditTag.length,
    endLine:        endCharPos.line,
    endTextChar:    endPos.character,
    endChar:        endCharPos.character,
    text:           docText.slice(startIdx + startEditTag.length, endIdx),
    hasComma:       utils.inv2num(endGroups![1]) == 1,
  };
  return editArea;
}

async function startEditing(editor: vscode.TextEditor, 
                            lineNumber: number, block: Block) {
  if (editArea) return;
  // const block = getBlock(editor.document, lineNumber);
  if(block === null) {
    log('infoerr', 'Comment is corrupted. Fix it or create a new comment.');
    return;
  }
  editArea = {
    editor,
    startLine:      block.startLine,
    startChar:      0,
    startTextChar:  startEditTag.length,
    endLine:        0,
    endTextChar:    0,
    endChar:        0,
    text:           block.text,
    hasComma:       block.hasComma,
  };
  const blockRange = 
               new vscode.Range(block.startLine-1, 0, block.endLine + 1, 0);
  let editStr = startEditTag + block.text + getEndEditTag(block.hasComma);
  const editStrLines   = editStr.split(/\r?\n/);
  editArea.endLine     = block.startLine + editStrLines.length - 1;
  editArea.endChar     = editStrLines[editStrLines.length - 1].length;
  editArea.endTextChar = editArea.endChar - getEndEditTag(block.hasComma).length;
  const wsEdit = new vscode.WorkspaceEdit();
  wsEdit.replace(editor.document.uri, blockRange, 
                   block.eol + editStr + block.eol);
  await vscode.workspace.applyEdit(wsEdit);
  decorateEditArea();
  const typePos = new vscode.Position(
                         editArea.startLine, editArea.startTextChar);
  editor.selection = new vscode.Selection(typePos, typePos);
  log('Editing started.');
}

// editArea must be up-to-date
export async function stopEditing(editor: vscode.TextEditor) {
  if (!editArea) return;
  clrDecoration();
  const wsEdit = new vscode.WorkspaceEdit();
  const editRange = new vscode.Range(
    editArea.startLine, editArea.startChar,
    editArea.endLine,   editArea.endChar
  );
  wsEdit.delete(editor.document.uri, editRange);
  await box.drawBox({
    document:   editor.document,
    lineNumber: editArea.startLine,
    textLines:  editArea.text.split(/\r?\n/),
    addComma:   editArea.hasComma,
    textAfter:   '',
    textAfterOfs: 0,
    wsEdit
  });
  await vscode.workspace.applyEdit(wsEdit);
  editArea = null;
  log('Editing ended.');
}

function inEditArea(pos:vscode.Position): boolean {
  if (!editArea) return false;
  const editRange = new vscode.Range(
    editArea.startLine, editArea.startTextChar,
    editArea.endLine,   editArea.endTextChar
  );
  return editRange.contains(pos);
}

export async function selectionChanged( 
                          event:vscode.TextEditorSelectionChangeEvent) {
  const {textEditor:editor, selections, kind} = event;
  const document = editor.document;
  if(selections.length == 1 && selections[0].isEmpty &&
        kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    const clickPos = selections[0].active;
    if (!clickPos) return;
    const editAreaNew = getEditArea(editor);
    if (editAreaNew === undefined) {
      const line = document.lineAt(clickPos.line);
      if(!line || !utils.invChrRegEx.test(line.text))
        return;
      const block = getBlock(document, clickPos.line);
      if (block === null) return;
      const clickLine = clickPos.line;
      if (clickLine >= block.startLine && clickLine <= block.endLine) 
        await startEditing(editor, clickLine, block);
      return
    }
    if (editAreaNew === null) {
      log('selectionChanged: editArea is corrupted.');
      return;
    }
    editArea = editAreaNew;
    if (!inEditArea(clickPos)) {
      await stopEditing(editor);
      return;
    }
    const line = document.lineAt(clickPos.line);
    if(!line || !utils.invChrRegEx.test(line.text)) {
      await stopEditing(editor);
      return;
    }
    log('selectionChanged: no editArea found.');
  }
}

export function documentChanged(event: vscode.TextDocumentChangeEvent) {
  const { document, contentChanges } = event;
  if (contentChanges.length === 0) return;
  // if (!editArea || document.uri !== editArea.editor.document.uri) {
  //   await stopEditing();
  //   return; 
  // }
  // if (editArea) {
  //   for (const change of contentChanges) {
  //     const { range, rangeLength, text } = change;
  //     if (rangeLength === 0 && text.length === 0) continue;
  //     if (range.start.line < editArea.startLine ||
  //         range.end.line   > editArea.endLine) {
  //       await stopEditing();
  //       return;
  //     }
  //   }
  // }
}

export async function chgVisibleEditors(
                       editors: readonly vscode.TextEditor[]) {
  if (!editArea) return;
  const docUri = editArea.editor.document.uri;
  let editorIsVisible = false;
  for (const editor of editors) await stopEditing(editor);
}
