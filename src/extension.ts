import * as vscode from 'vscode';
import * as cmds from './commands';
import * as parse from './parse';

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context: vscode.ExtensionContext) {
  // cmds.toggleClick();
	cmds.test();
	const disposable = vscode.commands.registerCommand(
            'vscode-json-commenter.toggle', () => {
		// parse.test();
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

export { activate, deactivate };
