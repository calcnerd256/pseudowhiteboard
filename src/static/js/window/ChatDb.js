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
 var that = this;
 var cook = this.middleware.reduce(
  function(prom, oven, i, a){
   return prom.then(
    function(dat){
     return Promise.resolve(oven[0]).then(
      function(filter){
       return filter(dat, that);
      }
     ).then(
      function(hungry){
       if(!hungry) return Promise.resolve(dat);
       return oven[1](dat, that);
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
ChatDb.prototype.getLegacyLines = function getLegacyLines(){
 return this.lines.map(
  function(line){
   return line.slice(1);
  }
 );
};
ChatDb.prototype.promiseDereference = function promiseDereference(reference){
 var that = this;
 return Promise.resolve(reference).then(
  function(ref){
   if("@" != (""+ref).charAt(0))
    return Promise.reject(["not a reference"], ref, "missing initial @");
   ref = ref.split("@")[1].split(")")[0].split(" ")[0];
   if("" + (+ref) != "" + ref)
    return Promise.reject(["not a reference"], ref, "non-numeric");
   return that.lines[+ref];
  }
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
AssertEqual.prototype.resolve = function(value){
 if(this.satisfiedp()) return Promise.resolve(value);
 return Promise.reject(this);
};

function chatBodyIsLisp(body){
 // all symbolic expressions are lists, for now
 var prefix = "/lisp (";
 return body.substring(0, prefix.length) == prefix;
}
function chatBodyToLisp(body, room){
 if(2 > arguments.length) room = promiseReadChatroom();
 if(!chatBodyIsLisp(body)) return null;
 var prefix = "/lisp (";
 var remainder = body.substring(prefix.length);
 if(!remainder.length) return null;
 if(")" != remainder.charAt(remainder.length - 1)) return null;
 // assume flat list, for now
 return Promise.all(
  remainder.substring(0, remainder.length - 1).split(" ").filter(I).map(
   function(token){
    if("@" == token.charAt(0))
     return Promise.resolve(room).then(
      function(db){
       if(db instanceof ChatDb)
        return db.promiseDereference(token);
       return promiseDerefChat(token, db);
      }
     ).then(
      function(record){
       var symbolics = chatRecordLispHavers(record);
       if(symbolics.length) return symbolics[0].lisp;
       return token;
      }
     );
    return token;
   }
  ).map(Promise.resolve.bind(Promise))
 );
}
var lispParseMiddleware = [
 function(labt){
  var l = labt[0];
  var a = labt[1];
  var b = labt[2];
  var t = labt[3];
  return chatBodyIsLisp(b);
 },
 function(labt, room){
  var l = labt[0];
  var a = labt[1];
  var b = labt[2];
  var t = labt[3];
  return Promise.resolve(
   chatBodyToLisp(b, room)
  ).then(
   function(symbolicExpression){
    symbolicExpression.line = labt.slice();
    symbolicExpression.toString = function toString(){
     var tokens = this.map(
      function quote(token){
       if("string" == typeof token)
        return "\"" + (
         "" + token
        ).split("\\").join("\\\\").split("\"").join("\\\"") + "\"";
       if("object" == typeof token){
        if(token instanceof Array)
         return toString.call(token);
        return "unknown_object:(" + (""+token).split(")").join("?") + ")";
       }
       return "error:" + typeof token;
      }
     );
     return "(" + tokens.join(" ") + ")";
    }
    symbolicExpression.line.push(
     {
      lineNumber: l,
      author: a,
      body: b,
      timestamp: t,
      lisp: symbolicExpression,
      toString: function toString(){return ""+symbolicExpression;}
     }
    );
    return symbolicExpression.line;
   }
  );
 }
];


function lispCar(symbolicExpression){
 return Promise.resolve(symbolicExpression).then(
  function(expr){
   return expr[0] // assume arrays for now
  }
 );
}
function arrayFromLispCdr(symbolicExpression){
 return Promise.resolve(symbolicExpression).then(
  function(expr){
   return Promise.all(
    expr.slice(1).map( // assume arrays
     Promise.resolve.bind(Promise)
    )
   );
  }
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
   return Promise.all(
    dr.map(Promise.resolve.bind(Promise))
   ).then(
    function(args){
     return [ar].concat(args);
    }
   );
  }
 );
}

function promiseSendLisp(symbolicExpression){
 // for now, only flat lists of strings are supported
 return Promise.resolve(symbolicExpression).then(
  function(promises){
   return promises.map(Promise.resolve.bind(Promise));
  }
 ).then(
  Promise.all.bind(Promise)
 ).then(
  function(expr){
   return expr.map(
    function(token){
     if(1 == (""+token).split(" ").length)
      return token;
     // assume no quoted strings containing spaces, for now
     return token;
    }
   ).join(" ");
  }
 ).then(
  function(inner){
   return "/lisp (" + inner + ")";
  }
 ).then(promiseSendMessage);
}
