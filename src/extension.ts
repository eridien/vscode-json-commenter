import * as vscode from 'vscode';
import * as box    from './box';
import * as edit   from './edit';

export function activate(context: vscode.ExtensionContext) {

  // await box.openCommand();  // debug only

	const registerCommand = vscode.commands.registerCommand(
            'vscode-json-commenter.open', async () => {
		await box.openCommand();
	});

  const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(async event => {
    if (event.textEditor?.document.uri.scheme !== 'file') return;
    await edit.selectionChanged(event);
  });

  const textDocumentDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    edit.documentChanged(event);
  });

  const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
    await edit.chgVisibleEditors(editors);
  });

  const activeEditorDisposable = 
             vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if(editor) await edit.stopEditing(editor);
  });

	context.subscriptions.push( registerCommand, textDocumentDisposable, 
                              selectionDisposable, visibleEditorsDisposable, activeEditorDisposable );
}

export function deactivate() {}
