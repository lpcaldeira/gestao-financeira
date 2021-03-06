module.exports = function(grunt) {

	"use strict";

	var isConnectTestRunning,
		rdefineEnd = /\}\);[^}\w]*$/,
		pkg = grunt.file.readJSON( "package.json" );

	function camelCase( input ) {
		return input.toLowerCase().replace( /[_/](.)/g, function( match, group1 ) {
			return group1.toUpperCase();
		});
	}

	function mountFolder( connect, path ) {
		return connect.static( require( "path" ).resolve( path ) );
	}

	function replaceConsts( content ) {
		return content

			// Replace Version
			.replace( /@VERSION/g, pkg.version )

			// Replace Date yyyy-mm-ddThh:mmZ
			.replace( /@DATE/g, ( new Date() ).toISOString().replace( /:\d+\.\d+Z$/, "Z" ) );
	}

	grunt.initConfig({
		pkg: pkg,
		connect: {
			options: {
				port: 9001,
				hostname: "localhost"
			},
			test: {
				options: {
					middleware: function ( connect ) {
						return [
							mountFolder( connect, "." ),
							mountFolder( connect, "test" )
						];
					}
				}
			}
		},
		jshint: {
			source: {
				src: [ "src/**/*.js", "!src/build/**" ],
				options: {
					jshintrc: "src/.jshintrc"
				}
			},
			grunt: {
				src: [ "Gruntfile.js" ],
				options: {
					jshintrc: ".jshintrc"
				}
			},
			metafiles: {
				src: [ "bower.json", "package.json" ],
				options: {
					jshintrc: ".jshintrc"
				}
			},
			test: {
				src: [ "test/**/*.js" ],
				options: {
					jshintrc: "test/.jshintrc"
				}
			},
			dist: {
				src: [ "dist/**/*.js" ],
				options: {
					jshintrc: "src/.dist_jshintrc"
				}
			}
		},
		dco: {
			current: {
				options: {
					exceptionalAuthors: {
						"rxaviers@gmail.com": "Rafael Xavier de Souza"
					}
				}
			}
		},
		mocha: {
			unit: {
				options: {
					log: true,
					urls: [
						"http://localhost:<%= connect.options.port %>/unit.html",
						"http://localhost:<%= connect.options.port %>/unit_unresolved.html"
					]
				}
			},
			functional: {
				options: {
					log: true,
					urls: [
						"http://localhost:<%= connect.options.port %>/functional.html"//,
						//"http://localhost:<%= connect.options.port %>/functional_unresolved.html"
					]
				}
			}
		},
		requirejs: {
			options: {
				dir: "dist/.build",
				appDir: "src",
				baseUrl: ".",
				optimize: "none",
				paths: {
					EventEmitter: "../bower_components/eventEmitter/EventEmitter"
				},
				skipSemiColonInsertion: true,
				skipModuleInsertion: true,

				// Strip all definitions generated by requirejs.
				// Convert content as follows:
				// a) "Single return" means the module only contains a return statement that is converted to a var declaration.
				// b) "Not as simple as a single return" means the define wrappers are replaced by a function wrapper call and the returned value is assigned to a var.
				// c) "Main" means the define wrappers are removed, but content is untouched. Only for main* files.
				onBuildWrite: function ( id, path, contents ) {
					var name = id
						.replace( /util\/|common\//, "" );

					if ( (/^EventEmitter$/).test( id ) ) {
						contents = contents
							.replace( /.*\buse strict\b.*/, "" )
							.replace( /(\(function \(\) {)/, "var EventEmitter;\n/* jshint ignore:start */\nEventEmitter = $1" )
							.replace( /\/\/ Expose the class either via AMD, CommonJS[\S\s]*}\.call\(this\)\);/, "return EventEmitter;\n}());\n/* jshint ignore:end */" );
						return contents;
					}

					// 1, and 2: Remove define() wrap.
					// 3: Remove empty define()'s.
					contents = contents
						.replace( /define\([^{]*?{/, "" ) /* 1 */
						.replace( rdefineEnd, "" ) /* 2 */
						.replace( /define\(\[[^\]]+\]\)[\W\n]+$/, "" ); /* 3 */

					// Type b (not as simple as a single return)
					if ( [ "item/lookup", "util/json/merge" ].indexOf( id ) !== -1 ) {
						contents = "	var " + camelCase( name ) + " = (function() {" +
							contents + "}());";
					}
					// Type a (single return)
					else if ( (/\//).test( id ) ) {
						contents = contents
							.replace( /	return/, "	var " + camelCase( name ) + " =" );
					}

					return contents;
				}
			},
			bundle: {
				options: {
					modules: [{
						name: "cldr",
						include: [ "core" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_core.js",
								endFile: "src/build/outro.js"
							}
						}
					}, {
						name: "cldr_event",
						include: [ "event" ],
						exclude: [ "core" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_event.js",
								endFile: "src/build/outro.js"
							}
						}
					}, {
						name: "cldr_supplemental",
						include: [ "supplemental" ],
						exclude: [ "core" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_supplemental.js",
								endFile: "src/build/outro.js"
							}
						}
					}, {
						name: "cldr_unresolved",
						include: [ "unresolved" ],
						exclude: [ "core" ],
						create: true,
						override: {
							wrap: {
								startFile: "src/build/intro_unresolved.js",
								endFile: "src/build/outro.js"
							}
						}
					}]
				}
			}
		},
		copy: {
			options: {
				processContent: function( content ) {

					// Remove leftover define created during rjs build
					content = content.replace( /define\(".*/, "" );

					// Embed VERSION and DATE
					return replaceConsts( content );
				}
			},
			dist_cldr: {
				expand: true,
				cwd: "dist/.build/",
				src: [ "cldr.js" ],
				dest: "dist/"
			},
			dist_modules: {
				expand: true,
				cwd: "dist/.build/",
				src: [ "cldr*.js", "!cldr.js" ],
				dest: "dist/cldr",
				rename: function( dest, src ) {
					return require( "path" ).join( dest, src.replace( /cldr_/, "" ) );
				}
			},
			dist_node_main: {
				src: "src/build/node_main.js",
				dest: "dist/node_main.js"
			}
		},
		uglify: {
			options: {
				banner: replaceConsts( grunt.file.read( "src/build/intro.min.js" ) )
			},
			dist: {
				files: {
					"tmp/cldr.min.js": [ "dist/cldr.js" ],
					"tmp/cldr/event.min.js": [ "dist/cldr/event.js" ],
					"tmp/cldr/supplemental.min.js": [ "dist/cldr/supplemental.js" ],
					"tmp/cldr/unresolved.min.js": [ "dist/cldr/unresolved.js" ]
				}
			}
		},
		compare_size: {
			files: [
				"tmp/cldr.min.js",
				"tmp/cldr/*min.js"
			],
			options: {
				compress: {
					gz: function( fileContents ) {
						return require( "gzip-js" ).zip( fileContents, {} ).length;
					}
				}
			}
		}
	});

	require( "matchdep" ).filterDev( "grunt-*" ).forEach( grunt.loadNpmTasks );

	grunt.registerTask( "test", function() {
		var args = [].slice.call( arguments );
		if ( !isConnectTestRunning ) {
			grunt.task.run( "connect:test" );
			isConnectTestRunning = true;
		}
		grunt.task.run( [ "mocha" ].concat( args ).join( ":" ) );
	});

	grunt.registerTask( "default", [
		"jshint:metafiles",
		"jshint:grunt",
		"jshint:source",
		"jshint:test",
		"test:unit",
		"requirejs",
		"copy",
		"jshint:dist",
		"test:functional",
		"uglify",
		"compare_size",
		"dco"
	]);

};

