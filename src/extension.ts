import * as vscode from 'vscode';
import * as cmds   from './commands';

export async function activate(context: vscode.ExtensionContext) {
  await cmds.openClick();
	// cmds.test();
	const disposable = vscode.commands.registerCommand(
            'vscode-json-commenter.open', async () => {
		await cmds.openClick();
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}
