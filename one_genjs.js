
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

ONE.genjs_ = function(){

	this.typeMap = Object.create(null)
	this.typeMap.bool    = { size:1, slots:1, view:'Int32', name:'bool', prim:1, _type_:1 }
	this.typeMap.int8    = { size:1, slots:1, view:'Int8', name:'int8', prim:1, _type_:1 }
	this.typeMap.uint8   = { size:2, slots:1, view:'Uint8', name:'uint8', prim:1, _type_:1 }
	this.typeMap.int16   = { size:2, slots:1, view:'Int16', name:'int16', prim:1, _type_:1 }
	this.typeMap.uint16  = { size:2, slots:1, view:'Uint16', name:'uint16', prim:1, _type_:1 }
	this.typeMap.int     = { size:4, slots:1, view:'Int32', name:'int', prim:1, _type_:1 }
	this.typeMap.int32   = { size:4, slots:1, view:'Int32', name:'int32', prim:1, _type_:1 }
	this.typeMap.uint32  = { size:4, slots:1, view:'Uint32', name:'uint32', prim:1, _type_:1 }
	this.typeMap.float   = { size:4, slots:1, view:'Float32', name:'float', prim:1, _type_:1 }
	this.typeMap.float32 = { size:4, slots:1, view:'Float32', name:'float32', prim:1, _type_:1 }
	this.typeMap.double  = { size:8, slots:1, view:'Float64', name:'double', prim:1, _type_:1 }
	this.typeMap.float64 = { size:8, slots:1, view:'Float64', name:'float64', prim:1, _type_:1 }
	this.viewSize = {
		Int8:1,
		Uint8:1,
		Int16:2,
		Uint16:2,
		Int32:4,
		Uint32:4,
		Float32:4,
		Float64:8
	}

	this.fieldAliases = {
		'r':'x','g':'y','b':'z','a':'w',
		's':'x','t':'y','p':'z','q':'w',
	}

	// copies a type structure to prepare it for caching
	this.typeCopy = function(input, nomethods){
		var output = {}
		output._type_ = 1
		
		for(var field_name in input.fields){
			if(!output.fields) output.fields = {}
			output.fields[field_name] =  this.typeCopy(input.fields[field_name], 1)
		}
		if(input.name !== undefined) output.name = input.name
		if(input.prim !== undefined) output.prim = input.prim
		if(input.size !== undefined) output.size = input.size
		if(input.slots !== undefined) output.slots = input.slots
		if(input.view !== undefined) output.view = input.view
		if(input.off !== undefined) output.off = input.off
		if(input.dim !== undefined) output.dim = input.dim
		for(var mapping_name in input.mappings){
			if(!output.mappings) output.mappings = {}
			output.mappings[mapping_name] = input.mappings[mapping_name]
		}
		if(!nomethods){
			// fix constructor list
			//output.construct = input.construct
			for(var method_name in input.methods){
				if(!output.methods) output.methods = {}
				var method = input.methods[method_name]
				this.Clean.run(method)
				output.methods[method_name] = method
			}
		}
		return output
	}

	// horrible way to deal with json not having prototypical inheritance
	this.typeBase = function(type){
		if(type.dim !== undefined){
			var sub = Object.create(type)
			sub.dim = undefined
			return sub
		}
		return type
	}

	this.ToJS = this.ToCode.extend(this, function(outer){
		
		this.newline = '\n'
		
		this.promise_catch = 1
		this.expand_short_object = 1
		
		this.destruc_prefix = '_\u0441'
		this.desarg_prefix = '_\u0430'
		this.tmp_prefix = '_\u0442'
		this.call_tmpvar = '_\u0441'
		this.store_prefix = '_\u0455'
		this.template_marker = '\_\u0445_'
		this.template_regex = /\_\u0445\_/g

		this.new_state = function(module){
			this.signals = []
			this.line = 0
			this.scope = Object.create(null)
			this.locals = undefined
			this.type_methods = Object.create(null)
			this.macro_args = Object.create(null)
			this.module = module || Object.create(null)
			this.module.imports = []
			this.module.types = Object.create(outer.typeMap)
			this.module.defines = Object.create(null)
			this.module.macros = Object.create(null)
			this.module.exports = Object.create(null)
			this.module.parser_cache = Object.create(null)
			this.module.local_types = Object.create(null)
		}
		
		this.pull_flags = function(n){
			var steps
			if(n.body && (steps = n.body.steps) && steps[0] && steps[0].flag == 35){
				var ret = steps[0].name
				steps.splice(0, 1)
				return ret
			}
			return ''
		}

		this.check_swizzle = function( key_name, slots ){
			if(key_name.length <= 1 && key_name.length > 4) return
			var i = 0
			var ch
			var l = key_name.length
			var out = []
			if(slots == 2){
				while(i < l){ // xy
					ch = key_name.charCodeAt(i++)
					if(ch == 120) out.push(0)
					else if(ch == 121) out.push(1)
					else {i = 0;break}
				}
				while(i < l){ // rg
					ch = key_name.charCodeAt(i++)
					if(ch == 114) out.push(0)
					else if(ch == 103) out.push(1)
					else {i = 0;break}
				}
				while(i < l){ // st
					ch = key_name.charCodeAt(i++)
					if(ch == 115) out.push(0)
					else if(ch == 116) out.push(1)
					else {i = 0;break}
				}
			}
			else if(slots == 3){
				while(i < l){ // xyz
					ch = key_name.charCodeAt(i++)
					if(ch == 120) out.push(0)
					else if(ch == 121) out.push(1)
					else if(ch == 122) out.push(2)
					else {i = 0;break}
				}
				while(i < l){ // rgb
					ch = key_name.charCodeAt(i++)
					if(ch == 114) out.push(0)
					else if(ch == 103) out.push(1)
					else if(ch == 98) out.push(2)
					else {i = 0;break}
				}
				while(i < l){ // stp
					ch = key_name.charCodeAt(i++)
					if(ch == 115) out.push(0)
					else if(ch == 116) out.push(1)
					else if(ch == 112) out.push(2)
					else {i = 0;break}
				}
			}
			else if(slots == 4){
				while(i < l){ // xyzw
					ch = key_name.charCodeAt(i++)
					if(ch == 120) out.push(0)
					else if(ch == 121) out.push(1)
					else if(ch == 122) out.push(2)
					else if(ch == 119) out.push(3)
					else {i = 0;break}
				}
				while(i < l){ // rgba
					ch = key_name.charCodeAt(i++)
					if(ch == 114) out.push(0)
					else if(ch == 103) out.push(1)
					else if(ch == 98) out.push(2)
					else if(ch == 97) out.push(3)
					else {i = 0;break}
				}
				while(i < l){ // stpq
					ch = key_name.charCodeAt(i++)
					if(ch == 115) out.push(0)
					else if(ch == 116) out.push(1)
					else if(ch == 112) out.push(2)
					else if(ch == 113) out.push(3)
					else {i = 0;break}
				}				
			}
			if(i == l) return out
		}
		
		var globals = this.globals = Object.create(null)
		globals.Object = 1
		globals.Array = 1
		globals.String = 1
		globals.Number = 1
		globals.Date = 1
		globals.Boolean = 1
		globals.Error = 1
		globals.Math = 1
		globals.RegExp = 1
		globals.Function = 1
		globals.undefined = 1
		globals.Int8Array = 1
		globals.Float32Array = 1
		globals.Float64Array = 1
		globals.Int16Array = 1
		globals.Int32Array = 1
		globals.Uint8Array = 1
		globals.Uint16Array = 1
		globals.Uint32Array = 1
		globals.Uint8ClampedArray = 1
		globals.ParallelArray = 1
		globals.Map = 1
		globals.Set = 1
		globals.WeakMap = 1
		globals.WeakSet = 1
		globals.ArrayBuffer = 1
		globals.DataView = 1
		globals.JSON = 1
		globals.Iterator = 1
		globals.Generator = 1
		globals.Promise = 1
		globals.XMLHttpRequest = 1
		globals.Intl = 1
		globals.arguments = 1
		globals.isNaN = 1
		globals.isFinite = 1
		globals.parseFloat = 1
		globals.parseInt = 1
		globals.decodeURI = 1
		globals.decodeURIComponent = 1
		globals.encodeURI = 1
		globals.encodeURIComponent = 1
		globals.escape = 1
		globals.unescape = 1
		globals.setInterval = 1
		globals.clearInterval = 1
		globals.setTimeout = 1
		globals.clearTimeout = 1
		globals.setImmediate = 1
		globals.console = 1
		globals.__module__ = 1
		globals.window = 1
		globals.document = 1
		globals.navigator = 1
		globals.Buffer = 1
		globals.require = 1
		globals.process = 1
		globals.__dirname = 1
		globals.ONE = 1
		globals.self = 1

		this.find_type = function( name ){
			var type
			if(this.generics){
				type = 	this.generics[name]
				if(type) return type
			}
			type = this.module.types[name]
			if(type) return type

			var im = this.module.imports
			for(var i = 0, l = im.length; i < l;i++){
				var types = im[i].types
				if(types && (type = types[name])) return type
			}
		}
		
		this.find_define = function( name ){
			var def = this.module.defines[name]
			if(def) return def
			var im = this.module.imports
			for(var i = 0, l = im.length; i < l; i++){
				var defines = im[i].defines
				if(defines && (def = defines[name])) return def
			}
		}

		// destructuring helpers
		this._destrucArrayOrObj = function(v, acc, nest, fn, vars){
			// alright we must store our object fetch on a ref
			if(nest >= fn.destruc_vars) fn.destruc_vars = nest + 1
			
			var ret = ''
			var od = this.depth
			this.depth = this.depth + this.indent
			
			ret += '(' + this.destruc_prefix + nest + '=' + this.destruc_prefix +
				(nest - 1) + acc + ')===undefined||(' + this.newline + this.depth
			
			if(v.type == 'Object') ret += this._destrucObject(v, nest + 1, fn, vars)
			else ret += this._destrucArray(v, nest + 1, fn, vars)
			
			this.depth = od
			ret += this.newline+this.depth + ')'
			
			return ret
		}
		
		this._destrucArray = function(arr, nest, fn, vars){
			var ret = ''
			var elems = arr.elems
			var midrest
			var tmpvar = this.destruc_prefix +(nest - 1)
			for(var i = 0;i<elems.length;i++){
				var v = elems[i]
				if(!v) continue
				var acc
				if(midrest){
					acc = '['+tmpvar+'.length-'+(elems.length - i)+']'
				}
				else acc = '[' + i + ']'
				
				if(v.type == 'Rest'){
					if(midrest){
						throw new Error('cannot have multiple rest variables in one destructure array')
					}
					if(!v.id){
						midrest = i + 1
						continue
					}
					if(v.id.type !=='Id') throw new Error('Unknown rest id type')
					if(i) ret += ',' + this.newline + this.depth
					var name = v.id.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					// what if we have elems following?
					ret += name + '=' + tmpvar
					if(i < elems.length - 1) ret += '.slice('+i+')'
					else {
						midrest = i + 1
						ret += '.slice('+i+',' + (elems.length - i)+')'
					}
				}
				else if(v.type == 'Id') {
					if(i) ret += ',' + this.newline + this.depth
					var name = v.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					ret += name + '='+ tmpvar + acc
				}
				else if(v.type == 'Object' || v.type == 'Array') {
					if(i) ret += ',' + this.newline + this.depth
					ret += this._destrucArrayOrObj(v, acc, nest, fn, vars)
				}  else throw new Error('Cannot destructure array item '+i)
			}
			return ret
		}
		
		this._destrucObject = function( obj, nest, fn, vars ){
			var ret = ''
			var keys = obj.keys
			for(var i = 0;i<keys.length;i++){
				var k = keys[i]
				var acc
				if(k.key.type == 'Value'){
					acc = '['+k.key.raw+']'
				} else acc = '.'+k.key.name
				var v = k.value
				if(k.short){
					// lets output a prop
					if(i) ret += ',' + this.newline + this.depth
					var name = k.key.name
					if(vars) vars.push(k.key)
					else name = this.resolve(name)
					ret += name + '='+this.destruc_prefix+(nest - 1)+acc
				}
				else if(v.type == 'Id') {
					if(i) ret += ',' + this.newline + this.depth
					var name = v.name
					if(vars){ vars.push(v); if(v.flag == 46) name = 'this.'+name}
					else name = this.resolve(name)
					ret += name + '='+this.destruc_prefix +(nest - 1)+acc
				}
				else if(v.type == 'Object' || v.type == 'Array') {
					if(i) ret += ',' + this.newline + this.depth
					ret += this._destrucArrayOrObj(v, acc, nest, fn, vars)
				}
				else throw new Error('Cannot destructure property '+acc)
			}
			return ret
		}
		
		this.destructure = function( n, left, init, fn, vars, def ){
			if(!fn) throw new Error('Destructuring assign cant find enclosing function')
			if(!fn.destruc_vars) fn.destruc_vars = 1
			
			var ret = ''
			var olddepth = this.depth
			this.depth = this.depth + this.indent
			
			if( init )
				ret = '((' + this.destruc_prefix + '0=' + (def? def + '||': '') +
					(typeof init == 'string'?init:this.expand( init, n )) +
					')===undefined || (' + this.newline + this.depth
			else{
				if(!def) throw new Error('Destructuring assignment without init value')
				ret = '(' + this.destruc_prefix + '0=' + (def?def:'') + ',(' + this.newline + this.depth
			}
			
			if( left.type == 'Object' ) ret += this._destrucObject(left, 1, fn, vars)
			else ret += this._destrucArray(left, 1, fn, vars)
			
			this.depth = olddepth
			ret += this.newline + this.depth+'))' + this.newline
			return ret
		}
		
		this.store = function(n, value ){
			var ret = value
			if(n.store & 1){
				var fn = this.find_function( n )
				if(!fn.store_var) fn.store_var = 1
				ret = '(' + this.store_prefix + '=' + ret + ')'
			}
			if(n.store & 2) throw new Error("Postfix ! not implemented")
			if(n.store & 4 || n.store & 8){
				ret = 'ONE.trace(' + ret + ')'
			}
			return ret
		}
		
		this.resolve = function( name, n ){
			// TODO make this resolve order explicit
			if(this.macro_args && name in this.macro_args){
				return this.macro_args[name]//this.expand(this.macro_args[name], n)
			}
			var type = this.type_method, field
			if(type && (field = type.fields[name])){
				//return '_.'+type.arr+'[_.o+'+(field.off / outer.viewSize[type.view])+']'
				return '_['+(field.off / outer.viewSize[type.view])+']'
			}
			
			if(name in this.scope){
				var type = this.scope[name]
				if(n && typeof type == 'object'){
					n.infer = type
				}
				return name
			}

			if(this.locals && name in this.locals){
				return '__locals__.'+name
			}

			if(name in this.globals) return name
			
			var type = this.find_type(name)
			if(type){

				// lets make this type av on module
				this.module.local_types[type.name] = outer.typeBase(type)
				return '__module__.local_types.'+type.name
			}

			var def = this.find_define(name)
			
			if(def){
				return this.expand(def, n)
			}
			if(n) n.onthis = 1

			if(this.context_resolve){
				var ret = this.context_resolve(name, n)
				if(ret !== undefined) return ret
			}

			return 'this.'+name
		}
		
		this.block = function( n, parent, noindent ){ // term split array
			var old_depth = this.depth
			if(!noindent) this.depth += this.indent
			var ret = ''
			for(var i = 0; i < n.length; i++){
				var step = n[ i ]
				var blk = this.expand(step, parent)
				
				if(this.template_marked){
					if(blk.indexOf(this.template_marker)!= -1){
						// lets loop blk n times
						var type = this.type_method
						if(!type) throw new Error('template found but no type_method')
						var total = type.slots
						for(var j = 0; j < total; j++){
							ret += this.depth + blk.replace(this.template_regex, j) + '\n'
						}
						var ch = ret[ret.length - 1]
						if(ch !== '\n' ){
							ret += this.newline, this.line++
						}
					}
					this.template_marked = false
				}
				else if(blk!==''){
					if(blk[0] == '(' || blk[0] == '[') ret += this.depth + ';' + blk
					else ret += this.depth + blk
				}
				
				var ch = ret[ret.length - 1]
				if(ch !== '\n' && (blk!=='') ){
					ret += this.newline, this.line++
				}
			}
			this.depth = old_depth
			return ret
		}
		
		this.Id = function( n ){
			var flag = n.flag
			if( flag ){
				if(flag === -1){
					var fn = this.find_function(n)
					if(!fn.store_var) throw new Error("Storage .. operator read but not set in function")
					return this.store_prefix
				}
				if(flag === 35){
					if(!n.name){
						if(!this.type_method) throw new Error('Type method template found outside of type_method')
						this.template_marked = true
						return this.template_marker
					}
					n.infer =this.module.local_types.vec3 = this.find_type('vec3')
					return 'ONE.color("'+n.name+'", __module__.local_types.vec3)'
				}
			}
			if(n.typing){
				if(n.typing.type == 'Id'){
					var type = this.find_type(n.typing.name)
					if(type){
						n.infer = type
					}
				}
				if(n.typing.type == 'Index'){
					var type = this.find_type(n.typing.object.name)
					if(type){
						n.infer = Object.create(type)
						n.infer.dim = 1
					}
				}
			}
			return this.resolve( n.name, n )
		}
		
		this.Value = function( n ){
			if(n.raw === undefined) return n.value
			if(n.kind == 'string' && n.raw[0] == '`'){
				return '"'+n.raw.slice(1,-1).replace(/\r?\n/g,'\\n').replace(/"/g,'\\"')+'"'
			}
			if(n.multi){
				if(n.kind == 'regexp') return n.value
				return n.raw.replace(/\r?\n/g,'\\n')
			}
			if(n.kind == 'num'){
				var ch = n.raw.charCodeAt(1)
				if(ch == 79 || ch == 111 || ch == 66 || ch == 98){
					return n.value
				}
			}
			return n.raw
		}
		
		this.decodeStructAccess = function( n ){
			var node = n

			if(node.type == 'Index' && !node.index) throw new Error('Cannot do empty index')
			if(node.type == 'Index' && node.object.type == 'Id' && node.index && node.index.name == "" && node.index.flag == 35){
				return node.object.name + '[' + this.expand(node.index, n) + ']'
			}

			while(node){
				if(node.type == 'Id' || node.type == 'Call'){
					var base, type, calldebug
					if(node.type == 'Call'){
						if(!node.infer) return
						base = this.expand(node, node.parent)
						type = node.infer
					}
					else{
						// check
						base = this.expand(node, node.parent)
						type = node.infer && node.infer._type_ ? node.infer : this.scope[base]
					}
					// lookup type on context object
					var ctx
					if(!type && this.context && (ctx = this.context[node.name])){
						if(ctx._t_) type = ctx._t_
					}
					var isthis
					var mapping
					var mapoff = ''
					//!TODO why was this again ->
					if(typeof type == 'object' && type._type_ || (isthis = type = this.type_method)){
						// alright so now we need to walk back down
						// the parent chain and decode our offset
						if(!isthis) node = node.parent
						else base = '_'

						// if we access [#] just return the base
						if(type.size == 0) throw new Error("Trying to access member on abstract value")
						var off = 0, field = type
						var idx = ''
						var swiz
						for(;;){
							// if we are doing an index, we have to have an array type
							if(node.index){
								//if(node.object.index) throw new Error('Dont support double indexes on structs')
								// we can only support indexes on fields with primitive
								// subtypes or on fields with dimensions.
								if(field.dim === undefined && field.prim) throw new Error('cannot index primitive field '+outer.AST.toString(n)+' '+n.infer)
								if(!field.size) throw new Error('cannot index 0 size field '+outer.AST.toString(n))
								
								// so if we have dim, we want index calcs.
								if(idx!=='') idx += '+'
								if(field.dim !== undefined){
									idx += '('+this.expand(node.index, n) + ')*' + (field.size / outer.viewSize[type.view]) 
									if(mapping && type == field){
										// lets add our mapping multiplier
										idx = '('+idx+')*' + mapping[0]
										if(mapping[1] != 0) mapoff = '+' + type.slots * mapping[1]
									}
									field = outer.typeBase(field)
									//Object.getPrototypeOf(field)
								}
								else{

									if(node.index.type != 'Value') throw new Error('Cannot use dynamic index on non array struct')
									var ic = node.index.value
									idx += '('+this.expand(node.index, n) + ')'
									var i =0
									for(var k in field.fields){
										if(i == ic){
											field = field.fields[k]
											break
										}
										i++
									}
									if(i != ic) throw new Error('Cannot find field with index '+ic + ' on struct')
								}
							}
							else {
								var fname = node.key && node.key.name || node.name
								if(fname == 'length' && field.dim !== undefined){
									if(field == type){
										if(mapping){
											if(n.parent.type == 'Assign' || n.parent.type == 'Update')
												n.infer_multiply = mapping[0]
											else
												return base  + '.length/'+mapping[0]
										}
										return base + '.length'
									}
									return field.dim
								}
								if(field.dim !== undefined){
									// someone is trying to access a field, lets see if its a mapping
									mapping = field.mappings[fname]
									if(field.name != type.name && mapping)
										throw new Error('Cannot access mapping on substructure')
									if(!mapping){
										console.log(field)
										throw new Error('Accessing field on array '+ fname + ' ' +outer.AST.toString(n))
									}
								}
								else{
									var next_field = field.fields[fname]
									if(!next_field){
										// what i want is an array saying
										// check for swizzling.
										var swiz = this.check_swizzle( fname, field.slots )
										if(swiz) break
										throw new Error('Invalid field '+ fname + ' ' +outer.AST.toString(n))
									}
									field = next_field
									off += field.off
								}
							}
							if(node == n) break
							node = node.parent
						}
						// alright so what we can do is actually take the pointer and assign to it
						// minimize the offset
						var dt = (off / outer.viewSize[type.view])
						var voff = idx
						if(dt){
							if(voff!=='') voff += '+' + dt
							else voff = dt
						}
						else if(voff == '') voff = '0'

						if(swiz && n.parent && n.parent.type != 'Assign'){
							var prep = 'vec'
							if(type.name.charAt(0) == 'i') prep = 'ivec'
							if(type.name.charAt(0) == 'b') prep = 'bvec'

							var ret_type = this.find_type(prep+swiz.length)
							// pick the return type
							this.find_function(n).call_var = 1
							var output = this.call_tmpvar
							
							this.module.local_types[ret_type.name] = ret_type
							var ret = '('+output+'= new '+ret_type.view+'Array(' + swiz.length + '),' + 
										output + '._t_=__module__.local_types.' + ret_type.name

							for(var i = 0;i<swiz.length;i++){
								ret += ','+output+'['+i+'] = ' + base + '[' + voff + mapoff + '+' + swiz[i] + ']'
							}
							ret += ',' + output + ')'
							return ret
						}
						//console.log(node,field)
						if(type.dim !== undefined) base += '._array_'
						//(!node.index || field.dim !== undefined || field.name==type.name && mapping) && 
						if(!field.prim){
							n.infer = field
							n.infer_struct = 1
							if(swiz){
								// lets check the swizzle againt duplicates
								for(var i = 0;i<swiz.length;i++){
									for(var j = 0;j<swiz.length;j++){
										if(i!=j && swiz[i] == swiz[j]){
											throw new Error('Cannot assign to duplicate swizzle field')
										}
									}
								}
								n.infer_swiz = swiz
							}
							// translate this to a new Array
							this.find_function(n).call_var = 1
							n.infer_base = base
							n.infer_offset = voff
							if(mapping) n.infer_mapping = mapping, n.infer_maptype = type
							voff += mapoff
							if(voff == '0') return base
							this.module.local_types[type.name] = outer.typeBase(type)
							return '('+this.call_tmpvar+'='+base+'.subarray(' + voff + ','+voff + '+' + field.slots + '),'+
								this.call_tmpvar+'._t_=__module__.local_types.'+type.name+','+this.call_tmpvar+')'
						}
						if(mapping){
							n.infer_base = base
							n.infer_offset = voff
							n.infer_mapping = mapping
							n.infer_maptype = type
 						}
						return base + '[' + voff+ mapoff+ ']'
					}
				}
				if(node.type != 'Key' && node.type != 'Index') break
				node.object.parent = node
				node = node.object
			}
		}
		
		this.Index = function( n ){
			var ret = this.decodeStructAccess(n)
			if(ret) return ret
			var obj = n.object
			var object = this.expand(obj, n)
			var object_t = obj.type
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
				object = '(' + object + ')'
			
			return object + '[' + this.expand(n.index, n) + ']'
		}
		
		this.Key = function( n ){
			if(n.key.type !== 'Id') throw new Error('Unknown key type')
			
			// do static memory offset calculation for typed access
			var ret = this.decodeStructAccess(n)
			if(ret) return ret

			var key = n.key
			var obj = n.object
			
			var object = this.expand(obj, n)
			var object_t = obj.type
			
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This')
				object = '(' + object + ')'
						
			if(n.exist){
				var tmp = this.alloc_tmpvar(n)
				return '((' + tmp + '=' + object + ') && ' + tmp + '.' + n.key.name + ')'
			}
			return object + '.' + n.key.name
		}
		
		this.Array = function( n ){
			//!TODO x = [\n[1]\n[2]] barfs up with comments
			
			var elems = n.elems
			var elemlen = n.elems.length
			for(var i = 0; i < elemlen; i++){
				if(elems[i].type == 'Rest') break
			}
			
			// do the splat transform
			if(i != elemlen){
				var ret = ''
				var last = 0
				for(var i = 0; i < elemlen; i++){
					var elem = elems[i]
					if(elem.type == 'Rest'){
						// alright so we check what we have.
						if(i == 0){
							var id = elem.id
							if(id === undefined  || id.name == 'arguments'){
								ret = 'Array.prototype.slice.call(arguments,0)'
							}
							else ret = 'Array.prototype.slice.call('+this.expand(id, n)+',0)'
						}
						else{
							if(last == 1) ret += ']'
							else if(last == 2) ret += ')'
							var id = elem.id
							if(id === undefined  || id.name == 'arguments'){
								ret = 'Array.prototype.concat.apply('+ret+','+this.space+'arguments)'
							}
							else{
								ret = 'Array.prototype.concat.apply('+
									ret+','+this.expand(id, n) +')'
							}
						}
						last = 3
					}
					else { // normal arg
						if(last == 0){ // nothing before us
							ret += '['
							last = 1
						}
						else if(last == 3){ // an array before us
							ret += '.concat('
							last = 2
						}
						else { // a normal value
							ret += ',' + this.space
						}
						ret += this.expand(elem, n)
					}
				}
				if(last == 1) ret += ']'
				else if(last == 2) ret += ')'
			}
			else {
				var ret = '['+
					this.list( n.elems, n ) +
				']'
			}
			return ret
		}
		
		this.Enum = function( n ){
			// okay lets convert our enum structure into an object on this.
			// we can accept a block with steps of type assign
			// and a lefthandside of type id
			// right hand side is auto-enumerated when not provided
			
			var name = n.id.name
			
			this.scope[name] = 1
			
			
			var ret = 'var '+name+' = this.'+name+' = '
			
			var fn = this.find_function(n)
			if(fn && fn.root){
				this.module.exports[name] = n
			}
			
			var olddepth = this.depth
			this.depth += this.indent
			ret += '{'
			var elem = n.enums
			if(!elem || !elem.length) return ret + '}'
			ret += this.newline
			
			var last = 0
			for(var i = 0;i<elem.length;i++){
				var item = elem[i]
				var nocomma = i == elem.length - 1
				var name = ''
				
				if(item.id.type == 'Id') name = item.id.name
				else if(item.id.type == 'Value') name = item.id.raw
				
				if(item.init){
					if(item.init.type !== 'Value') throw new Error("Unexpected enum assign")
					last = item.init.value
					ret += this.depth + ''+last+':"' + name + '",'+this.newline
					ret += this.depth + name + ':' + item.init.raw + (nocomma?'':',')+this.newline
				}
				else{
					ret += this.depth + ''+(++last)+':"' + name + '",'+this.newline
					ret += this.depth + name + ':' + (last) + (nocomma?'':',')+this.newline
				}
			}
			ret += olddepth + '}'
			this.depth = olddepth
			return ret
		}
		
		this.Comprehension = function( n ){
			var ret = '(function(){'
			var odepth = this.depth
			this.depth += this.indent
			
			// allocate a tempvar
			var fn = this.find_function( n )
			
			var tmp = this.tmp_prefix
			ret += 'var '+tmp + '=[]' + this.newline
			
			var old_compr = this.compr_assign
			this.compr_assign = tmp +'.push'
			ret += this.depth + this.expand(n.for, n) + this.newline
			ret += this.depth +'return '+tmp
			this.compr_assign = old_compr
			this.depth = odepth
			
			ret += this.newline + this.depth + '}).call(this)'
			return ret
		}
		
		this.Template = function( n ){
			var ret = '"'
			var chain = n.chain
			var len = chain.length
			for(var i = 0; i < len; i++){
				var item = chain[i]
				if(item.type == 'Block'){
					if(item.steps.length == 1 && outer.IsExpr[item.steps[0].type]){
						ret += '"+(' + this.expand(item.steps[0], n) + ')+"'
					}
					// we dont support non expression blocks
					else {
						throw new Error("Statement block in interpolated string not supported")
						ret += this.expand(item, n)
					}
				}
				else {
					if(item.value !== undefined){
						ret += item.value.replace(/\r?\n/g,'\\n').replace(/"/g,'\\"')
					}
				}
			}
			ret += '"'
			return ret
		}
		
		this.If = function( n ) {
			var ret = 'if('
			ret += this.expand(n.test, n)
			ret +=  ')' + this.space
			
			var then = this.expand(n.then, n)
			
			if(n.compr && outer.IsExpr[n.then.type]){
				ret += this.compr_assign + '(' + then +')'
			}
			else ret += then
			
			if(n.else){
				var ch = ret[ret.length - 1]
				if( ch !== '\n' ) ret += this.newline
				ret += this.depth + 'else ' + this.expand(n.else, n)
			}
			return ret
		}
		
		this.For = function( n ){
			var ret ='for(' + this.expand(n.init, n)+';'+
					this.expand(n.test, n) + ';' +
					this.expand(n.update, n) + ')'
			var loop = this.expand(n.loop, n)
			if(n.compr){
				ret += this.compr_assign + '(' + loop + ')'
			}
			else ret += loop
			return ret
		}
		
		// Complete for of polyfill with iterator and destructuring support
		this.ForOf = function( n ){
			// alright we are going to do a for Of polyfill
			var left = n.left
			var isvar
			var value
			// we can destructure the value
			var destruc
			if(left.type == 'Var'){
				isvar = true
				var defs = left.defs
				if(defs.length !== 1) throw new Error('unsupported iterator syntax for for of')
				var id = defs[0].id
				if(id.type == 'Object' || id.type == 'Array') destruc = id
				else value = id.name, this.scope[value] = 1
			}
			else if(left.type == 'Id'){
				value = this.resolve(left.name)
			}
			else if(left.type == 'List'){
				var items = left.items
				var id = defs[p++].id
				if(id.type == 'Object' || id.type == 'Array') destruc = id
				else value = id.name, this.scope[value] = 1
			}
			else if(left.type == 'Object' || left.type == 'Array'){
				destruc = left
			}
			// alright so now what we need to do is make a for loop.
			var result = this.alloc_tmpvar(n)
			var iter = this.alloc_tmpvar(n)
			
			var ret = 'for('
			ret += iter+'=ONE.iterator(' + this.expand(n.right, n) + '),'+result+'=null;' +
					iter+'&&(!'+result+'||!'+result+'.done);){' + this.newline
			
			var od = this.depth
			this.depth += this.indent
			ret += this.depth + result + '=' + iter + '.next()' + this.newline
			// destructure result.value
			if(destruc){
				var vars = []
				var destr = ';'+this.destructure(n, destruc, result+'.value', this.find_function( n ), vars)
				if( isvar ){
					ret += this.depth + 'var '
					for(var i = 0;i<vars.length;i++){
						var name = vars[i].name
						this.scope[ name ] = 1
						if(i) ret += ','
						ret += name
					}
					//ret += this.newline
				}
				ret += destr
			} else {
				ret += this.depth + value + '=' + result + '.value' + this.newline
			}
			this.depth = od
			var loop = this.expand(n.loop, n)
			if( loop[loop.length-1]=='}' ) ret += loop.slice(1,-1) //!todo fix this
			else{
				ret += this.depth+this.indent
				if(n.compr) ret += this.compr_assign+'('+loop+')'
				else ret += loop
				ret += this.newline+this.depth
			}
			ret += '}'
			return ret
		}
		
		// a high perf for over an array, nothing more.
		this.ForFrom = function( n ){
			// we have 2 values to get
			// the value, and the iterator
			var left = n.left
			var isvar
			var iter
			var value
			var alen
			var arr
			if(left.type == 'Var'){
				isvar = true
				var defs = left.defs
				var len = defs.length
				var p = 0
				if(len > 3) throw new Error('unsupported iterator syntax for for from')
				if(len > 2) alen = defs[p++].id.name, this.scope[alen] = 1
				if(len > 1) iter = defs[p++].id.name, this.scope[iter] = 1
				if(len > 0) value = defs[p++].id.name, this.scope[value] = 1
			}
			else if(left.type == 'Id'){
				value = this.resolve(left.name)
			}
			else if(left.type == 'List'){
				var items = left.items
				var len = items.length
				var p = 0
				if(len > 3)  throw new Error('unsupported iterator syntax for for from')
				if(len > 2) alen = this.resolve(items[p++].name)
				if(len > 1) iter = this.resolve(items[p++].name)
				if(len > 0) value = this.resolve(items[p++].name)
			}
			if(!value){
				console.log(n)
				throw new Error('No iterator found in for from')
			}
			if(!iter) iter = this.alloc_tmpvar(n)
			if(!alen) alen = this.alloc_tmpvar(n)
			
			arr = this.alloc_tmpvar(n)
			// and then we have to allocate two or three tmpvars.
			// we fetch the
			var ret = 'for('
			if( isvar ) ret += 'var '
			ret += arr + '=' + this.expand(n.right, n) + ',' + alen + '=' + arr + '.length,' +
				iter + '=0,' + value + '=' + arr + '[0];' + iter + '<' + alen + ';' + value + '=' + arr + '[++' + iter + '])'
			var loop = this.expand(n.loop, n)
			
			if(n.compr) ret += this.comp_assign + '(' + loop + ')'
			else ret += loop
			return ret
		}
		
		// a simple for to loop on integers
		this.ForTo = function( n ){
			
			// lets find the iterator
			var left = n.left
			var iter
			if(left.type == 'TypeVar' || left.type == 'Var'){
				if(left.defs.length != 1) throw new Error("for to only supports one argument")
				iter = left.defs[0].id.name
			}
			else if(left.type == 'Id'){
				iter = this.resolve(left.name)
			}
			if(left.type == 'Assign'){
				iter = this.resolve(left.left.name)
			}
			else if(left.type == 'List'){
				if(left.items.length != 1) throw new Error("for to only supports one argument")
				iter = this.resolve(left.items[0].name)
			}
			var ret = 'for(' + this.expand(n.left, n) + ';' +
					iter + '<' + this.expand(n.right, n) + ';' + iter + '++)'
			var loop = this.expand(n.loop, n)
			if(n.compr && outer.IsExpr[n.loop.type]){
				ret += this.compr_assign + '(' + loop + ')'
			}
			else ret += loop
			
			return ret
		}
		
		this.ForIn = function( n ){
			var ret = 'for(' + this.expand(n.left, n) + ' in ' +
				this.expand(n.right, n) + ')'
			var loop = this.expand(n.loop, n)
			if(n.compr && outer.IsExpr[n.loop.type]){
				ret += this.compr_assign +'('+ loop + ')'
			}
			else ret += loop
			
			return ret
		}
		
		this.TypeVar = function( n ){
			var name = n.typing.name
			if(name == 'signal'){
				var ret = ''
				var defs = n.defs
				var len = defs.length
				for( var i = 0; i < len; i++ ){
					var def = defs[i]
					def.parent = n
					if(i) ret += this.newline + this.depth
					ret += 'this.signal("' + def.id.name + '"'
					if(def.init) ret += ',' + this.expand(def.init, def)
					ret += ')'
				}
				return ret
			}
			if(name == 'import'){
				var ret = ''
				var defs = n.defs
				var len = defs.length
				ret += 'var '
				for(var i = 0; i < len; i++){
					var def = defs[i]
					// lets fetch the module
					var name = def.id.name
					ret += name
					ret += ' = this.import("' + name + '")'
					this.scope[name] = 1
					// now lets iterate all the vars
					var module = ONE.__modules__[name]
					if(!module) throw new Error("Module " + name + " not found")
					this.module.imports.push(module)
					var exports = module.exports
					for(var e in exports){
						ret += ', '+ e + ' = ' + name + '.' + e
						this.scope[e] = exports[e]
					}
				}
				ret += this.newline
				return ret
			}
			return 'var ' + this.flat( n.defs, n )
			
			throw new Error("implement TypeVar")
		}
		
		this.Def = function( n ){
			// destructuring
			if(n.id.type == 'Array' || n.id.type == 'Object'){
				var vars = []
				var ret = this.destructure(n, n.id, n.init, this.find_function( n ), vars)
				
				var pre = ''
				for(var i = 0; i < vars.length; i++){
					this.scope[ vars[i].name ] = 1
					if(i) pre += ','+this.space
					pre += this.expand(vars[i], n)
				}
				return pre + ',' + this.space + this.destruc_prefix + '0=' + ret
			}
			else if(n.id.type !== 'Id') throw new Error('Unknown id type')
			
			if(n.dim !== undefined) throw new Error('Dont know what to do with dimensions')
			
			var type
			var init = (n.init ? this.space+'='+this.space + this.expand(n.init, n) : '')
			if(n.parent.type == 'TypeVar'){
				
				var typing = n.parent.typing
				var name
				if(typing.type == 'Index'){
					name = typing.object.name
					type = this.find_type(name)
					if(!type) throw new Error('Cannot find type ' + name)
					type = Object.create(type)
					type.dim = 1
				}
				else{
					name = typing.name
					type = this.find_type(name)
					if(!type){
						//console.log(this.module)
						throw new Error('Cannot find type ' + name)
					}
				}
			}
			else if(n.id.typing ){
				type = this.find_type(n.id.typing.name)
				if(!type) throw new Error('Cannot find type ' + n.id.typing.name)
			}
			else{
				if(init && n.init.infer) type = n.init.infer
				else type = 1
			}
			this.scope[n.id.name] = type
			
			// if we have a type, we need to check the init call to be a constructor.
			return this.expand(n.id, n) + init
				
		}
		
		this.Define = function( n ){
			// its a macro function
			if(n.id.type == 'Function'){
				var name = n.id.name.name
				var macros = this.module.macros
				while(name in macros){
					name = name + '_'
				}
				macros[name] = n
			}
			// its a macro expression
			else if(n.id.type == 'Call'){
				var name = n.id.fn.name
				var macros = this.module.macros
				while(name in macros){
					name = name + '_'
				}
				macros[name] = n
			}
			// its a macro value
			else {
				var name = n.id.name
				this.module.defines[name] = n.value
			}
			return ''
		}
		
		this.Struct = function( n ){
		
			var name = n.id.name
			
			//if(this.typelib[name]) throw new Error('Cant redefine type ' + n.id.name)
			
			// in a baseclass we copy the fields and methods
			var type = this.module.types[name] = {}
			type._type_ = 1
			type.name = name
			if(n.base){
				var base = type.base = this.find_type(n.base.name)
				if(!base) throw new Error('Struct base '+n.base.name+' undefined ')
				// lets copy the fields
				type.fields = Object.create(base.fields || null)
				type.methods = Object.create(base.methods || null)
				type.mappings = Object.create(base.mappings || null)
				type.construct = Object.create(base.construct || null)
				type.size = base.size
				type.view = base.view
			}
			else {
				type.fields = {}
				type.methods = {}
				type.mappings = {}
				type.construct = {}
				type.size = 0
				type.view = undefined
			}
			
			var steps = n.struct.steps
			for(var i = 0, steplen = steps.length; i < steplen; i++){
				var step = steps[i]
				
				// this one adds a field to a struct
				if(step.type == 'TypeVar'){
					// lets fetch the size
					var typing = step.typing
					var typename
					var arraydim
					// float[10] x array defs
					if(typing.type == 'Index'){
						typename = typing.object.name
						arraydim = typing.index && typing.index.value
						if(!arraydim) throw new Error('need array dimensions on type')
					}
					else if(typing.type == 'Id'){
						typename = typing.name
					}
					else throw new Error('Unknown type-typing in struct')
					
					var field = this.find_type(typename)
					
					if(!field) throw new Error('Cant find type ' + step.typing.name )
					// lets add all the defs as fields
					var defs = step.defs
					for(var j = 0, deflen = defs.length; j < deflen; j++){
						var def = defs[j]
						// create field
						var name = def.id.name
						if(name in type.fields) throw new Error('Cant redefine field ' + name)
						var cpy = type.fields[name] = Object.create(field)
						cpy.off = type.size
						cpy.dim = arraydim
						type.size += field.size * (arraydim || 1)
						
						if(type.view === undefined){
							type.view = field.view
							//type.arr = field.arr
						}
						else if(type.view !== field.view){
							//throw new Error('Dont support mixed type structs yet in JS')
							type.view = 0
						}
					}
				}
				// this one adds a method
				else if(step.type == 'Function'){
					// store the function on the struct
					var name = step.name.name
					var store = type.methods
					if( name == type.name ) store = type.construct
						while(name in store) name = name + '_'
						store[name] = step
				}
				else if(step.type == 'List'){
					// alright we have a mapping.
					var items = step.items
					// we have to be an assign first, then Values
					var item0 = items[0]
					if(item0.type != 'Assign') throw new Error('Struct mapping first item in List should be an assign')
					if(item0.left.type !='Id') throw new Error('Struct mapping assign should be to an Id')
					if(item0.right.type !='Value') throw new Error('Struct mapping assign should be a value')
					var map = type.mappings[item0.left.name] = [item0.right.value]
					for(var j = 1; j<items.length;j++){
						var item = items[j]
						if(item.type != 'Value') throw new Error('Struct mapping item should be a value')
						map.push(item.value)
					}
				}
				else if(step.type == 'Assign'){
					if(step.left.type !='Id') throw new Error('Struct mapping assign should be to an Id')
					if(step.right.type !='Value') throw new Error('Struct mapping assign should be a value')
					type.mappings[step.left.name] = [step.right.value]
				}
				else
					throw new Error('Cannot use ' + step.type + ' in struct definition')
			}
			type.slots = type.size / outer.viewSize[type.view]
			
			//if(type.size == 0) throw new Error('Cannot make size 0 structs')
			return ''
		}
		
		this.Class = function( n ){
			
			var base = n.base? this.expand(n.base, n): 'ONE.__Base__'
			var name = n.id.name
			
			// allow same-name class overloads
			if(n.base && n.base.type == 'Id' && n.base.name == name) base = 'this.'+base

			var fn = this.find_function(n)
			if(fn.root){
				// export the class
				this.module.exports[name] = n
			}
			
			this.scope[name] = 2
			var ret = 'var ' + name + ' = this.' + name +
					' = ' + base + '.extend(this,'+
					this.Function( n, null, ['__outer__'] ) +
					', "' + name + '")'
			return ret
		}
		
		this.Function = function( n, nametag, extparams, type_method, this_to_var, inject ){
			if(n.id) this.scope[n.id.name] = 1
			// make a new scope
			var scope = this.scope
			this.scope = Object.create( scope )
			scope.__sub__ = this.scope
			
			var signals = this.signals
			this.signals = []
			
			var olddepth = this.depth
			this.depth += this.indent
			
			var str_body = ''
			var str_param = ''
			
			// and we have rest
			var params = n.params
			var plen = params ? params.length : 0
			// do rest parameters
			if(n.rest){
				if( n.rest.id.type !== 'Id' ) throw new Error('Unknown id type')
				var name = n.rest.id.name
				this.scope[name] = 1
				if(plen)
					str_body += this.depth + 'var '+name+' = arguments.length>' + plen + '?' +
					'Array.prototype.slice.call(arguments,' + plen + '):[]' + this.newline
				else
					str_body += this.depth + 'var '+name+' = Array.prototype.slice.call(arguments,0)' + this.newline
			}
			if(typeof type_method == 'object'){
				this.scope['_'] = type_method
				str_param += '_'
			}
			// do init
			if(plen){
				var split = ',' + this.space
				for(var i = 0;i<plen;i++){
					var param = params[i]
					param.parent = n
					
					// destructuring arguments
					if(param.id.type == 'Array' || param.id.type == 'Object'){
						var vars = []
						var tmp = this.desarg_prefix+i
						var dest = this.destructure(n, param.id, param.init, n, vars, tmp) + this.newline
						
						var vardef = ''
						for(var v = 0;v<vars.length;v++){
							var id = vars[v]
							if(id.flag !== 64){
								this.scope[ id.name ] = 1
								if(vardef) vardef += ',' +this.space
								vardef += id.name
							}
						}
						str_body += this.depth + 'var ' + vardef
						str_body += (vardef?','+this.space:'')+this.destruc_prefix+'0=' + dest
						str_param +=  (str_param?split:'') + tmp
					}
					else {
						var name = param.id.name
						str_param += (str_param?split:'') + name //name
						if( str_param[str_param.length - 1] == '\n' ) str_param += this.depth
						if(param.init){
							str_body += this.depth + 'if(' + name + '===undefined)' + name + '=' + this.expand(param.init, param) + this.newline
						}
						if(param.id.flag == 64){
							str_body += this.depth + 'this.' + name + '=' + name + ';' + this.newline
						}
						else {
							var typing = param.id.typing
							if(typing){
								var kname
								if(typing.type == 'Index') kname = typing.object.name
								else kname = typing.name
								
								var type = this.find_type(kname)
								
								if(!type) throw new Error("Undefined type "+kname+" used on argument "+name)
								this.scope[name] = type
							}
							else this.scope[name] =  1
						}
					}
				}
			}
			if(extparams){
				var split = ','+this.space
				var exlen = extparams.length
				for(var i = 0;i<exlen;i++){
					var name = extparams[i]
					this.scope[name] = 1
					if(str_param) str_param += split
					str_param += name
				}
			}
			if(this_to_var){
				var ttlen = this_to_var.length
				for(var i = 0;i<ttlen;i++){
					var name = this_to_var[i]
					this.scope[name] = 1
					str_body += this.depth + 'var ' + name + ' = this.' + name + this.newline
				}
			}
			if(inject){
				str_body += this.depth + inject + this.newline
			}
			// expand the function
			if(n.body.type == 'Block'){
				// forward class and enum reference
				var steps = n.body.steps
				for(var i =0, slen = steps.length;i<slen;i++){
					var step = steps[i]
					var step_type = step.type
					if(step_type == 'Class' || step_type == 'Enum' || step_type == 'Function'){
						if(step.id) this.scope[step.id.name] = 1
					}
					else if(step_type == 'Var'){
						var defs = step.defs
						for(var j = 0, dlen = defs.length; j < dlen; j++){
							this.scope[defs[j].id.name] = 1
						}
					}
				}

				n.body.parent = n
				// we can do a simple wait transform
				str_body += this.block( n.body.steps, n.body, 1 )
			}
			else str_body += this.depth + 'return ' + this.expand(n.body, n)
			
			// Auto function to this bind detection
			var bind = false
			if(n.arrow === '=>' || (n.parent && n.parent.extarg && !n.arrow)) bind = true
			var ret = ''
			var isvarbind
			var isgetset
			if(n.name){
				if(n.name.name == 'bind' && !n.name.flag){
					ret += '('
					isvarbind = true
				}
				else {
					var typing = n.name.typing
					if(typing && (typing.name == 'get' || typing.name == 'set')){
						if(typing.name == 'get') ret += 'this.__defineGetter__("'
						else ret += 'this.__defineSetter__("'
						ret += n.name.name + '",'
						isgetset = true
					}
					else if(!type_method){
						var fn = this.find_function(n.parent)
						if(fn && fn.root){
							// export the method
							this.module.exports[n.name.name] = n
						}
						// support global method names
						if(n.name.type == 'Id' && this.globals[n.name.id])
							ret += 'this.' + n.name.name + this.space + '=' + this.space
						else
							ret += this.expand(n.name, n) + this.space + '=' + this.space
						//console.log(ret)
					}
				}
			}
			
			if(n.await) ret = ret  + 'ONE.await('
			
			ret += 'function'
			
			if(n.gen || n.auto_gen) ret += '*'
			if( nametag === null ) ret += ''
			else if( nametag ) ret += ' '+nametag
			else if(n.id){
				if(n.gen || n.auto_gen){
					ret = 'var ' + this.expand(n.id, n) + ' = ' + ret
				}
				else ret += ' '+this.expand(n.id, n)
			}
			
			if( !str_param ) str_param = ''
			ret += '(' + str_param + '){'
			
			var tmp = ''
			
			if( n.destruc_vars ){
				for(var i = 0;i<n.destruc_vars;i++){
					if(tmp) tmp += ','+this.space
					tmp += this.destruc_prefix + i
				}
			}
			if( n.tmp_vars ){
				for(var i = 0;i<n.tmp_vars;i++){
					if(tmp) tmp += ','+this.space
					tmp += this.tmp_prefix + i
				}
			}
			
			if( n.store_var ){
				if(tmp) tmp += ','+this.space
				tmp += this.store_prefix
			}
			
			if( n.call_var ){
				if(tmp) tmp += ','+this.space
				tmp += this.call_tmpvar
			}
			
			if(tmp){
				ret += 'var ' + tmp + this.newline
			}
			else ret += this.newline
			
			this.depth = olddepth
			this.scope = scope
			
			ret += str_body + this.depth
			
			//if( ret[ret.length - 1] != '\n') ret += this.newline + this.depth
			
			if(typeof type_method == 'object'){
				ret += this.depth+this.indent+'return _'+this.newline + this.depth
			}
			
			ret += '}'
			if( n.await ){
				if( bind ) ret += ',this'
				ret += ')'
			}
			else if( bind ) ret += '.bind(this)'
			if(isgetset) ret += ')'
			if(isvarbind){
				ret += ').call(this'
				for(var i = 0; i < plen;i ++){
					ret += ',' + this.resolve( params[i].id.name )
				}
				ret += ')'
			}
			
			return ret
		}
		
		this.find_function = function( n ){
			var p = n.parent
			while(p){
				if(p.type == 'Nest') return p
				if(p.type == 'Class') return p
				if(p.type == 'Function') return p
				if(p.root) console.log(p)
				p = p.parent
			}
		}
		
		this.alloc_tmpvar = function( n ){
			var fn = n.tmp_fn || (n.tmp_fn = this.find_function(n))
			if(!fn.tmp_vars) fn.tmp_vars = 0
			return this.tmp_prefix + (fn.tmp_vars++)
		}
		
		this.Yield = function( n ){
			var fn = this.find_function( n )
			if(!fn) throw new Error('Yield cannot find enclosing function')
			fn.auto_gen = 1
			return 'yield' + (n.arg ? ' ' + this.expand(n.arg, n):'')
		}
		
		this.Await = function( n ){
			var fn = this.find_function( n )
			if(!fn) throw new Error('Await cannot find enclosing function')
			fn.auto_gen = 1
			fn.await = 1
			return 'yield'+ (n.arg ? ' ' + this.expand(n.arg, n):'')
		}
		
		this.Update = function( n ){
			var ret
			if( n.prefix ){
				ret = n.op + this.expand(n.arg, n)
				if(n.arg.infer_multiply) throw new Error("Cannot put a prefix operator on a multiplied length")
				if(n.arg.infer_mapping) throw new Error("Cannot put a prefix operator on a mapped struct property")
			}
			else {
				if( n.op === '!') throw new Error("Postfix ! not implemented")
				if(n.op ==='~'){
					ret = 'ONE.trace('+this.expand(n.arg, n) + ')'
				}
				ret = this.expand (n.arg, n)
				if(n.arg.infer_mapping) throw new Error("Cannot put a postfix operator on a mapped struct property")
				if(n.arg.infer_multiply) ret = '(('+ret + '+=' + n.arg.infer_multiply+')/'+n.arg.infer_multiply+'-1)'
				else ret += n.op	
			}
			return ret
		}
		
		this.Signal = function( n ){
			
			if(n.left.type != 'Id') throw new Error('Signal assign cant use left hand type')
			
			var id = n.left.name
			if(this.scope[id]) throw new Error('Implement signal assign to local vars')
			
			var ret
			
			ret = 'this.__signal__("'+id+'",'

			// and it also supports local vars
			// we need to check for % vars and pass them into parse.
			var esc = outer.ToEscaped
			var tpl = esc.templates = {}
			var locals = esc.locals = {}
			
			// if we have a variable in scope, we need to bind the expression to it
			esc.scope = this.scope
			
			esc.depth = this.depth
			var body = esc.expand(n.right, n)
			
			// cache the AST for parse()
			if(this.module && this.module.parser_cache)
				this.module.parser_cache[body] = n.right
			
			var obj = ''
			for( var name in tpl ){
				if(obj) obj += ','
				obj += name+':'+(name in this.scope?name:'this.'+name)
			}
			var localstr = ''
			for( var local in locals ){
				if(local) obj += ','
				localstr += name+':'+name
			}
			
			ret +=  'this._parse("' + body + '",__module__'
			if( localstr ) ret += ',{' + localstr + '}'
			if( obj ){
				if(!localstr) ret += ',null'
				ret += ',{' + obj + '}'
			}
			ret += '))'

			if(n.meta){
				for(var i = 0;i<n.meta.length;i++){
					var meta = n.meta[i]
					ret += this.newline + this.depth 
					ret += 'this.on_' + id + '.' + meta.id.name + ' = ' 
					if(meta.init) ret += this.expand(meta.init, n)
					else ret += 'true'
				}
			}
			return ret
		}

		this.Assign = function( n ){
			var ret = ''
			if(n.op == '?='){
				var left = this.expand(n.left, n)
				ret = '(' + left + '===undefined?(' + left + '='+this.expand(n.right, n) + '):' + left + ')'
			}
			else if(n.left.type == 'Object' || n.left.type == 'Array'){
				return this.destructure(n, n.left, n.right, this.find_function( n ))
			}
			else if(n.left.type == 'Id' || n.left.type == 'Key' || n.left.type == 'Index'){
				var left = this.expand(n.left, n, false)
				var mul
				if(n.left.infer_multiply) mul = n.left.infer_multiply 
				if(n.left.onthis){
					var fn = this.find_function(n)
					if(fn.root){
						this.module.exports[n.left.name] = n
					}
				}
				// so what operator are we?
				if(n.left.infer_struct){ // we are an assign to a struct type
					// we need to know what the rhs is.
					n.right.struct_assign = n.left
					n.right.struct_assign_op = n.op
					var right = this.expand(n.right, n)
					// lhs not consumed by rhs (struct constructor calls consume lhs)
					if(n.right.struct_assign){
						if(!n.right.infer || n.right.infer.slots != n.left.infer.slots)
							throw new Error('Incompatible types in assignment')
						// do a structure copy
						// allocate tempvars
						var func = this.find_function(n)
						var tmp_l = this.destruc_prefix + 0
						var tmp_r = this.destruc_prefix + 1
						var tmp_c = this.destruc_prefix + 2
						var nslots = n.left.infer.slots
						// left target is a struct. 
						if(n.left.infer_struct){
							if(!func.destruc_vars || func.destruc_vars<3) func.destruc_vars = 3

							var ret = '(' + tmp_c + '=' + n.left.infer_offset + ',' + tmp_l + '=' + n.left.infer_base + ',' + tmp_r + '=' + right
							var swiz = n.left.infer_swiz
							var mapping = n.left.infer_mapping
							var maptype = n.left.infer_maptype
							for(var i = 0;i<nslots;i++){
								ret += ','
								var tgtslot = swiz? swiz[i]: i
								if(mapping){
									for(var m = mapping.length - 1; m >= 1; m--){
										ret += tmp_l + '[' + tmp_c + '+' + (mapping[m] * maptype.slots+ tgtslot) +']'
										if(m == 1) ret += n.op
										else ret += '='
									}
								}
								else ret += tmp_l + '[' + tmp_c + '+' + tgtslot  + ']' + n.op
								ret += tmp_r + '[' + i + ']'
							}
						}
						else{
							if(!func.destruc_vars || func.destruc_vars<2) func.destruc_vars = 3

							var ret = '(' + tmp_l + '=' + left + ',' + tmp_r + '=' + right
							var swiz = n.left.infer_swiz
							if(swiz){
								for(var i = 0;i<nslots;i++){
									ret += ',' + tmp_l + '[' + swiz[i] + ']'+ n.op + tmp_r + '[' + i + ']'
								}
							}
							else{
								for(var i = 0;i<nslots;i++){
									ret += ',' + tmp_l + '[' + i + ']' + n.op + tmp_r + '[' + i + ']'
								}
							}
						}
						ret += ','+tmp_r+')'
					}
					else {
						ret = right
					}
				}
				else {
					if(n.left.infer_mapping){ // we have to duplicate the assignment
						var mapping = n.left.infer_mapping
						var maptype = n.left.infer_maptype
						var func = this.find_function(n)

						if(!func.destruc_vars || func.destruc_vars<2) func.destruc_vars = 2
						var tgt = this.destruc_prefix + 0
						var tmp = this.destruc_prefix + 1
						var base = n.left.infer_base
						var off = n.left.infer_offset
						ret += '(' + tmp + '=' + off + ',' + tgt + '=' + base + ','
						for(var m = mapping.length - 1; m >= 1; m--){
							ret += tgt + '[' + tmp + '+' + mapping[m] * maptype.slots + ']'
							if(m == 1) ret += n.op
							else ret += '='
						}
					 	ret += this.expand(n.right, n)
					 	ret += ')'
					}
					else{
						ret += left
						if(ret[ret.length - 1] == '\n') ret += this.indent + this.depth
						if(mul){
							ret = '(' + ret + this.space + n.op + this.space + '(' + this.expand(n.right, n) + ')*' + mul + ')/' + mul
						}
						else{
							ret += this.space + n.op + this.space + this.expand(n.right, n) 
						}
					}
				}
			}
			else {
				ret = 'this[' + this.expand(n.left, n) + ']' + this.space + n.op +
					this.space + this.expand(n.right, n)
			}
			return ret
		}

		this.bin_op_table = {
			'*':'mul',
			'+':'add',
			'-':'min',
			'/':'div'
		}

		this.Binary = function( n ){
			var ret
			var leftstr
			
			var left = this.expand(n.left, n)
			var right = this.expand(n.right, n)

			// lets check types
			if(n.left.infer && n.left.infer.slots > 1 || 
			   n.right.infer && n.right.infer.slots > 1){
			   	// alright so, we have
				var left_t = n.left.infer
				var right_t = n.right.infer
				if(!left_t) throw new Error('Operator will not do what you want, please type the left side: '+n)
				if(!right_t) throw new Error('Operator will not do what you want, please type the right side: '+n)
				var left_name = left_t.name
				var right_name = right_t.name
				var name = this.bin_op_table[n.op]
				var type = this.find_type(left_name)
				if(!name) throw new Error('operator '+n.op+' not supported for type '+left_name + ' on ' + right_name)
				// operators are static struct calls
				return this.struct_method(n, type, left_name +'_'+ name + '_' + right_name, [n.left, n.right])
			}
			var left_t = n.left.type
			var right_t = n.right.type
			
			// obvious string multiply
			if(n.op == '*' && (((leftstr=left_t == 'Value' && n.left.kind == 'string'))||
				(right_t == 'Value' && n.right.kind == 'string'))){
				if(leftstr) return 'Array(' + left + ').join(' + right + ')'
				return 'Array(' + left + ').join(' + right + ')'
			} // mathematical modulus
			
			if(n.op == '%%') return 'Math._mod(' + left + ',' + right + ')'
			// floor division
			if(n.op == '%/') return 'Math.floor(' + left + '/' + right + ')'
			// pow
			if(n.op == '**') return 'Math.pow(' + left + ',' + right + ')'
			
			// normal binop
			if(left_t == 'Assign' || left_t == 'List' || left_t == 'Condition' ||
				(left_t == 'Binary' || left_t == 'Logic') && n.left.prio <= n.prio)
				left = '(' + left + ')'
			
			if(right_t == 'Assign' || right_t == 'List' || right_t == 'Condition' ||
				(right_t == 'Binary' || right_t == 'Logic') &&  n.right.prio <= n.prio)
				right = '(' + right + ')'

			var ret = left + this.space + n.op + this.space + right
			if(n.op == '+' && n.parens) ret = '(' + ret + ')'
			return ret
		}
		
		this.Logic = function( n ){
			if(n.parent && n.parent.type == 'Block'){
				return 'this.constraint('+
					this.Quote(n, n) + ')'
			}

			var left = this.expand(n.left, n)
			var right = this.expand(n.right, n)
			var left_t = n.left.type
			var right_t = n.right.type
			
			if(left_t == 'Assign' || left_t == 'List' || left_t == 'Condition' ||
				(left_t == 'Binary' || left_t == 'Logic') && n.left.prio < n.prio)
				left = '(' + left + ')'
			
			if(right_t == 'Assign' || right_t == 'List' || right_t == 'Condition' ||
				(right_t == 'Binary' || right_t == 'Logic') &&  n.right.prio < n.prio)
				right = '(' + right + ')'
			
			if(n.op == '?|'){
				if(n.left.type == 'Id') return '(' + left + '!==undefined?' + left + ':' + right + ')'
			
				var tmp = this.alloc_tmpvar(n)
				return '((' + tmp + '=' + left + ')!==undefined?' + tmp + ':' + right + ')'
			}
			return left + this.space + n.op + this.space + right
		}
		
		this.Unary = function( n ){
			var arg = this.expand(n.arg, n)
			var arg_t = n.arg.type
			if( n.prefix ){
				if(arg_t == 'Assign' || arg_t == 'Binary' || arg_t == 'Logic' || arg_t == 'Condition')
					arg = '(' + arg + ')'
				
				if(n.op == '?') return arg +'!==undefined'
				if(n.op.length != 1) return n.op + ' ' + arg
				return n.op + arg
			}
			return arg + n.op
		}
		
		// convert new
		this.New = function( n ){
			var fn = this.expand(n.fn, n)
			var fn_t = n.fn.type
			if(fn_t == 'Assign' || fn_t == 'Logic' || fn_t == 'Condition')
				fn = '(' + fn + ')'
			
			var arg = this.list(n.args, n)
			return 'new ' + fn + '(' + arg + ')'
			// forward to Call
			// WARNING we might have double calls if you fetch
			// the class via functioncall.
			//n.isnew = true
			//return this.expand(n, n.parent, 'Call')
			//return this.Call( n, undefined, undefined, true )
			//return  fn + '.new(this'+(arg?', '+arg:arg)+')'
		}
		
		// struct method call
		this.struct_method = function(n, type, method_name, args, sthis){

			var method = type.methods[method_name]
			while(method){
				//!TODO add type checking here
				if(method.params.length == args.length) break
				method_name = method_name + '_'
				method = type.methods[method_name]
			}
			if(!method) throw new Error('No overload found for '+method_name)
			
			var gen = type.name + '_' + method_name
			// lets make a name from our argument types
			for(var i = 0, l = method.params.length; i < l; i++){
				var typing = method.params[i].id.typing
				gen += '_'+(typing && typing.name || 'var')
			}

			// make a type_method
			if(!this.type_methods[gen]){
				var d = this.depth
				this.depth = ''
				var t = this.type_method
				this.type_method = type
				this.type_methods[gen] = this.Function(method, gen, undefined, type ) + this.newline
				this.type_method = t
				this.depth = d
			}
			
			var ret = ''
			ret += gen+'.call(this'

			if(!sthis){
				// lets allocate a tempvar
				this.find_function(n).call_var = 1
				this.module.local_types[type.name] = outer.typeBase(type)

				var alloc = '(' + this.call_tmpvar+'= '+'new ' + type.view + 'Array(' + type.slots + ')'+',' +
					this.call_tmpvar + '._t_=__module__.local_types.' + type.name + ',' + this.call_tmpvar + ')'

				if(this.store_tempid){

					var store =  (this.store_pretemp?this.store_pretemp:'this.struct_')+ (this.store_tempid++)
					alloc = store + '||(' + store + '=' + alloc + ')'
				}
				ret += ', ' + alloc

				//ret += ',{o:0,t:module.'+type.name+','+type.arr+':new ' + type.view + 'Array(' + type.slots + ')}'
			}
			else ret += ', ' + sthis.name
			
			// set up the call and argument list
			for(var i = 0, l = args.length; i < l; i++){
				var arg = args[i]
				ret += ', ' + this.expand(arg, n)
				if(arg.type == 'Rest') throw new Error('... is not supported in typed calls')
			}
			ret += ')'
			n.infer = type

			return ret
		}
		
		this.struct_constructor = function( n, dims, args, type ){
			// allocate tempvars
			var func = this.find_function(n)
			if(!func.type_nesting) func.type_nesting = 1
			else func.type_nesting ++
			
			if(!func.destruc_vars || func.type_nesting*2 > func.destruc_vars)
				func.destruc_vars = func.type_nesting*2
			
			var output = this.destruc_prefix + (func.destruc_vars - 2)
			var output_offset = this.destruc_prefix + (func.destruc_vars - 1)
			var output_base = output
			var nslots = type.slots
			var ret
			var swiz
			var mapping
			var maptype
			var op = '='
			var offset = ''

			if(n.struct_assign){ // we are an assignment to a struct datatype
				var struct = n.struct_assign
				ret = '('+output+'='+struct.infer_base + ',' + output_offset + '=' + struct.infer_offset
				offset = output_offset + '+'
				mapping = struct.infer_mapping
				maptype = struct.infer_maptype
				swiz = struct.infer_swiz
				n.struct_assign = undefined
				op = n.struct_assign_op
			}
			else{
				// store the type on our module for quick reference
				this.module.local_types[type.name] = type
				//ret = '('+output+'= {o:0,t:module.'+type.name+','+type.arr+':new '+type.view+'Array('
				//if(dims) ret += '(' + this.expand(dims, n) + ')*' + nslots + ')}'
				//else ret += nslots + ')}'
				if(dims !== undefined){
					type = Object.create(type)
					type.dim = dims
					var dim_code = dims?this.expand(dims, n):0
					ret = '('+output+'= new '+type.view+'Vector('+dim_code+',__module__.local_types.' + type.name + ')'
					output = output + '._array_'
					//ret += '(' + dim_code + ')*' + nslots + ')' +
					//	',' + output + '._t_ = Object.create(__module__.local_types.' + type.name + ' || null), ' +
					//	output + '._t_.dim = ' + dim_code 
				}
				else{
					ret = '('+output+'= new '+type.view+'Array('
					ret += nslots + ')' +
						',' + output + '._t_ = __module__.local_types.' + type.name
				}

				if(this.store_tempid){
					var store = (this.store_pretemp?this.store_pretemp:'this.struct_') + (this.store_tempid++)
					ret = '((' + output + ' = ' +store +') || ' + ret + ')' 
				}
			}
			var slot = 0

			function walker(elem, n, issingle, type){
				// we have a call
				var ntype
				if(elem.type == 'Call' && elem.fn.type == 'Id' && (ntype = this.find_type(elem.fn.name))){
					if(ntype.view != type.view) throw new Error('Constructor args with different viewtypes are not supported')
					// we have to walk the arguments until we hit individual values
					var args = elem.args
					for(var i = 0, l = args.length; i<l; i++){
						walker.call(this, args[i], elem, l  == 1, ntype)
					}
					return
				}
				// write directly
				if(typeof elem == 'number' || elem.type == 'Value'){
					var val = elem.type?this.expand(elem, n):String(elem)
					ret += ','
					for(var i = 0, l = issingle?type.slots:1; i < l; i++){
						//ret += output+'.'+type.arr+'['
						//if(off) ret += output+'.o+'
						var out_slot = slot++
						if(swiz) out_slot = swiz[out_slot]
						if(mapping){
							for(var m = mapping.length-1;m>=1;m--){
								ret += output+'[' + offset + (mapping[m] * maptype.slots + out_slot ) + ']'
								if(m == 1) ret += op
								else ret += '='
							}
						}
						else ret += output+'['+ offset + out_slot +']'+op
					}
					ret += val
					//console.log(ret)
				}
				// expand to a var, and decide wether it is compound or primtive.
				else {
					var val = this.expand(elem, n)
					if(!elem.infer || elem.infer.prim){ // well assume its a single val
						ret += ','
						for(var i = 0, l = issingle?type.slots:1; i < l; i++){
							//ret += output+'.'+type.arr+'['
							//if(off) ret += output+'.o+'
							var out_slot = slot++
							if(swiz) out_slot = swiz[out_slot]
							if(mapping){
								for(var m = mapping.length-1;m>=1;m--){
									ret += output+'[' + offset + (mapping[m] * maptype.slots + out_slot) + ']'
									if(m == 1) ret += op
									else ret += '='
								}
							}
							else ret += output+'['+ offset + out_slot +']'+op
						}
						ret += val

					}
					else {
						// we need t
						throw new Error('To implement: typed arguments in struct constructor')
					}
				}
			}
			for(var i = 0,l = args.length; i < l; i++ ){
				walker.call(this, args[i], n, l == 1, type)
			}
			if(slot%nslots) throw new Error('Incorrect number of fields used in '+name+'() constructor, got '+slot+' expected (multiple of) '+nslots + ' ' +outer.AST.toString(n) )
			func.type_nesting--
			
			ret += ','+output_base+')'
			n.infer = type
			
			return ret
		}

		this.macro_match_args = function( n, macro_name, body, args ){
			// now we need to expand the args to do the type inference.
			if(!args.expanded){
				var exp = args.expanded = []
				for(var i = 0, l = args.length; i<l; i++){
					exp[i] = this.expand(args[i], n)
				}
			}
			var params
			if(body.type == 'Function') params = body.params
			else if(body.type == 'Call') params = body.args
			if(!params) return
			// match length
			if(params.length !== args.length) return
			var generics = Object.create(null)
			for(var i = 0, l = params.length; i<l; i++){
				var param = params[i]
				var typing
				if(param.type == 'Def') typing = param.id.typing
				else typing = param.typing
				if(typing){
					var infer = args[i].infer
					if(!infer) return

					// what if typing.name == 'T'
					var ch
					var name = typing.name
					if(name.length == 1 && (ch = name.charCodeAt(0)) >= 65 && ch <= 90 ){ // generics
						// lets store typing on our 
						var prev = generics[name]
						if(prev){
							if(prev.name != infer.name) return
						}
						else generics[name] = infer
					}
					else if(infer.name != name) return
				}
			}

			return generics
		}
		
		// lets pattern match 
		this.find_macro = function( n, name, args ){
			var macro
			var found

			if(this.context){ // support for context macros
				var ctx = this.context
				while(ctx){
					var nm = name
					macro = ctx[name]
					while(macro && macro._ast_){
						var ret
						if(ret = this.macro_match_args(n, name, macro, args)) return [macro, ret]
						found = true
						nm = nm + '_'
						macro = this.context[nm]
					}
					if(ctx.owner == ctx) break
					ctx = ctx.owner
				}
			}
			
			var nm = name
			var macros = this.module.macros
			macro = macros[nm]
			while(macro){
				macro.id.parent = macro
				var ret
				if(ret = this.macro_match_args(n, name, macro.id, args)) return [macro.id, ret]
				found = true
				nm = nm + '_'
				macro = macros[nm]
			}

			var im = this.module.imports
			for(var i = 0, l = im.length; i < l; i++){
				var macros = im[i].macros
				if(macros && (macro = macros[name])){
					var nm = name
					while(macro){
						macro.id.parent = macro
						var ret
						if(ret = this.macro_match_args(n, name, macro.id, args)) return [macro.id, ret]
						found = true
						nm = nm + '_'
						macro = macros[nm]
					}
				}
			}
			if(found){
				var types = ''
				for(var i = 0;i<args.length;i++)
					types += args[i].infer?args[i].infer.name:'unknown'
				throw new Error('Macro '+name+' used but not matching any arg types:' +types)
			}
		}

		this.macro_call = function( n, name, args ){
			
			var ret
			args.expanded = undefined
			if(ret = this.find_macro(n, name, args)){
				// lets check type
				var macro = ret[0], macro_generics = ret[1]
				if(macro.type == 'Function'){
					var params = macro.params
					var gen = 'macro_' + name
					for(var i = 0, l = params.length; i < l; i++){
						var typing = params[i].id.typing
						gen += '_'+(typing && typing.name || 'var')
					}
					if(!this.type_methods[gen]){

						var old_depth = this.depth
						var old_scope = this.scope
						var old_arg = this.macro_args
						var old_generics = this.generics
						var old_module = this.module
						var old_locals = this.locals
						this.locals = undefined
						this.macro_args = undefined
						this.scope = Object.create(null)
						this.depth = ''
						this.generics = macro_generics
						if(macro.module && macro.module != old_module) this.module = macro.module

						this.type_methods[gen] = this.Function(macro, gen, undefined, true)
						this.locals = old_locals
						this.module = old_module
						this.depth = old_depth
						this.scope = old_scope
						this.macro_args = old_arg
						this.generics = old_generics
					}
					var ret = gen + '.call(this'
					// set up the call and argument list
					var exp = args.expanded
					for(var i = 0, l = exp.length; i < l; i++){
						ret += ', ' + exp[i]
					}
					ret += ')'
					return ret
				}
				else if(macro.type == 'Call'){
					// inline macro expansion
					var old_arg = this.macro_args
					var marg = this.macro_args = Object.create(this.macro_args || null)
					var params = macro.args
					// build up macro args
					for(var i = 0; i < params.length; i++){
						var param = params[i]
						if(param.type == 'Assign'){
							throw new Error('implement macro default arg')
						}
						this.macro_args[param.name] = args.expanded[i]
					}
					var old_module = this.module
					var old_generics = this.generics
					this.generics = macro_generics

					if(macro.module && macro.module != old_module) this.module = macro.module
					var ret = this.expand(macro.parent.value, n)

					this.macro_args = old_arg
					this.module = old_module
					this.generics = old_generics
					return ret
				}
				else throw new Error('Macro call, but wrong type '+name+' '+macro.id.type)
			}
		}
		
		this._compile_assert = function( n ){
			var argl = n.args
			if(!argl || argl.length == 0 || argl.length > 2) throw new Error("Invalid assert args")
			
			var arg = this.expand(argl[0], n)
			var msg = argl.length > 1? this.expand(argl[1], n): '""'
			var value = 'undefined'
			
			if(argl[0].type == 'Logic' && argl[0].left.type !== 'Call'){
				value = this.expand( argl[0].left, n )
			}
			
			var body = '(function(){throw new Assert("'+
				arg.replace(/"/g,'\\"').replace(/\n/g,'\\n')+'",'+
				msg+','+value+')}).call(this)'
			
			if(outer.IsExpr[n.parent.type] && argl[0].type == 'Logic'){
				return arg + ' || ' + body
			}
			return '(('+arg+') || '+body+')'
		}
		
		this.ThisCall = function( n ){
			var obj = n.object
			var object_t = obj.type
			var object = this.expand(obj, n)
			if(object_t !== 'Index' && object_t !== 'Id' && object_t !== 'Key' && object_t !== 'Call'&& object_t !== 'This' && object_t !== 'ThisCall')
				object = '(' + object + ')'
			
			return  object + '.' + n.key.name
		}

		this.Call = function( n ){
			var fn  = n.fn
			fn.parent = n
			// assert macro
			var mname
			if(fn.type == 'Id' && (mname = '_compile_'+fn.name) in this){
				return this[mname](n)
			}
			
			var args = n.args
			
			// add extra args for processing
			//if(n.first_args) args = Array.prototype.concat.apply(n.first_args, args)
			//if(n.last_args) args = Array.prototype.concat.apply(args, n.last_args)
			if(n.isnew) args = Array.prototype.concat.apply(['this'], args)
			
			var arglen = args.length
			
			if(fn.type == 'Id' || (fn.type == 'Index' && fn.object.type == 'Id') || fn.type == 'ThisCall'){
				
				var name
				var dims
				var old_context
				if(fn.type == 'Id'){
					name = fn.name
										
					if(name == 'super'){
						if(args){
							args = args.slice(0)
							args.unshift('arguments')
						}
						else args = ['arguments']
						arglen = args.length
						name = undefined
					}
				}
				else if(fn.type == 'Index'){
					name = fn.object.name
					// dims might be dynamic
					dims = fn.index || 0
				}
				else if(fn.type == 'ThisCall'){ // support for calling macros on other objects
					// check if our object is in locals or context, ifso switch context and find macro
					if(fn.object.type == 'Id'){
						var new_context = 
							this.locals && this.locals[fn.object.name] || 
							this.context && this.context[fn.object.name]
						if(new_context){
							name = fn.key.name
							old_context = this.context
							this.context = new_context
						}
					}
				}
				if(name !== undefined){
					var type = this.find_type(name)
					if(type) return this.struct_constructor(n, dims, args, type)

					// check if its a macro
					var macro_call = this.macro_call(n, name, args)
					if(old_context) this.context = old_context
					if(macro_call !== undefined) return macro_call
				}
			}
			
			// new or extend
			if(fn.type == 'Key'){
				// check if we are a property access on a
				// what we need to trace is the root object
				var sthis = outer.AST.isKeyChain(fn)
				if(sthis && sthis.name){
					var isstatic
					var type = this.scope[sthis.name] || (isstatic = this.find_type(sthis.name))
					if(typeof type == 'object' && !type._ast_){
						// alright we are a method call.
						if(fn.object.type !='Id') throw new Error('only 1 deep method calls for now')
						// so first we are going to compile the function
						var method = fn.key.name
						
						return this.struct_method(n, type, method, args, isstatic?undefined:sthis)
					}
				}
				
				if(fn.key.type == 'Id'){
					var name = fn.key.name
					// dont mess with it
					if(name == 'call' || name == 'apply' || name == 'bind'){
						return this.expand(n.fn, n) + '(' + this.list(n.args, n) + ')'
					}
				}
			}
			
			var isapply = false
			var sarg = ''
			if(arglen){
				for(var i = 0; i < arglen; i++){
					if(args[i].type == 'Rest') break
				}
				// do the splat transform
				if(i != arglen){
					isapply = true
					var last = 0
					for(var i = 0; i < arglen; i++){
						var arg = args[i]
						if(arg.type == 'Rest'){
							if(i == 0){ // is first arg
								if(arglen == 1){ // we are the only one
									var id = arg.id
									if(id === undefined  || id.name == 'arguments'){
										sarg = 'arguments'
									}
									else sarg = this.expand(id, n)
								}
								else{
									var id = arg.id
									if(id === undefined  || id.name == 'arguments'){
										sarg = 'Array.prototype.slice.call(arguments,0)'
									}
									else sarg = this.expand(id, n)
								}
							}
							else{
								if(last == 1) sarg += ']'
								else if(last == 2) sarg += ')'
								var id = arg.id
								if(id === undefined  || id.name == 'arguments'){
									sarg = 'Array.prototype.concat.apply(' + sarg + ', arguments)'
								}
								else{
									sarg = 'Array.prototype.concat.apply('+
										sarg + ',' + this.space + this.expand(id, n) +')'
								}
							}
							last = 3
						}
						else { // normal arg
							if(last == 0){ // nothing before us
								sarg += '['
								last = 1
							}
							else if(last == 3){ // an array before us
								sarg += '.concat('
								last = 2
							}
							else { // a normal value
								sarg += ',' + this.space
							}
							if(typeof arg == 'string') sarg += arg
							else sarg += this.expand(arg, n)
						}
					}
					if(last == 1) sarg += ']'
					else if(last == 2) sarg += ')'
				}
				else {
					for(var i = 0; i < arglen; i++){
						if(i) sarg += ',' + this.space
						var arg = args[i]
						if(typeof arg == 'string') sarg += arg
						else sarg += this.expand(arg, n)
					}
				}
			}
			// so if we are a single Id, we call using .call(this')
			var cthis = ''
			var call = ''
			var fastpath
			if(fn.type == 'Id'){
				cthis = 'this'
				call = this.expand(fn, n)
				if(!(fn.name in this.scope) && fn.name in this.globals) fastpath = true
			}
			else {
				// check if we are a property chain
				if(fn.type == 'Key' || fn.type == 'Index'){
					fastpath = 1
					if(outer.AST.isKeyChain(fn)){
						// check if we are doing some native access
						// no tempvar
						cthis = this.expand(fn.object, fn)
						//if(this.globals[cthis] || cthis == 'gl') fastpath = 1
						if(fn.type == 'Index') call = cthis + '[' + this.expand(fn.index, fn) + ']'
						else{
							var name = fn.key.name
							//if(name in String.prototype) fastpath = 1
							//if(name in Array.prototype) fastpath = 1
							//if(name in Object.prototype) fastpath = 1
							call = cthis + '.' + name
						}
					}
					else { // we might be a chain on a call.
						// use a tempvar for the object part of the key
						this.find_function(n).call_var = 1
						cthis = this.call_tmpvar
						call = '('+this.call_tmpvar+'=' + this.expand(fn.object, fn) + ')'
						if(fn.type == 'Index') call +=  '[' + this.expand(fn.index, fn) + ']'
						else call += '.' + fn.key.name
					}
				}
				else if(fn.type == 'ThisCall'){
					cthis = 'this'
					call = this.expand(fn, n)
				}
				else{
					cthis = 'this'
					call = this.expand(n.fn, n)
					var ftype = n.fn.type
					if(ftype == 'Assign' || ftype == 'Logic' || ftype == 'Condition')
						call = '(' + call + ')'
				}
			}
			if(n.isnew){
				cthis = call
				call += '.new'
			}
			if(fn.type == 'Function') call = '(' + call + ')'
			
			if(isapply) return call +'.apply(' + cthis + (sarg?','+this.space+sarg:'') + ')'
			//fastpath Math
			if(fastpath) return call + '(' + sarg + ')'
			return call +'.call(' + cthis + (sarg?',' + this.space + sarg:'') + ')'
		}
		
		this.Nest = function( n ){
			var fn = n.fn
			
			if(fn.type == 'Id'){
				if(fn.flag == 35){ // function as a block comment
					return ''
				}
				// a signal block
				if( fn.name == 'signal'){
					return 'this.__wrapSignal__(' + this.Function( n, null, ['signal'] ) +'.bind(this))'
				}
			}
			var name = n.fn
			var id 
			if(n.fn.type == 'Id' && n.fn.typing){
				// just use the .call property
				var exp = this.expand(n.fn.typing, n)
				return 'this.'+n.fn.name + " = " + exp + '.call('+exp+', ' + this.Function( n, undefined, ['__outer__']) + ', this, "' + n.fn.name + '")'
			}
			// just use the .call property
			var exp = this.expand(n.fn, n)
			return exp + '.call('+exp+', ' + this.Function( n, undefined, ['__outer__'] ) + ', this)'
		}
		
		this.AssignQuote = function( n ){
			return  this.expand(n.left, n) + ' = ' + this.Quote( n )
		}

		this.Quote = function( n, from ){
			// we need to check for % vars and pass them into parse.
			var esc = outer.ToEscaped
			var tpl = esc.templates = Object.create(null)
			var locals = esc.locals = Object.create(null)
			esc.scope = this.scope
			// now we need to set the template object
			esc.depth = this.depth
			var body = esc.expand(from || n.quote, n)
			// cache the AST for parse()
			
			if(this.module && this.module.parser_cache)
				this.module.parser_cache[body.replace(/\\n\\/g,'')] = from || n.quote

			var obj = ''
			for(var name in tpl){
				if(obj) obj += ','
				obj += name+':'+(name in this.scope?name:'this.'+name)
			}
			var sobj = ''
			for(var name in locals){
				if(sobj) sobj += ','
				sobj += name+':'+name
			}

			return 'this._parse("' + body + '",__module__,'+(sobj?'{'+sobj+'}':'null')+(obj?',{' + obj + '})':')')
		}
		
		this.Rest = function( n ){
			throw new Error("dont know what to do with isolated rest object")
		}
	})
}

ONE.genjs_compat_ = function(){
	// promise generator function wrapper
	this.await = function( generator, bound, _catch ){
		var ret = function(){
			var iter = generator.apply(this, arguments)
			return ONE.__Base__.wrapSignal(function(sig){
				function error(e){
					sig.throw(e)
				}
				function next( value ){
					var iterval = iter.next( value )
					if(iterval.done === false){ // we have a promise
						iterval.value.then( next, error )
					}
					else{
						sig.end( iterval.value )
					}
				}
				next()
			})
		}
		if(bound) return ret.bind(bound)
		return ret
	}

	this.iterator = function( what ){
		// check what it is.
		if(what === null || what === undefined) return
		if(typeof what.next == 'function') return what
		if(typeof what != 'object') throw new Error('Cannot iterate over object')
	
		if(!Array.isArray(what)){
			var obj = what
			what = []
			for( var k in obj ) what.push( obj[ k ] )
		}
	
		var len = what.length
		if(!len) return
		return {
			next:function(){
				this.index++
				if(this.index >= this.length - 1) this.done = true
				this.value = what[this.index]
				return this
			},
			done: false,
			index: -1,
			length: len
		}
	}

	var Assert_ =  function(txt, why, value){
		this.toString = function(){
			var msg = "Assert failed: " + txt + 
				(why?"  why: "+why:'')+
				(value!==undefined?"  got value: "+value:"")
			return msg
		}
	}
	if(typeof window !== 'undefined'){
		window.Assert = Assert_
		ONE.reloader = function(){
			var rtime = Date.now()
			var x = new XMLHttpRequest()
			x.onreadystatechange = function(){
				if(x.readyState != 4) return
				if(x.status == 200){
					return location.reload()
				}
				setTimeout(ONE.reloader, (Date.now() - rtime) < 1000?500:0)
			}
			x.open('GET', "/_reloader_")
			x.send()
		}
	}
	else if(typeof global !== 'undefined') global.Assert = Assert_
	else Assert = Assert_

	// make all constructors compatible with the ONEJS way
	Function.prototype.new = function(){
		var obj = Object.create(this.prototype)
		this.apply(obj, Array.prototype.slice.call(arguments, 1))
		return obj
	}
	
	// all X instanceOf Y is rewritten as Y prototypeOf X
	// to map the simplified ONE class model to JS
	Function.prototype.prototypeOf = function( other ){
		return other instanceof this
	}

	Float32Array.prototype.set = function(x, y){
		for(var i = 0, l = arguments.length;i < l;i++)this[i] = arguments[i]
	}

	Float32Array.prototype.__defineGetter__('x', function(){ return this[0] })
	Float32Array.prototype.__defineGetter__('y', function(){ return this[1] })
	Float32Array.prototype.__defineGetter__('z', function(){ return this[2] })
	Float32Array.prototype.__defineGetter__('w', function(){ return this[3] })
	Float32Array.prototype.__defineGetter__('r', function(){ return this[0] })
	Float32Array.prototype.__defineGetter__('g', function(){ return this[1] })
	Float32Array.prototype.__defineGetter__('b', function(){ return this[2] })
	Float32Array.prototype.__defineGetter__('a', function(){ return this[3] })
	Float32Array.prototype.__defineGetter__('s', function(){ return this[0] })
	Float32Array.prototype.__defineGetter__('t', function(){ return this[1] })
	Float32Array.prototype.__defineGetter__('p', function(){ return this[2] })
	Float32Array.prototype.__defineGetter__('q', function(){ return this[3] })
	Float32Array.prototype.__defineSetter__('x', function(v){ this[0] = v })
	Float32Array.prototype.__defineSetter__('y', function(v){ this[1] = v })
	Float32Array.prototype.__defineSetter__('z', function(v){ this[2] = v })
	Float32Array.prototype.__defineSetter__('w', function(v){ this[3] = v })
	Float32Array.prototype.__defineSetter__('r', function(v){ this[0] = v })
	Float32Array.prototype.__defineSetter__('g', function(v){ this[1] = v })
	Float32Array.prototype.__defineSetter__('b', function(v){ this[2] = v })
	Float32Array.prototype.__defineSetter__('a', function(v){ this[3] = v })
	Float32Array.prototype.__defineSetter__('s', function(v){ this[0] = v })
	Float32Array.prototype.__defineSetter__('t', function(v){ this[1] = v })
	Float32Array.prototype.__defineSetter__('p', function(v){ this[2] = v })
	Float32Array.prototype.__defineSetter__('q', function(v){ this[3] = v })

	function _Float32Vector(dim, type){
		this._t_ = Object.create(type || null)
		this._t_.dim = dim
		this.__length = dim
		this._array_ = new Float32Array(dim * type.slots)
	}

	_Float32Vector.prototype.__defineGetter__('length', function(){ return this.__length })
	_Float32Vector.prototype.__defineSetter__('length', function(dim){ 
		var length = dim
		if(length < 0){
			length = -length
			this._transfer_allways_ = true
			if(length != this._t_.dim){ // always destructively resize when not equal
				this._t_.dim = length
				this._array_ = new Float32Array(this._t_.dim * this._t_.slots)
			}
		}
		else if(length > this._t_.dim){
			var old_array = this._array_
			this._t_.dim = Math.max(length, 6) * 2
			var array = this._array_ = new Float32Array(this._t_.dim * this._t_.slots)
			// a f*ing for loop to memcpy potentially huge things. 'the JIT will save us all'.
			if(this._transfer_allways_) console.log('Warning resizing a transfer_always Float32Vector ' + length)
			if(this.__length > 1000) console.log('Warning Float32Vector resize triggered ' + length)
			for(var i = 0, e = this.__length * this._t_.slots; i < e; i++) array[i] = old_array[i]
		}
		if((length || this.__length != length) && this._clean_){
			this._clean_ = false
			if(this._bind_) ONE.host.vector_queue.push(this)
		}
		this.__length = length
	})

	// create a compacted transferable
	_Float32Vector.prototype._transfer_ = function(host){
		this._clean_ = true
		var array
		if(this._transfer_always_){ // just swap the typed array
			array = this._array_
			this._array_ = new Float32Array(this._t_.dim * this._t_.slots)
		}
		else{
			// copy the exact sized array out
			array = new Float32Array(this._array_.buffer, 0, this.__length * this._t_.slots)
		}
		host.transferToHost(array.buffer)
		return {
			_array_:{buffer:array.buffer},
			length:this.__length
		}
	}
	// catch people using it untyped
	for(var i = 0;i<3;i++){
		Object.defineProperty(_Float32Vector.prototype,i,{
			get:function(){throw new Error('Guard property hit: Please cast object property to local typed var to access Float32Vector') },
			set:function(){throw new Error('Guard property hit: Please cast object property to local typed var to access Float32Vector') },
			enumerable:false
		})
	}
	if(typeof window !== 'undefined'){
		window.Float32Vector = _Float32Vector
	}
	else if(typeof global !== 'undefined'){
		global.Float32Vector = _Float32Vector
	}
	else{
		Float32Vector = _Float32Vector
	}


	//!TODO add the swizzles: ok now xy yx xyz zyx zxy yzx yzx rgb bgr xyzw wzyx bgra

	Object.defineProperty( Array.prototype, 'last', {
		configurable:false,
		enumerable:false,
		get:function(){
			return this[this.length - 1]
		},
		set:function(value){
			this[this.length - 1] = value
		}
	})
	
	Object.defineProperty( Array.prototype, 'first', {
		configurable:false,
		enumerable:false,
		get:function(){
			return this[0]
		},
		set:function(value){
			this[0] = value
		}
	})
	
	Math._mod = function( x, y ){
		return (x%y+y)%y
	}

	Math._sign = function(v){
		if(v === 0) return 0
		if(v < 0 ) return -1
		return 1
	}

	Math._fract = function(v){
		return v - Math.floor(v)
	}

	Math._clamp = function(x, mi, ma){
		if(x < mi) return mi
		if(x > ma) return ma
		return x
	}

	Math._mix = function(a, b, f){
		return a + f * (b - a)
	}

	Math._step = function(e, v){
		if(v < e) return 0
		return 1
	}
}