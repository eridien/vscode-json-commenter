import * as vscode from 'vscode';
import * as box    from './box';
import * as edit   from './edit';

export async function activate(context: vscode.ExtensionContext) {

  await box.openCommand();  // debug only

	const registerCommand = vscode.commands.registerCommand(
            'vscode-json-commenter.open', async () => {
		await box.openCommand();
	});

  const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor?.document.uri.scheme !== 'file') return;
    edit.selectionChanged(event);
  });

  const textDocumentDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    edit.textEdited(event) ;
  });

  const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    edit.chgVisibleEditors(editors);
  });

  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    edit.stopEditing();
  });

	context.subscriptions.push( registerCommand, textDocumentDisposable, 
                              selectionDisposable, visibleEditorsDisposable, activeEditorDisposable );
}

export function deactivate() {}
