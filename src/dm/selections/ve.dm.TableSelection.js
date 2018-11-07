/*!
 * VisualEditor Table Selection class.
 *
 * @copyright 2011-2018 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * @class
 * @extends ve.dm.Selection
 * @constructor
 * @param {ve.Range} tableRange Table range
 * @param {number} fromCol Starting column
 * @param {number} fromRow Starting row
 * @param {number} [toCol] End column
 * @param {number} [toRow] End row
 */
ve.dm.TableSelection = function VeDmTableSelection( tableRange, fromCol, fromRow, toCol, toRow ) {
	if ( ve.dm.Document && arguments[ 0 ] instanceof ve.dm.Document ) {
		throw new Error( 'Got obsolete ve.dm.Document argument' );
	}
	if ( arguments.length > 5 ) {
		throw new Error( 'Got obsolete argument (probably `expand`)' );
	}

	// Parent constructor
	ve.dm.TableSelection.super.call( this );

	this.tableRange = tableRange;

	toCol = toCol === undefined ? fromCol : toCol;
	toRow = toRow === undefined ? fromRow : toRow;

	this.fromCol = fromCol;
	this.fromRow = fromRow;
	this.toCol = toCol;
	this.toRow = toRow;
	this.startCol = fromCol < toCol ? fromCol : toCol;
	this.startRow = fromRow < toRow ? fromRow : toRow;
	this.endCol = fromCol < toCol ? toCol : fromCol;
	this.endRow = fromRow < toRow ? toRow : fromRow;
	this.intendedFromCol = this.fromCol;
	this.intendedFromRow = this.fromRow;
	this.intendedToCol = this.toCol;
	this.intendedToRow = this.toRow;
};

/* Inheritance */

OO.inheritClass( ve.dm.TableSelection, ve.dm.Selection );

/* Static Properties */

ve.dm.TableSelection.static.name = 'table';

/* Static Methods */

/**
 * @inheritdoc
 */
ve.dm.TableSelection.static.newFromHash = function ( hash ) {
	return new ve.dm.TableSelection(
		ve.Range.static.newFromHash( hash.tableRange ),
		hash.fromCol,
		hash.fromRow,
		hash.toCol,
		hash.toRow
	);
};

/* Methods */

/**
 * Expand the selection to cover all merged cells
 *
 * @private
 * @param {ve.dm.Document} doc The document to which this selection applies
 */
