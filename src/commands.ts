import * as vscode from 'vscode';
import * as box    from './box';

let context: vscode.ExtensionContext;

/**
 * Toggles the comment edit mode in the active text editor.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function toggleEditMode(contextIn: vscode.ExtensionContext) {
	const context = contextIn;
	box.drawBox(null, 0, 9);
}