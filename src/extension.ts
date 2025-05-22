import * as vscode from 'vscode';
import * as box    from './box';
import * as edit   from './edit';

export async function activate(context: vscode.ExtensionContext) {

  await box.openCommand();  // debug only

	const registerCommand = vscode.commands.registerCommand(
            'json-commenter.new', async () => {
		await box.openCommand();
	});

  const selectionDisposable = 
                  vscode.window.onDidChangeTextEditorSelection(async event => {
    const scheme = event.textEditor?.document?.uri.scheme;
    if (scheme !== 'file' && scheme !== 'untitled') return;
    await edit.selectionChanged(event);
  });

  const visibleEditorsDisposable = 
        vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
    await edit.chgVisibleEditors(editors);
  });

  const activeEditorDisposable = 
             vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if(editor) await edit.stopEditing(editor);
  });

  const settingsDisposable = 
        vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('json-commenter')) {
      await edit.settingsChg();
    }
  });

	context.subscriptions.push( registerCommand, settingsDisposable, 
                              selectionDisposable, visibleEditorsDisposable,
                              activeEditorDisposable );
}

export function deactivate() {}
