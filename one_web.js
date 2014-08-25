"use strict"
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

// ONEJS boot up fabric for webbrowser

ONE.worker_boot_ = function(host){

	host.onmessage = function(event){
		var data = event.data
		if(!Array.isArray(data)) throw new Error('non array message received')
		for(var i = 0, l = data.length; i < l; i++){
			var msg = data[i]
			
			if(msg._id == 'setter'){ // we have to set a value
				var obj = this.proxy_obj[msg.proxy_uid]
				if(!obj) throw new Error('set on nonexistant object ' + msg.proxy_uid)
				obj[msg.name] = msg.value
			}
			else if(msg._id == 'call'){
				var obj = this.proxy_obj[msg.proxy_uid]
				if(!obj) throw new Error('Call on nonexistant object ' + msg.proxy_uid)
				obj[msg.name].call(obj, msg.args)
			}
			else if(msg._id == 'eval'){ // lets parse and eval a module
				var ast = ONE.root.$['_' + msg.module]
				var dt = Date.now()
				if(!ast){
					return console.log('Module ' + msg.module + ' not parsed')
				}
				ONE.root.$[msg.module] = ONE.root.eval(ast, msg.module)
				//console.log('eval '+msg.module+' '+(Date.now()-dt)+'ms')
			}
			else if(msg._id == 'parse'){
				var dt = Date.now()
				ONE.root.$['_' + msg.module] = ONE.root.parse('->{' + msg.value + '\n}', msg.module)
				//console.log('parse '+msg.module+' '+(Date.now()-dt)+'ms')
			}
			else if(msg._id == 'run'){
				ONE.root.$[msg.module].call(ONE.root)
			}
		}
	}

	// message queueing
	host.msg_start = 0
	host.msg_queue = []
	host.msgFlush = function(){
		this.postMessage(this.msg_queue)
		this.msg_start = Date.now()
		this.msg_queue = []
	}.bind(host)

	host.sendToHost = function(msg){
		var now = Date.now()
		if(this.msg_queue.length && now - this.msg_start > 10){ // make sure we chunk every 20ms for parallelisation
			this.msg_queue.push(msg)
			this.msgFlush()
		}
		else{
			if(this.msg_queue.push(msg) == 1){
				this.msg_start = now
				setTimeout(this.msgFlush, 0)
			}
		}
	}

	host.proxy_obj = {}

	ONE.proxyInit = function(){
		var inits = ONE.proxy_inits
		ONE.proxy_inits = []
		for(var i = 0, l = inits.length; i<l; i++){
			inits[i].proxyInit()
		}
	}

	ONE.proxy_inits = []
	ONE.proxy_uid = 1
	ONE.proxy_free = []

	ONE.host = host

	ONE.init()
	ONE.init_ast()
	ONE.root = ONE.Base.new()
	ONE.root.__class__ = 'Root'
}

