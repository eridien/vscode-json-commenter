
import * as vscode from 'vscode';
import * as utils     from './utils';
const { log, start, end } = utils.getLog('sett');

export type InsertionPosition = 'above' | 'below';

export interface JsonCommenterSettings {
  indent: number;
  marginTop: number;
  marginBottom: number;
  padding: number;
  minWidth: number;
  maxWidth: number;
  quoteString: string;
  headerString: string;
  footerString: string;
  insertionPosition: InsertionPosition;
  editingBackgroundColor: string;
}

export function getJsonCommenterSettings(): JsonCommenterSettings {
  const config = vscode.workspace.getConfiguration('json-commenter');
  return {
    indent: config.get<number>('indent', 4),
    marginTop: config.get<number>('marginTop', 1),
    marginBottom: config.get<number>('marginBottom', 1),
    padding: config.get<number>('padding', 2),
    minWidth: config.get<number>('minWidth', 20),
    maxWidth: config.get<number>('maxWidth', 60),
    quoteString: config.get<string>('quoteString', "'"),
    headerString: config.get<string>('headerString', '-'),
    footerString: config.get<string>('footerString', '-'),
    insertionPosition: config.get<InsertionPosition>('insertionPosition', 'above'),
    editingBackgroundColor: config.get<string>('editingBackgroundColor', '#ffff99'),
  };
}
