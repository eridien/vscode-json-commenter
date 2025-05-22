// Returns a DecorationRenderOptions object using the current editingBackgroundColor
import * as vscode from 'vscode';
import * as utils     from './utils';
const { log, start, end } = utils.getLog('sett');

export type InsertPosition = 'Above' | 'Below';

export interface JsonCommenterSettings {
  indent:                 number;
  marginTop:              number;
  marginBottom:           number;
  padding:                number;
  minWidth:               number;
  maxWidth:               number;
  quoteString:            string;
  headerString:           string;
  footerString:           string;
  insertPosition:         InsertPosition;
  editingBackgroundColor: string;
}

function mm(val: number, max: number, min: number = 0): number {
  return Math.max(min, Math.min(max, val));
}

export function getJsonCommenterSettings(): JsonCommenterSettings {
  const config = vscode.workspace.getConfiguration('json-commenter');
  return {
    indent:              mm(config.get<number>('indent', 4),      60),
    marginTop:           mm(config.get<number>('marginTop', 1),    6),
    marginBottom:        mm(config.get<number>('marginBottom', 1), 6),
    padding:             mm(config.get<number>('padding', 2),      3),
    minWidth:            mm(config.get<number>('minWidth', 20),  200, 20),
    maxWidth:            mm(config.get<number>('maxWidth', 60),  200, 20),
    quoteString:            config.get<string>('quoteString',  "'"),
    headerString:           config.get<string>('headerString', '-'),
    footerString:           config.get<string>('footerString', '-'),
    insertPosition:         config.get<InsertPosition>('insertPosition', 'Above'),
    editingBackgroundColor: config.get<string>('editingBackgroundColor', '#ffffcc'),
  };
}
