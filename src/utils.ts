import vscode     from 'vscode';
const { log, start, end } = getLog('util');

export function invBase4ToStr(str:String) {
  const digitMap: { [key: string]: string } = {
    '\u200B': '0', // Zero Width Space
    '\u200C': '1', // Zero Width Non-Joiner
    '\u200D': '2', // Zero Width Joiner
    '\u2060': '3'  // Word Joiner
  };
  let digitsStr = '';
  for (const char of str) {
    const digit = digitMap[char];
    if (digit === undefined)
      throw new Error('Invalid character in zero-width base-4 string');
    digitsStr += digit;
  }
  return digitsStr;
}

export function numberToInvBase4(num :number) {
  const zeroWidthDigits = ['\u200B', '\u200C', '\u200D', '\u2060'];
  if (num === 0) return zeroWidthDigits[0];
  let result = '';
  while (num > 0) {
    const digit = num % 4;
    result = zeroWidthDigits[digit] + result;
    num = Math.floor(num / 4);
  }
  return result;
}

export function invBase4ToNumber(str: string) {
  const digitMap : { [key: string]: number } = {
    '\u200B': 0,
    '\u200C': 1,
    '\u200D': 2,
    '\u2060': 3 
  };
  let num = 0;
  for (const char of str) {
    const digit = digitMap[char];
    if (digit === undefined) {
      log('err', 'Invalid character in zero-width base-4 string');
      return 0;
    }
    num = num * 4 + digit;
  }
  return num;
}

/**
 * Clear the entire document
 *
 * @export
 * @param {vscode.TextDocument} document 
 */
export async function clrDoc(document:vscode.TextDocument) {
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  const delEdit = new vscode.WorkspaceEdit();
  delEdit.delete(document.uri, fullRange);
  await vscode.workspace.applyEdit(delEdit);
}

const outputChannel = vscode.window.createOutputChannel('json-commenter');

function timeInSecs(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function movePosToAfterPrevChar(document: vscode.TextDocument,
                     startPos: vscode.Position): vscode.Position {
  let lineText = document.lineAt(startPos.line).text;
  let lineNum  = startPos.line;
  let charPos  = startPos.character;
  while(true) {
    if (charPos === 0) {
      if (--lineNum < 0) return new vscode.Position(0, 0);
      lineText = document.lineAt(lineNum).text;
      charPos = lineText.length;
    } 
    charPos--;
    if (lineText[charPos] !== ' ') break;
  }
  return new vscode.Position(lineNum, charPos + 1);
}

export function movePosToEndOfStr(
                     startPos: vscode.Position, str: string): vscode.Position {
  const lines = str.split(/\r?\n/);
  if (lines.length === 1) {
    // No line feeds, just add to character
    return new vscode.Position(startPos.line, startPos.character + str.length);
  } else {
    // Move down by number of line feeds, character is length of last line
    const newLine = startPos.line + lines.length - 1;
    const newChar = lines[lines.length - 1].length;
    return new vscode.Position(newLine, newChar);
  }
}

export function getLog(module: string) {
  const timers: Record<string, number> = {};

  const start = function (name: string, hide?: boolean): void {
    const startTime = Date.now();
    timers[name] = startTime;
    if (hide) return;
    const line = `${module}: ${name} started`;
    outputChannel.appendLine(line);
    console.log(line);
  };

  const end = function (name: string, onlySlow: boolean = true): void {
    if (!timers[name]) {
      const line = `${module}: ${name} ended`;
      outputChannel.appendLine(line);
      console.log(line);
      return;
    }
    const endTime = Date.now();
    const duration = endTime - timers[name];
    if (onlySlow && duration < 100) return;
    const line = `${module}: ${name} ended, ${timeInSecs(duration)}s`;
    outputChannel.appendLine(line);
    console.log(line);
  };

  const log = function (...args: any[]): void {
    let errFlag = false;
    let errMsgFlag = false;
    let infoFlag = false;
    let nomodFlag = false;

    if (typeof args[0] === 'string') {
      errFlag = args[0].includes('err');
      infoFlag = args[0].includes('info');
      nomodFlag = args[0].includes('nomod');
      errMsgFlag = args[0].includes('errmsg');
    }

    if (errFlag || infoFlag || nomodFlag || errMsgFlag) args = args.slice(1);

    let errMsg: string | undefined;
    if (errMsgFlag) {
      errMsg = args[0]?.message + ' -> ';
      args = args.slice(1);
      errFlag = true;
    }

    const par = args.map((a) => {
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a, null, 2);
        } catch (e: any) {
          return JSON.stringify(Object.keys(a)) + e.message;
        }
      } else return a;
    });

    const line = (nomodFlag ? '' : module + ': ') +
                 (errFlag ? ' error, ' : '') +
                 (errMsg !== undefined ? errMsg : '') +
                 par.join(' ');

    const infoLine = par.join(' ')
                        .replace('parse: ','');

    outputChannel.appendLine(line);
    if (errFlag) console.error(line);
    else console.log(line);
    if (infoFlag) vscode.window.showInformationMessage(infoLine);
  };

  return { log, start, end };
}
