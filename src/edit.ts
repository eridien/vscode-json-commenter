import vscode     from 'vscode';
import * as box   from './box';
import * as utils from './utils';
import { get } from 'http';
const { log, start, end } = utils.getLog('edit');

const editInitialMsg = 
`Enter comment.
A blank line creates a line break.
Click outside of this edit area when finished.`;

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
  startTextLine:  number;
  startTextChar:  number;
  endTextLine:    number;
  endTextChar:    number;
  endLine:        number;
  endChar:        number;
  text:           string;
  hasComma:       boolean;
}

let editArea: EditArea | null = null;
let decorationType: vscode.TextEditorDecorationType | null = null;

export function decorateEditArea() {
  if (!editArea) return;
  const ranges: vscode.Range[] = [
    new vscode.Range(editArea.startTextLine, editArea.startTextChar,
                     editArea.endTextLine,   editArea.endTextChar)
  ];
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
      let blkLineText = blkLine.text.trimEnd();
      if (blkLine.hasBreak) blkLineText += eol;
      else                  blkLineText += ' ';
      text += blkLineText;
    }
  }
  text = text.trim();
  log(text.replace(/\n+/g, '#'));
  return { document, startLine, startTextLine, endTextLine, endLine,
           startPadChar, startTextChar, endTextChar, endPadChar, padLen, text,
           hasTopBorder, hasBottomBorder, hasComma, eol, blocklines };
}

function getEditArea(editor: vscode.TextEditor): EditArea | null | undefined {
  const document = editor.document;
  const docText  = document.getText();
  const startGroups = startEditTagRegex.exec(docText);
  const endGroups   = endEditTagRegex  .exec(docText);
  if(startGroups === null && endGroups === null) return undefined;
  if(startGroups === null && endGroups !== null) {
    log('infoerr', 'JSON Commenter: <comment> tag is missing.');
    return null;
  }
  if (startGroups !== null && endGroups === null) {
    log('infoerr', 'JSON Commenter: </comment> tag is missing.');
    return null;
  }
  let startIdx     = startGroups!.index;
  let startTextIdx = startGroups!.index + startEditTag.length;
  let endTextIdx   = endGroups  !.index;
  let endIdx       = endGroups  !.index + endEditTagLen;
  if(endIdx < startIdx) {
    log('infoerr', 'JSON Commenter: </comment> is before <comment>.');
    return null;
  }
  let startPos      = document.positionAt(startIdx );
  let startTextPos  = document.positionAt(startTextIdx );
  let startTextLine  = startTextPos.line;
  let endTextPos    = document.positionAt(endTextIdx);
  let endTextLine   = endTextPos.line;
  let endPos        = document.positionAt(endIdx);
  let endLine       = endPos.line;
  [startTextIdx, startTextLine] = utils.movePastEol(docText, startTextIdx, startTextLine);
  [endTextIdx,   endTextLine]   = utils.movePastEol(docText, endTextIdx,   endTextLine);
  [endIdx,       endLine]       = utils.movePastEol(docText, endIdx,       endLine);
  const editArea: EditArea = {
    editor,
    startLine: startPos.line, startChar:     startPos.character, 
    startTextLine,            startTextChar: startTextPos.character, 
    endTextLine,              endTextChar:   endTextPos.character, 
    endLine,                  endChar:       endPos.character,
    text: docText.slice(startTextIdx, endTextIdx).trim(),
    hasComma: (utils.inv2num(endGroups![1]) == 1),
  };
  return editArea;
}

async function startEditing(editor: vscode.TextEditor, block: Block) {
  if (editArea) return;
  if(block === null) {
    log('infoerr', 'Comment is corrupted. Fix it or create a new comment.');
    return;
  }
  editArea = {
    editor:         editor,
    startLine:      block.startLine,
    startChar:      0,
    startTextLine:  block.startLine + 1,
    startTextChar:  0,
    endTextLine:    0,
    endTextChar:    0,
    endLine:        0,
    endChar:        endEditTagLen,
    text:           block.text,
    hasComma:       block.hasComma,
  };
  const blockRange = 
               new vscode.Range(block.startLine-1, 0, block.endLine + 1, 0);
  let text = '';
  if(block.text === box.blockInitialMsg) text = editInitialMsg;
  else {
    for(const blkLine of block.blocklines) {
      if(blkLine.border) continue;
      text += blkLine.text + '\n' + (blkLine.hasBreak ? '\n' : '');
    }
  }
  text = text.trim();
  const editStrLines   = text.split(/\r?\n/);
  editArea.endTextLine = block.startLine + editStrLines.length + 1;
  editArea.endLine     = editArea.endTextLine + 1;
  const eol = block.eol;
  const wsEdit = new vscode.WorkspaceEdit();
  wsEdit.replace(editor.document.uri, blockRange, eol + 
                  startEditTag                  + eol + 
                  text                          + eol + 
                  getEndEditTag(block.hasComma) + eol);
  await vscode.workspace.applyEdit(wsEdit);
  decorateEditArea();
  const startTextPos =
           new vscode.Position(editArea.startTextLine, editArea.startTextChar);
  const endTextPos = 
           new vscode.Position(editArea.endTextLine-1,   
                               editStrLines[editStrLines.length-1].length);
  editor.selection = new vscode.Selection(endTextPos, startTextPos);
  log('Editing started.');
}

function wordWrap(lineText: string, maxLineLen: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  lineText = lineText.trim().replace(/\s+/g, ' ');
  for (const word of lineText.split(' ')) {
    if (currentLine.length + word.length + 1 > maxLineLen) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine.length > 0 ? ' ' : '') + word;
    }
  }
  lines.push(currentLine);
  return lines;
}

export async function stopEditing(editor: vscode.TextEditor) {
  if (!editArea) return;
  clrDecoration();
  const wsEdit = new vscode.WorkspaceEdit();
  const editRange = new vscode.Range(
    editArea.startLine, editArea.startChar,
    editArea.endLine,   editArea.endChar
  );
  wsEdit.delete(editor.document.uri, editRange);
  const text = editArea.text === editInitialMsg 
                          ? box.blockInitialMsg : editArea.text;
  let lines: string[] = [];
  let longLine = '';
  for(let line of text.split(/\r?\n/)) {
    line = line.trim().replace(/\s+/g, ' ');
    if(line.length == 0) {
      longLine = longLine.trimEnd() + '\x00';
      lines = lines.concat(wordWrap(longLine, box.settings.width));
      longLine = '';
      continue;
    }
    longLine += line + ' ';
  }
  if(longLine.length > 0) 
     lines = lines.concat(wordWrap(longLine, box.settings.width));
  await box.drawBox({
    document:   editor.document,
    lineNumber: editArea.startLine,
    textLines:  lines,
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
        await startEditing(editor, block);
      return;
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
