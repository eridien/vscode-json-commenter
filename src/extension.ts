import * as vscode from 'vscode';
import * as box    from './box';
import * as edit   from './edit';

export function activate(context: vscode.ExtensionContext) {

  // await box.openCommand();  // debug only

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
        vscode.window.onDidChangeVisibleTextEditors((editors) => {
    edit.chgVisibleEditors(editors);
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

  // Listen for document content changes
  const docContentChangeDisposable = vscode.workspace
                      .onDidChangeTextDocument(event => {
    edit.docContentChanged();
  });

  context.subscriptions.push( registerCommand, settingsDisposable, 
                              selectionDisposable,docContentChangeDisposable, visibleEditorsDisposable,
                              activeEditorDisposable );
}

export function deactivate() {}
