import * as vscode from 'vscode';
import * as cmds   from './commands';
import * as edit   from './edit';

export async function activate(context: vscode.ExtensionContext) {

  await cmds.openClick();

	// cmds.test();
	const registerCommand = vscode.commands.registerCommand(
            'vscode-json-commenter.open', async () => {
		await cmds.openClick();
	});

  const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor?.document.uri.scheme !== 'file') return;
    edit.selectionChanged(event);
  });

  const textDocumentDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    const document = event.document;
    if (event?.document?.uri?.scheme !== 'file') { return; }
    edit.textEdited(event) ;
  });

  const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors(() => {
    edit.stopEditing();
  });

  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
    edit.stopEditing();
  });

	context.subscriptions.push( registerCommand, textDocumentDisposable, 
                              selectionDisposable, visibleEditorsDisposable, activeEditorDisposable );
}

export function deactivate() {}
