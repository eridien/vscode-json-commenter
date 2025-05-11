import * as box    from './box';

/**
 * Toggles the comment edit mode in the active text editor.
 */
export function toggleEditMode() {
	box.drawBox({
	  startLine: 0, lineCount: 4,
	  indent: 4, padding: 2, width: 60,
	  hdrLineStr: '-', footerLineStr: '-'
	});
}
