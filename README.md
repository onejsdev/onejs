ONEJS
=====

WebGL UI Toolkit and Javascript superset - UNDER HEAVY DEVELOPMENT, DO NOT USE, WILL CHANGE A LOT!

OneJS aims to bridge the gap between the GPU and your JS code by unifying the types between the languages, and adding a host of features to JS, a small subset of which is:

- Type-inferenced GLSL-like typesystem, so you can use vec2 x; float y; struct t{ float x, y} and typed arrays
- Compiler always runs in browser to support runtime shader compilation and metaprogramming (unlike coffeescript)
- Compile time module system (necessary for type support)
- Full ES6 featureset minus generator expressions
- ES7 await keyword
- User code runs in a worker, render code runs in the main browser thread; it has an out-of-process DOM. 
- Metaprogramming and symbolic assignment syntax x = :y+1 and x:y+1 are the same. x is now the AST node of y+1
- Backwards compatible with JS with the following changes:  
  Use of label: syntax is re-purposed for 'symbolic assignment', labels will get another syntax
- Finally safe to not use semicolons in your code: x\n(t || 2) or x\n[1,2] are no longer calls/indexes. OneJS tries to deliver all the niceties of coffeescript but keeping backwards compatibility with JS code. So optional commas and string interpolation and tons more.

OneJS aims to be compatible with all current day webbrowsers that support webGL and workers, and also run on nodejs.
Including now iOS8 and Android. It is a new dawn for the web!

Run it (use node 0.11 or higher, check out the use of await, ah its nice to live in the future)

node --harmony one_node.js app_server.n

open in browser:
http://localhost:2000#tests/jsconf
http://localhost:2000#tests/framebuf
etc.

(onejs apps are served using the #hash)

Sofar you can find the same files accessible as: http://jsconf.tests.onejs.io using the subdomain name

OneJS is currently getting a fully fledged UI kit with constraints, and a font engine. Stay tuned.
