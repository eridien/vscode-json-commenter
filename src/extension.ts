import * as vscode from 'vscode';
import * as cmds from './commands';

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand(
            'vscode-json-commenter.toggle', () => {
		cmds.toggleEditMode();
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

export { activate, deactivate };
