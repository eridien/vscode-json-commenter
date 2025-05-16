import vscode     from 'vscode';
import * as utils from './utils';
import { get } from 'http';
const { log, start, end } = utils.getLog('edit');

export const ID_WIDTH = 6;

interface BlockLine {
  startQuote: number;
  type:       number;
  padWidth:   number;
  endQuote:   number;
  text:       string;
}

interface Block {
  startLine: number;
  endLine:   number;
  startText: number;
  endText:   number;
  text:      string;
  blocklines:  Array<BlockLine>;
}

//"    "​​​​​‍​‍":"  Click here and start typing.              ","
// "[\u200B\u200C\u200D\u2060]{6}([\u200B\u200C\u200D\u2060])([\u200B\u200C\u200D\u2060])":(.*?)"\/g/

let editingBlock: Block | null | undefined = null;

const invChrRegEx = /[\u200B\u200C\u200D\u2060]/;
const lineRegEx = new RegExp(`"[\\u200B\\u200C\\u200D\\u2060]{${ID_WIDTH}}` +
                             `([\\u200B\\u200C\\u200D\\u2060])` +
                             `([\\u200B\\u200C\\u200D\\u2060])":"(.*?)"/g`);

function getBlockLine(document: vscode.TextDocument, lineNumber: number, 
                          line: vscode.TextLine | null) : BlockLine | null {
  if (!line) return null;
  const groups = lineRegEx.exec(line.text);
  if(!groups) return null;
  const blkLine = {
    startQuote: groups.index as number,
    type:       utils.inv2num(groups[1]),
    padWidth:   utils.inv2num(groups[2]),
    endQuote:   groups.index + groups[0].length,
    text:       groups[3],
  };
  if(blkLine.startQuote != line.firstNonWhitespaceCharacterIndex) return null;
  if(groups[0].length   != ID_WIDTH + blkLine.text.length + 6)    return null;
  const padStr = ' '.repeat(blkLine.padWidth);
  if(!blkLine.text.startsWith(padStr))                            return null;
  if(!blkLine.text.endsWith(  padStr))                            return null;
  if(blkLine.startQuote + groups[0].length != line.text.length)   return null;
  return blkLine; 
}

function getBlock(document: vscode.TextDocument, 
                  clickPos: vscode.Position): Block | undefined | null {
  let lineNumber = clickPos.line;
  const line     = document.lineAt(lineNumber);
  if(!line || !invChrRegEx.test(line.text)) return undefined;
  const blkLine = getBlockLine(document, lineNumber, line);
  if(!blkLine) return null;
  const blocklines = [blkLine];
  let lineNum = lineNumber;
  do{
    const line    = document.lineAt(--lineNum);
    const blkLine = getBlockLine(document, lineNum, line);
    if(blkLine) blocklines.unshift(blkLine);
  } while(blkLine);
  const startLine = lineNum + 1;
  lineNum = lineNumber;
  do{
    const line    = document.lineAt(++lineNum);
    const blkLine = getBlockLine(document, lineNum, line);
    if(blkLine) blocklines.push(blkLine);
  } while(blkLine);
  const endLine = lineNum - 1;
  let text = '';
  const firstLine = blocklines[0];
  const textLen   = firstLine.text.length;
  for(let i = 0; i < blocklines.length; i++) {
    const blkLine = blocklines[i];
    if(blkLine.text.length != textLen) return null;
    if(i  < blocklines.length-1 && (blkLine.type % 1) != 0) return null;
    if(i == blocklines.length-1 && (blkLine.type % 1) != 1) return null;
    text += blkLine.text.slice(blkLine.padWidth, 
                               blkLine.text.length - blkLine.padWidth) + ' ';
  }
  text = text.trim();
  const startText = firstLine.startQuote + ID_WIDTH + 
                    firstLine.padWidth + 6;
  const endText   = startText + firstLine.text.length - firstLine.padWidth * 2;
  return { startLine, endLine, startText, endText, text, blocklines };
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
    editingBlock = getBlock(editor.document, clickPos);
    if(editingBlock === undefined) return;
    if(editingBlock === null) {
      log('infoerr', 'Comment is corrupted. Create a new comment.');
      return;
    }
    startEditing();
  }
}

export function textEdited(event: vscode.TextDocumentChangeEvent) {
}

