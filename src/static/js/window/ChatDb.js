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
