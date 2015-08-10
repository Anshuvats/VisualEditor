/*!
 * VisualEditor Standalone Initialization Target class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * Initialization Standalone target.
 *
 * A platform must be constructed first. See ve.init.sa.Platform for an example.
 *
 *     @example
 *     ve.init.platform.initialize().done( function () {
 *         var target = new ve.init.sa.Target();
 *         target.addSurface(
 *             ve.dm.converter.getModelFromDom(
 *                 ve.createDocumentFromHtml( '<p>Hello, World!</p>' )
 *             )
 *         );
 *         $( 'body' ).append( target.$element );
 *     } );
 *
 * @class
 * @extends ve.init.Target
 *
 * @constructor
 * @param {Object} [config] Configuration options
 * @cfg {string} [surfaceType] Type of surface to use, 'desktop' or 'mobile'
 * @cfg {Object} [toolbarConfig] Configuration options for the toolbar
 * @throws {Error} Unknown surfaceType
 */
ve.init.sa.Target = function VeInitSaTarget( config ) {
	config = config || {};
	config.toolbarConfig = $.extend( { shadow: true, actions: true, floatable: true }, config.toolbarConfig );

	// Parent constructor
	ve.init.sa.Target.super.call( this, config );

	this.surfaceType = config.surfaceType || this.constructor.static.defaultSurfaceType;
	this.actions = null;

	switch ( this.surfaceType ) {
		case 'desktop':
			this.surfaceClass = ve.ui.DesktopSurface;
			break;
		case 'mobile':
			this.surfaceClass = ve.ui.MobileSurface;
			break;
		default:
			throw new Error( 'Unknown surfaceType: ' + this.surfaceType );
	}

	// The following classes can be used here:
	// ve-init-sa-target-mobile
	// ve-init-sa-target-desktop
	this.$element.addClass( 've-init-sa-target ve-init-sa-target-' + this.surfaceType );
};

/* Inheritance */

OO.inheritClass( ve.init.sa.Target, ve.init.Target );

/* Static properties */

ve.init.sa.Target.static.defaultSurfaceType = 'desktop';

ve.init.sa.Target.static.actionGroups = [
	{
		type: 'list',
		icon: 'menu',
		title: OO.ui.deferMsg( 'visualeditor-pagemenu-tooltip' ),
		include: [ 'findAndReplace', 'commandHelp' ]
	}
];

/* Methods */

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.addSurface = function () {
	var surface = ve.init.sa.Target.super.prototype.addSurface.apply( this, arguments );
	this.$element.append( $( '<div>' ).addClass( 've-init-sa-target-surfaceWrapper' ).append( surface.$element ) );
	if ( !this.getSurface() ) {
		this.setSurface( surface );
	}
	surface.initialize();
	return surface;
};

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.createSurface = function ( dmDoc, config ) {
	config = ve.extendObject( {
		includeCommands: this.constructor.static.includeCommands,
		excludeCommands: OO.simpleArrayUnion(
			this.constructor.static.excludeCommands,
			this.constructor.static.documentCommands,
			this.constructor.static.targetCommands
		),
		importRules: this.constructor.static.importRules
	}, config );
	return new this.surfaceClass( dmDoc, config );
};

/**
 * @inheritdoc
 */
ve.init.sa.Target.prototype.setupToolbar = function ( surface ) {
	// Parent method
	ve.init.sa.Target.super.prototype.setupToolbar.call( this, surface );

	this.getToolbar().$element.addClass( 've-init-sa-target-toolbar' );
	if ( !this.actions ) {
		this.actions = new ve.ui.TargetToolbar( this );
		this.getToolbar().$actions.append( this.actions.$element );
	}

	this.actions.setup( this.constructor.static.actionGroups, this.getSurface() );

	// HACK: On mobile place the context inside toolbar.$bar which floats
	if ( this.surfaceType === 'mobile' ) {
		this.getToolbar().$bar.append( surface.context.$element );
	}
};