ve.dm.TableSelection.prototype.expand = function ( doc ) {
	var cell, i,
		lastCellCount = 0,
		startCol = Infinity,
		startRow = Infinity,
		endCol = -Infinity,
		endRow = -Infinity,
		colBackwards = this.fromCol > this.toCol,
		rowBackwards = this.fromRow > this.toRow,
		cells = this.getMatrixCells( doc );

	while ( cells.length > lastCellCount ) {
		for ( i = 0; i < cells.length; i++ ) {
			cell = cells[ i ];
			startCol = Math.min( startCol, cell.col );
			startRow = Math.min( startRow, cell.row );
			endCol = Math.max( endCol, cell.col + cell.node.getColspan() - 1 );
			endRow = Math.max( endRow, cell.row + cell.node.getRowspan() - 1 );
		}
		this.startCol = startCol;
		this.startRow = startRow;
		this.endCol = endCol;
		this.endRow = endRow;
		this.fromCol = colBackwards ? endCol : startCol;
		this.fromRow = rowBackwards ? endRow : startRow;
		this.toCol = colBackwards ? startCol : endCol;
		this.toRow = rowBackwards ? startRow : endRow;

		lastCellCount = cells.length;
		cells = this.getMatrixCells( doc );
	}
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.toJSON = function () {
	return {
		type: this.constructor.static.name,
		tableRange: this.tableRange,
		fromCol: this.fromCol,
		fromRow: this.fromRow,
		toCol: this.toCol,
		toRow: this.toRow
	};
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.getDescription = function () {
	return (
		'Table: ' +
		this.tableRange.from + ' - ' + this.tableRange.to +
		', ' +
		'c' + this.fromCol + ' r' + this.fromRow +
		' - ' +
		'c' + this.toCol + ' r' + this.toRow
	);
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.collapseToStart = function () {
	return new this.constructor( this.tableRange, this.startCol, this.startRow, this.startCol, this.startRow );
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.collapseToEnd = function () {
	return new this.constructor( this.tableRange, this.endCol, this.endRow, this.endCol, this.endRow );
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.collapseToFrom = function () {
	return new this.constructor( this.tableRange, this.fromCol, this.fromRow, this.fromCol, this.fromRow );
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.collapseToTo = function () {
	return new this.constructor( this.tableRange, this.toCol, this.toRow, this.toCol, this.toRow );
};

/**
 * @inheritdoc
 * @param {ve.dm.Document} doc The document to which this selection applies
 */
ve.dm.TableSelection.prototype.getRanges = function ( doc ) {
	var i, l, ranges = [],
		cells = this.getMatrixCells( doc );
	for ( i = 0, l = cells.length; i < l; i++ ) {
		ranges.push( cells[ i ].node.getRange() );
	}
	return ranges;
};

/**
 * @inheritdoc
 *
 * Note that this returns the table range, and not the minimal range covering
 * all cells, as that would be far more expensive to compute.
 */
ve.dm.TableSelection.prototype.getCoveringRange = function () {
	return this.tableRange;
};

/**
 * Get all the ranges required to build a table slice from the selection
 *
 * In addition to the outer ranges of the cells, this also includes the start and
 * end tags of table rows, sections and the table itself.
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {ve.Range[]} Ranges
 */
ve.dm.TableSelection.prototype.getTableSliceRanges = function ( doc ) {
	var i, node,
		ranges = [],
		matrix = this.getTableNode( doc ).getMatrix();

	// Arrays are non-overlapping so avoid duplication
	// by indexing by range.start
	function pushNode( node ) {
		var range = node.getOuterRange();
		ranges[ range.start ] = new ve.Range( range.start, range.start + 1 );
		ranges[ range.end - 1 ] = new ve.Range( range.end - 1, range.end );
	}

	// Get the start and end tags of every parent of the cell
	// up to and including the TableNode
	for ( i = this.startRow; i <= this.endRow; i++ ) {
		node = matrix.getRowNode( i );
		pushNode( node );
		while ( ( node = node.getParent() ) && node ) {
			pushNode( node );
			if ( node instanceof ve.dm.TableNode ) {
				break;
			}
		}
	}

	return ranges
		// Condense sparse array
		.filter( function ( r ) { return r; } )
		// Add cell ranges
		.concat( this.getOuterRanges( doc ) )
		// Sort
		.sort( function ( a, b ) { return a.start - b.start; } );
};

/**
 * Get outer ranges of the selected cells
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {ve.Range[]} Outer ranges
 */
ve.dm.TableSelection.prototype.getOuterRanges = function ( doc ) {
	var i, l, ranges = [],
		cells = this.getMatrixCells( doc );
	for ( i = 0, l = cells.length; i < l; i++ ) {
		ranges.push( cells[ i ].node.getOuterRange() );
	}
	return ranges;
};

/**
 * Retrieves all cells (no placeholders) within a given selection.
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @param {boolean} [includePlaceholders] Include placeholders in result
 * @return {ve.dm.TableMatrixCell[]} List of table cells
 */
ve.dm.TableSelection.prototype.getMatrixCells = function ( doc, includePlaceholders ) {
	var row, col, cell,
		matrix = this.getTableNode( doc ).getMatrix(),
		cells = [],
		visited = {};

	for ( row = this.startRow; row <= this.endRow; row++ ) {
		for ( col = this.startCol; col <= this.endCol; col++ ) {
			cell = matrix.getCell( row, col );
			if ( !cell ) {
				continue;
			}
			if ( !includePlaceholders && cell.isPlaceholder() ) {
				cell = cell.owner;
			}
			if ( !visited[ cell.key ] ) {
				cells.push( cell );
				visited[ cell.key ] = true;
			}
		}
	}
	return cells;
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.isCollapsed = function () {
	return false;
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.translateByTransaction = function ( tx, excludeInsertion ) {
	var newRange = tx.translateRange( this.tableRange, excludeInsertion );

	if ( newRange.isCollapsed() ) {
		return new ve.dm.NullSelection();
	}
	return new this.constructor( newRange, this.fromCol, this.fromRow, this.toCol, this.toRow );
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.translateByTransactionWithAuthor = function ( tx, authorId ) {
	var newRange = tx.translateRangeWithAuthor( this.tableRange, authorId );

	if ( newRange.isCollapsed() ) {
		return new ve.dm.NullSelection();
	}
	return new this.constructor( newRange, this.fromCol, this.fromRow, this.toCol, this.toRow );
};

/**
 * Check if the selection spans a single cell
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {boolean} The selection spans a single cell
 */
ve.dm.TableSelection.prototype.isSingleCell = function ( doc ) {
	// Quick check for single non-merged cell
	return ( this.fromRow === this.toRow && this.fromCol === this.toCol ) ||
		// Check for a merged single cell by ignoring placeholders
		this.getMatrixCells( doc ).length === 1;
};

/**
 * Check if the selection is mergeable or unmergeable
 *
 * The selection must span more than one matrix cell, but only
 * one table section.
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {boolean} The selection is mergeable or unmergeable
 */
ve.dm.TableSelection.prototype.isMergeable = function ( doc ) {
	var r, sectionNode, lastSectionNode, matrix;

	if ( this.getMatrixCells( doc, true ).length <= 1 ) {
		return false;
	}

	matrix = this.getTableNode( doc ).getMatrix();

	// Check all sections are the same
	for ( r = this.endRow; r >= this.startRow; r-- ) {
		sectionNode = matrix.getRowNode( r ).findParent( ve.dm.TableSectionNode );
		if ( lastSectionNode && sectionNode !== lastSectionNode ) {
			// Can't merge across sections
			return false;
		}
		lastSectionNode = sectionNode;
	}
	return true;
};

/**
 * Get the selection's table node
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {ve.dm.TableNode} Table node
 */
ve.dm.TableSelection.prototype.getTableNode = function ( doc ) {
	return doc.getBranchNodeFromOffset( this.tableRange.start + 1 );
};

/**
 * Get a new selection with adjusted row and column positions
 *
 * Placeholder cells are skipped over so this method can be used for cursoring.
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @param {number} fromColOffset Starting column offset
 * @param {number} fromRowOffset Starting row offset
 * @param {number} [toColOffset] End column offset
 * @param {number} [toRowOffset] End row offset
 * @param {number} [wrap] Wrap to the next/previous row if column limits are exceeded
 * @return {ve.dm.TableSelection} Adjusted selection
 */
ve.dm.TableSelection.prototype.newFromAdjustment = function ( doc, fromColOffset, fromRowOffset, toColOffset, toRowOffset, wrap ) {
	var fromCell, toCell, wrapDir, selection,
		matrix = this.getTableNode( doc ).getMatrix();

	if ( toColOffset === undefined ) {
		toColOffset = fromColOffset;
	}

	if ( toRowOffset === undefined ) {
		toRowOffset = fromRowOffset;
	}

	function adjust( mode, cell, offset ) {
		var nextCell,
			col = cell.col,
			row = cell.row,
			dir = offset > 0 ? 1 : -1;

		while ( offset !== 0 ) {
			if ( mode === 'col' ) {
				col += dir;
				// Out of bounds
				if ( col >= matrix.getColCount( row ) ) {
					if ( wrap && row < matrix.getRowCount() - 1 ) {
						// Subtract columns in current row
						col -= matrix.getColCount( row );
						row++;
						wrapDir = 1;
					} else {
						break;
					}
				} else if ( col < 0 ) {
					if ( wrap && row > 0 ) {
						row--;
						// Add columns in previous row
						col += matrix.getColCount( row );
						wrapDir = -1;
					} else {
						break;
					}
				}
			} else {
				row += dir;
				if ( row >= matrix.getRowCount() || row < 0 ) {
					// Out of bounds
					break;
				}
			}
			nextCell = matrix.getCell( row, col );
			// Skip if same as current cell (i.e. merged cells), or null
			if ( !nextCell || nextCell.equals( cell ) ) {
				continue;
			}
			offset -= dir;
			cell = nextCell;
		}
		return cell;
	}

	fromCell = matrix.getCell( this.intendedFromRow, this.intendedFromCol );
	if ( fromColOffset ) {
		fromCell = adjust( 'col', fromCell, fromColOffset );
	}
	if ( fromRowOffset ) {
		fromCell = adjust( 'row', fromCell, fromRowOffset );
	}

	toCell = matrix.getCell( this.intendedToRow, this.intendedToCol );
	if ( toColOffset ) {
		toCell = adjust( 'col', toCell, toColOffset );
	}
	if ( toRowOffset ) {
		toCell = adjust( 'row', toCell, toRowOffset );
	}

	// Collapse to end/start if wrapping forwards/backwards
	if ( wrapDir > 0 ) {
		fromCell = toCell;
	} else if ( wrapDir < 0 ) {
		toCell = fromCell;
	}

	selection = new this.constructor(
		this.tableRange,
		fromCell.col,
		fromCell.row,
		toCell.col,
		toCell.row
	);
	selection.expand( doc );
	return selection;
};

/**
 * @inheritdoc
 */
ve.dm.TableSelection.prototype.equals = function ( other ) {
	return this === other || (
		!!other &&
		other.constructor === this.constructor &&
		this.tableRange.equals( other.tableRange ) &&
		this.fromCol === other.fromCol &&
		this.fromRow === other.fromRow &&
		this.toCol === other.toCol &&
		this.toRow === other.toRow
	);
};

/**
 * Get the number of rows covered by the selection
 *
 * @return {number} Number of rows covered
 */
ve.dm.TableSelection.prototype.getRowCount = function () {
	return this.endRow - this.startRow + 1;
};

/**
 * Get the number of columns covered by the selection
 *
 * @return {number} Number of columns covered
 */
ve.dm.TableSelection.prototype.getColCount = function () {
	return this.endCol - this.startCol + 1;
};

/**
 * Check if the table selection covers one or more full rows
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {boolean} The table selection covers one or more full rows
 */
ve.dm.TableSelection.prototype.isFullRow = function ( doc ) {
	var matrix = this.getTableNode( doc ).getMatrix();
	return this.getColCount() === matrix.getMaxColCount();
};

/**
 * Check if the table selection covers one or more full columns
 *
 * @param {ve.dm.Document} doc The document to which this selection applies
 * @return {boolean} The table selection covers one or more full columns
 */
ve.dm.TableSelection.prototype.isFullCol = function ( doc ) {
	var matrix = this.getTableNode( doc ).getMatrix();
	return this.getRowCount() === matrix.getRowCount();
};

/* Registration */

ve.dm.selectionFactory.register( ve.dm.TableSelection );
