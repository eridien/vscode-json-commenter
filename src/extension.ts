import * as vscode from 'vscode';
import * as cmds from './commands';

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context: vscode.ExtensionContext) {
  cmds.click();
	const disposable = vscode.commands.registerCommand(
            'vscode-json-commenter.toggle', () => {
		cmds.click();
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

export { activate, deactivate };
