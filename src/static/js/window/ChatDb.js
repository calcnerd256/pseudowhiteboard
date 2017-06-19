function I(x){return x;}

function K(x){
 function konstant(){
  return x;
 };
 konstant.x = x;
 return konstant;
}

function Stream(emitterCatcher){
 /*
  // usage:
  var emit;
  var s = new Stream(function(e, l){emit = e;});
  // then pass s to someone who might want to listen
  // and pass emit to the code responsible for generating data
 */
 var listeners = [];
 emitterCatcher(
  function emit(value){
   return listeners.map(
    function(listener){
     return listener(value);
    }
   );
  },
  listeners
 );
 this.listen = function(listener){
  listeners.push(listener);
 }
}
Stream.Naked = function(){
 // you can use this constructor if you don't care about privacy
 var that = this;
 this.stream = new Stream(
  function(emit, listeners){
   that.emit = emit;
   that.listeners = listeners;
  }
 );
}

function ChatDb(){
 this.lines = [];
 this.lineEmitter = new Stream.Naked();
 this.middleware = [];
}
ChatDb.prototype.append = function(line){
 var lineNumber = this.lines.length;
 this.lines.push(line);
 var cook = this.middleware.reduce(
  function(prom, oven, i, a){
   return prom.then(
    function(dat){
     return Promise.resolve(oven[0]).then(
      function(filter){
       return filter(dat);
      }
     ).then(
      function(hungry){
       if(!hungry) return Promise.resolve(dat);
       return oven[1](dat);
      }
     );
    }
   );
  },
  Promise.resolve([lineNumber].concat(line))
 );
 var that = this;
 return cook.then(
  function(meal){
   that.lines[lineNumber] = meal;
   that.lineEmitter.emit(meal);
  }
 );
};
ChatDb.prototype.sync = function sync(){
 var that = this;
 return promiseReadChatroom().then(
  function(lines){
   if(lines.length == that.lines.length) return [];
   return lines.slice(that.lines.length).map(that.append.bind(that));
  }
 );
};
ChatDb.prototype.run = function run(timestep){
 return this.sync().then(
  function(updates){
   if(!updates.length) timestep *= 1.1;
   else timestep /= 2;
   return new Promise(
    function(res, rej){
     setTimeout(res, timestep);
    }
   ).then(K(timestep));
  }
 ).then(
  this.run.bind(this)
 );
};


function AssertEqual(expected, found){
 this.expected = expected;
 this.found = found;
}
AssertEqual.prototype.escape = function(str){
 var slashed = ("" + str).split("\\").join("\\\\");
 return "\"" + slashed.split("\"").join("\\\"") + "\"";
};
AssertEqual.prototype.toString = function toString(){
 var escapedExpected = this.escape(this.expected);
 var escapedFound = this.escape(this.found);
 return "expected " + escapedExpected + ", but found " + escapedFound;
};
AssertEqual.prototype.satisfiedp = function satisfiedp(){
 return this.expected == this.found;
};

function chatBodyIsLisp(body){
 // all symbolic expressions are lists, for now
 var prefix = "/lisp (";
 return body.substring(0, prefix.length) == prefix;
}
function chatBodyToLisp(body){
 if(!chatBodyIsLisp(body)) return null;
 var prefix = "/lisp (";
 var remainder = body.substring(prefix.length);
 if(!remainder.length) return null;
 if(")" != remainder.charAt(remainder.length - 1)) return null;
 // assume flat list, for now
 return remainder.substring(0, remainder.length - 1).split(" ").filter(I);
}
var lispParseMiddleware = [
 function(labt){
  var l = labt[0];
  var a = labt[1];
  var b = labt[2];
  var t = labt[3];
  return chatBodyIsLisp(b);
 },
 function(labt){
  var l = labt[0];
  var a = labt[1];
  var b = labt[2];
  var t = labt[3];
  return [].concat.call(
   labt,
   [
    {
     lineNumber: l,
     author: a,
     body: b,
     timestamp: t,
     lisp: chatBodyToLisp(b),
     toString: function(){
      var tokens = this.lisp.map(
       function quote(token){
        return "\"" + (
         "" + token
        ).split("\\").join("\\\\").split("\"").join("\\\"") + "\"";
       }
      );
      return "(" + tokens.join(" ") + ")";
     }
    }
   ]
  )
 }
];


function lispCar(symbolicExpression){
 return Promise.resolve(
  symbolicExpression[0] // assume arrays for now
 );
}
function arrayFromLispCdr(symbolicExpression){
 return Promise.all(
  symbolicExpression.slice(1).map( // assume arrays
   Promise.resolve.bind(Promise)
  )
 );
}
function arrayToLispCons(head, tail){
 // symbolic expressions are mere arrays for now
 return Promise.all(
  [head, tail].map(Promise.resolve.bind(Promise))
 ).then(
  function(ardr){
   var ar = ardr[0];
   var dr = ardr[1];
   return Promise.all(dr.map(Promise.resolve.bind(Promise))).then(
    function(args){
     return [ar].concat(args);
    }
   );
  }
 );
}
