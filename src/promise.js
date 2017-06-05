function Future(){
 this.done = false;
 this.listeners = [];
}
Future.prototype.listen = function listen(listener){
 if(this.done) return listener(this.value);
 this.listeners.push(listener);
};
Future.prototype.resolve = function resolve(value){
 if(this.done) return;
 this.done = true;
 this.value = value;
 return this.listeners.map(
  function(f){return f(value);}
 );
};
function Maybe(value, error){
 if(arguments.length > 1) this.error = error;
 else this.value = value;
 this["throw"] = function(){
  throw(this.error);
 }
}
Maybe.prototype["throw"] = function(){
 if("error" in this)
  throw(this.error);
};

var Promise;
if(!Promise){
 Promise = function Promise(maker){
  var future = new Future();
  function resolve(value){
   if(value instanceof Object && ("then" in value))
    value.then(
     function(v){
      future.resolve(new Maybe(v));
     },
     function(e){
      future.resolve(new Maybe(null, e));
     }
    );
   else
    future.resolve(new Maybe(value));
  }
  function reject(error){
   future.resolve(new Maybe(null, error));
  }
  try{
   maker(resolve, reject);
  }
  catch(e){
   reject(e);
  }
  this.then = function(goodback, badback){
   return new Promise(
    function(res, rej){
     future.listen(
      function(m){
       var eim = "error" in m;
       var pass = eim ? rej : res;
       var p = eim ? m.error : m.value;
       var back = eim ? badback : goodback;
       if(!back) return pass(p);
       try{
        return res(back(p));
       }
       catch(e){
        return rej(e);
       }
      }
     );
    }
   );
  };
 }
 Promise.resolve = function(value){
  if(value instanceof Object)
   if("then" in value)
    return value;
  return new Promise(
   function(res){
    return res(value);
   }
  );
 }
 Promise.reject = function(error){
  return new Promise(
   function(res, rej){
    return rej(error);
   }
  );
 };
 try{
  exports.Promise = Promise;
 }
 catch(e){}
}