ONE.proxy_ = function(){


	this.Base.Proxy = this.Base.extend(function(){
		this._init = function(){
			if(!ONE.proxy_free.length) this.proxy_uid = ONE.proxy_uid++
			else this.proxy_uid = ONE.proxy_free.pop()

			if(typeof this.init == 'function') this.init.call(this, arguments)
			// queue our object up for sending it over to the other side
			if(ONE.proxy_inits.push(this) == 1){
				setTimeout(ONE.proxyInit, 0)
			}
		}

		this.proxyInit = function(){
			var msg = {_id:'spawn', proxy_uid: this.proxy_uid}

			var src = this.proxy()

			// if our compiler created any objects, lets init them first
			// otherwise our dependencies cannot be met
			if(ONE.proxy_inits.length){
				var inits = ONE.proxy_inits
				ONE.proxy_inits = []
				for(var i = 0, l = inits.length; i<l; i++){
					inits[i].proxy_init()
				}
			}

			msg.proxy_code = src
			// transfer proxied properties
			var props = this.proxy_props
			if(props){
				for(var k in props){
					var dist = props[k]

					var v = this[k]
					if(v === undefined){
						throw new Error('Trying to proxy prop ' + k + ' but is undefined dist(' + dist + ')')
					}
					if(v && v._signal_) msg[k] = v.value
					else msg[k] = v
				}
			}
			// transfer proxied references
			var refs = this.proxy_refs
			if(refs){
				for(var k in refs){
					if(!this[k]) throw new Error('Trying to proxy ref ' + k + ' but is undefined')
					msg[k] = this[k].proxy_uid
				}
			}
			
			var sigs = this.proxy_setters
			if(sigs){
				for(var i = 0;i<sigs.length;i++){
					msg[k] = this[sigs[k]] // copy current signal
				}
			}

			if(this.proxy_dump) msg.proxy_dump = 1

			ONE.host.sendToHost(msg)
		}
		
		this.proxy = function( methods ){
			if(!methods) methods = {init:this.init}

			var code = ''
			for(var key in methods){
				var method = methods[key]
				var proxy_code = method.proxy_code
				if(proxy_code){
					code += proxy_code
					continue
				}

				if(!method._ast_) throw new Error('invalid proxy method')
				var js = this.AST.ToJS
				js.new_state()
				js.module = method.module
				code += 'this.' + key + ' = ' + js.expand(method) + '\n'

				method.proxy_code = code
			}
			var refs = this.proxy_refs
			if(refs){
				for(var k in refs){
					// remote ID resolve with 'still undefined but might be soon' mode
					code += 'var res = module.worker.proxy_obj[this.' + k + ']\n'
					code += 'if(res === undefined) module.worker.proxy_obj[this.' + k + '] = [this, "'+k+'"]\n'
					code += 'else if(Array.isArray(res)) res.push(this, "'+k+'")\n'
					code += 'else this.'+k+' = res\n'
				}
			}

			var sigs = this.proxy_setters
			if(sigs){
				for(var i = 0;i<sigs.length;i++){
					var k = sigs[i]
					code += 'this.__' + k + ' = this.'+k+'\n'
					code += 'this.__defineGetter__("'+k+'",function(){ return this.__'+k+' })\n'
					code += 'this.__defineSetter__("'+k+'",function(v){ this.__'+k+' = v; module.worker.sendToWorker({_id:"setter", name:"' +  k + '", proxy_uid:this.proxy_uid, value:v})})\n'
				}
			}

			return code
		}

		this.proxyCall = function(name){
			if(arguments.length > 1){
				ONE.host.sendToHost({_id:"call", name:name, proxy_uid: this.proxy_uid, args:Array.prototype.slice.call(arguments,1)})
			}
			else ONE.host.sendToHost({_id:"call", name:name, proxy_uid: this.proxy_uid})
		}

	})
}

ONE._createWorker = function(){
	var dt = Date.now()
	var source =
		'\nONE = {}' +
		'\nvar Assert'+
		'\nONE.init = ' + ONE.init.toString() +
		'\nONE.init_ast = ' + ONE.init_ast.toString() +
		'\nONE.base_ = ' + ONE.base_.toString() +
		'\nONE.proxy_ = ' + ONE.proxy_.toString() +
		'\nONE.ast_ = ' + ONE.ast_.toString() +
		'\nONE.genjs_ = ' + ONE.genjs_.toString() +
		'\nONE.genjs_compat_ = ' + ONE.genjs_compat_.toString() +
		'\nONE.color_ = ' + ONE.color_.toString() +
		'\nONE.parser_strict_ = ' + ONE.parser_strict_.toString() +
		'\nONE.worker_boot_ = ' + ONE.worker_boot_.toString() +
		'\nONE.worker_boot_(self)'

	var blob = new Blob([source], { type: "text/javascript" })
	this._worker_url = URL.createObjectURL(blob)
	var worker = new Worker(this._worker_url)
	return worker
}

