import * as vscode from 'vscode';
import * as box    from './box';
import * as edit   from './edit';

export function activate(context: vscode.ExtensionContext) {

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

  const activeEditorDisposable = 
             vscode.window.onDidChangeActiveTextEditor(async editor => {
    if(editor) await edit.stopEditing(editor);
  });

  const settingsDisposable = 
        vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('json-commenter')) {
      box.refreshSettings();
    }
  });

  context.subscriptions.push( registerCommand, settingsDisposable, 
                              selectionDisposable, activeEditorDisposable );
}

export function deactivate() {}
