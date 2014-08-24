#!/usr/bin/env node --harmony
// Copyright (C) 2014 OneJS
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//       http://www.apache.org/licenses/LICENSE-2.0
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

// ONEJS Runtime
"use strict"
global.ONE = {}

ONE.nodejs_boot_ = function(){
	// include other parts
	global.ONE = ONE
	require('./one_base.js')
	require('./one_parser.js')
	require('./one_genjs.js')
	require('./one_ast.js')

	ONE.init()
	ONE.init_ast()

	// load our first argument, parse dependencies and fire up
	var args = process.argv.slice()
	var watcher 
	for( var i = 0;i<args.length;i++){
		if(args[i] =='-w') args.splice(i,1), watcher = true
	}
	var root = args.length > 2 ? args[2] : 'index'
	root = root.replace(/\.n$/,"")
	var fs = require('fs')

	// make a little filewatcher and do auto restarting
	var stats = {}
	var watch = 'mtime'
	var watches = {}
	var delta = 0

	function watchFile(file){
		if(watches[file]) return
		stats[file] = fs.statSync(file)[watch].toString()
		watches[file] = setInterval(function(){
			var stat = fs.statSync(file)
			if(stat[watch].toString() != stats[file]){ 
				stats[file] = stat[watch].toString()
				if(Date.now() - delta > 2000){
					delta = Date.now()
					console.log('-- restarting -- '+Date())
					reload()
				}
			}
		},50)
	}

	function loadFile( obj, module ){
		var file = module +'.n'
		try{
			var code = fs.readFileSync(file).toString()
			if(watcher) watchFile( file )
		} 
		catch (e){
			console.log('Cant open '+file, e)
			process.exit(-1)
		}
		// skip #! header
		if(code.charCodeAt(0) == 35 &&
		   code.charCodeAt(1) == 33){
		   	var pos = 0, len = code.length
			while(pos < len) if(code.charCodeAt(++pos)==10) break
			code = code.slice(pos)
		}

		var ast = obj.parse('->{'+code+'\n}', file)
		ast.getDependencies().forEach(function(file){
			loadFile( obj, file )
		})
	//try{
		obj.$[module] = obj.eval(ast, module)

		//}catch(e){
			//console.log(e)
		//}
	}
	function reload(){
		var obj = ONE.Base.new()
		loadFile( obj, root )
		var call = obj.$[root]
		if(call)call.call(obj)
	}

	reload()
}

ONE.nodejs_boot_()