// Bootstrap code for the browser, started at the bottom of the file
ONE.browser_boot_ = function(){

	var fake_worker = true
	var worker
	
	// fake worker for debugging
	if(fake_worker){
		worker = {
			postMessage: function(msg){
				host.onmessage({data:msg})
			},
			onmessage:function(){}
		}
		var host = {
			postMessage: function(msg){
				worker.onmessage({data:msg})
			},
			onmessage: function(){}
		}
		ONE.worker_boot_(host)
	}
	else worker = ONE._createWorker()

	worker.proxy_cache = {}
	worker.proxy_obj = {}
	var dt = 0

	worker.msg_start = 0
	worker.msg_queue = []

	worker.msgFlush = function(){
		this.postMessage(this.msg_queue)
		this.msg_start = Date.now()
		this.msg_queue = []
	}.bind(worker)

	worker.sendToWorker = function(msg){
		var now = Date.now()
		if(this.msg_queue.length && now - this.msg_start > 10){ // make sure we chunk every 20ms for parallelisation
			this.msg_queue.push(msg)
			this.msgFlush()
		}
		else{
			if(this.msg_queue.push(msg) == 1){
				this.msg_start = now
				setTimeout(this.msgFlush, 0)
			}
		}
	}

	var proxy_module = {
		worker:worker
	}

	worker.onmessage = function(event){
		var data = event.data
		// we have to create an object
		if(Array.isArray(data)){

			for(var i = 0, l = data.length;i < l;i++){
				var msg = data[i]
				if(msg._id == 'signal'){ // we have to set a value
					var obj = this.proxy_obj[msg.proxy_uid]
					if(!obj) throw new Error('Signal set on nonexistant object ' + msg.proxy_uid)
					obj['__' + msg.name] = msg.value
				}
				else if(msg._id == 'call'){
					var obj = this.proxy_obj[msg.proxy_uid]
					if(!obj) throw new Error('Call on nonexistant object ' + msg.proxy_uid)
					obj[msg.name].call(obj, msg.args)
				}
				if(msg._id == 'spawn'){

					var obj = msg

					// is late resolve array
					var arr = worker.proxy_obj[obj.proxy_uid]
					if(arr){
						for(var j = 0, m = arr.length; j<m; j+=2){
							arr[j][arr[j+1]] = obj
						}
					}
					worker.proxy_obj[obj.proxy_uid] = obj

					if(obj.proxy_dump) console.log(obj)

					var code = obj.proxy_code
					var init = worker.proxy_cache[code]
					if(!init){
						try{
							init = worker.proxy_cache[code] = Function('module', code)
						}
						catch(e){
							console.log("Error in proxy_code ",e, code)
						}
					}
					// initialize object
					init.call(obj, proxy_module)
					if(obj.init) obj.init()
					//console.log(obj)
				}
			}
		}
	}

	if(!fake_worker) ONE.init()

	function module_get( url, module ){
		return ONE.Base.wrapSignal(function(sig){
			var elem = document.getElementById(module)
			if(elem){
				var value = elem.innerHTML
				worker.sendToWorker({_id:'parse', module:module, value:value})
				return sig.end(value)
			}
			// do some XMLHTTP
			var pthis = this
			var req = new XMLHttpRequest()
			req.open("GET",url,true)
			req.onreadystatechange = function(){
				if(req.readyState == 4){
					if(req.status != 200) return sig.throw(req.status)
					var value = req.responseText
					worker.sendToWorker({_id:'parse', module:module, value:value})
					return sig.end(value)
				}
			}
			req.send()
		})
	}
	
	var type = "main"
	var root

	if(location.hash){
		root = location.hash.slice(1)
		var hack = location.hash.indexOf('?')
		if(hack !== -1) root = root.slice(0,hack-1)
	}
	else root = type
	
	function init(){

		var loader = {}
		// when do we resolve a module? when all its deps have been loaded.
		function load_dep( module ){
			// lets load a module
			return ONE.Base.wrapSignal(function(sig){
				var url = module + '.n'
				var data_sig = loader[module]
				var first = false
				if(!data_sig){
					first = true
					data_sig = loader[module] = module_get(url, module)
				}
				// otherwise we only resolve sig
				data_sig.then(function(value){
					// okay lets scan for our dependencies
					var all = []
					value.replace(/import\s+(\w+)/g, function(m, mod){
						all.push(load_dep(mod))
					})
					ONE.Base.allSignals(all).then(function(){
						if(first) worker.sendToWorker({_id:'eval', module:module})
						else first = false
						sig.end()
					}, 
					function(err){
						sig.throw(err)
					})
				}, 
				function(err){
					sig.throw(err)	
				})
			})
		}
		
		load_dep(root).then(function(){
			worker.sendToWorker({_id:'run', module:root})	
		})
	}
	if(location.hostname.match(/(.*?)\.onejs\.io/)){
		// we are packed, wait 
		window.addEventListener("load", init)
	}
	else {
		init()
	}

	// initialize ONEJS also on the main thread	
	if(!fake_worker) ONE.init_ast()
	if(location.hash) ONE.reloader()
		
	window.onerror = function(msg, url, line) {
		var name = url.match(/[^\/]*$/)[0]
		ONE.error(msg + ' in '+name+' line '+line)
		return false
	}
} 

ONE.browser_boot_()