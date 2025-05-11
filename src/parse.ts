import * as vscode from 'vscode';
import jsonAsty from 'json-asty';

export function parseJsonDocument(document: vscode.TextDocument): void {
  const jsonText = document.getText();

  try {
    const ast = jsonAsty.parse(jsonText); // Use the `parse` method to parse the JSON text into an AST
    console.log('Parsed AST:', jsonAsty.dump(ast, { colors: true })); // Log the AST using JsonAsty.dump
  } catch (error) {
    console.error('Failed to parse JSON:', error);
  }
}