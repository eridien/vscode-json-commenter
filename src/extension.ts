import * as vscode from 'vscode';
import * as cmds from './commands';
import * as parse from './parse';

/**
 * Activates the extension.
 * @param {vscode.ExtensionContext} context
 */
async function activate(context: vscode.ExtensionContext) {
  await cmds.toggleClick();
	// cmds.test();
	const disposable = vscode.commands.registerCommand(
            'vscode-json-commenter.toggle', async () => {
		await cmds.toggleClick();
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

export { activate, deactivate };
