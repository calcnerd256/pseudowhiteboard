function ZoomPan(thumb, finger){
 this.thumb = thumb;
 this.finger = finger;
}
ZoomPan.prototype.endpoints = function endpoints(){
 var tps = this.thumb.points;
 if(!tps.length) return [];
 var fps = this.finger.points;
 if(!fps.length) return [];
 if(tps.length < 2)
  if(fps.length < 2)
   return [];
 return [tps[0], fps[0], tps[tps.length - 1], fps[fps.length - 1]];
};
ZoomPan.prototype.transformators = function(){
 var endpoints = this.endpoints();
 if(4 != endpoints.length) return [];
 var ta = endpoints[0];
 var tb = endpoints[2];
 var fa = endpoints[1];
 var fb = endpoints[3];
 var max = (ta.x + fa.x) / 2;
 var may = (ta.y + fa.y) / 2;
 var mbx = (tb.x + fb.x) / 2;
 var mby = (tb.y + fb.y) / 2;
 var dx = mbx - max;
 var dy = mby - may;
 var dxa = fa.x - ta.x;
 var dya = fa.y - ta.y;
 var dxb = fb.x - tb.x;
 var dyb = fb.y - tb.y;
 var ra = dxa * dxa + dya * dya;
 var rb = dxb * dxb + dyb * dyb;
 if(!ra) ra = rb;
 return [dx, dy, Math.sqrt(rb / ra)];
};
ZoomPan.prototype.draw = function draw(cam){};
ZoomPan.prototype.transform = function(camera){
 var transformers = this.transformators();
 if(3 != transformers.length) return camera;
 var dx = transformers[0];
 var dy = transformers[1];
 var rho = transformers[2];
 return camera.zoomPan(dx, dy, rho);
};

function Gesture(){
 this.strokes = [];
 var resolve = null;
 this.promise = new Promise(
  function(res, rej){
   resolve = res;
  }
 );
 this.end = function end(cam){
  resolve(this);
 }
}
Gesture.prototype.isZoomPan = function isZoomPan(){
 return 2 == this.strokes.length;
};
Gesture.prototype.toZoomPan = function toZoomPan(){
 return new ZoomPan(this.strokes[0], this.strokes[1]);
};
Gesture.prototype.updateCamera = function updateCamera(cam){
 if(!this.isZoomPan()) return cam;
 return this.toZoomPan().transform(cam);
};
Gesture.prototype.addStroke = function addStroke(stroke){
 this.strokes.push(stroke);
};
Gesture.prototype.isDone = function isDone(){
 return this.strokes.every(
  function(stroke){
   return stroke.done;
  }
 );
};
Gesture.promiseFromChat = function promiseFromChat(line, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 var author = line[0];
 var body = line[1];
 var tokens = body.split(" ").filter(I);
 var assertion = new AssertEqual("(gesture", tokens.shift());
 if(!assertion.satisfiedp()) return Promise.reject(assertion);
 var result = new this();
 return Promise.all(
  tokens.map(
   function(token){
    return promiseDerefChat(
     token.split(")")[0],
     room
    ).then(
     function(line){
      return Promise.resolve(chatBodyToLisp(line[1], room)).then(
       Stroke.promiseFromLispPromise.bind(Stroke)
      );
     }
    );
   }
  )
 ).then(
  function(xs){
   return xs.filter(I);
  }
 ).then(
  function(strokes){
   result.strokes = strokes;
   return result;
  }
 );
};
Gesture.prototype.toPromiseChat = function toPromiseChat(){
 return Promise.all(
  this.strokes.map(
   function(stroke){
    if("msgid" in stroke)
     return Promise.resolve(stroke.msgid);
    return Promise.resolve(stroke.send());
   }
  )
 ).then(
  function(stids){
   var tokens = [].concat(
    [
     "gesture"
    ],
    stids.map(
     function(strokeId){
      return "@" + (+strokeId);
     }
    )
   );
   return "(" + tokens.join(" ") + ")";
  }
 );
};

Gesture.prototype.send = function send(){
 if("msgid" in this)
  return Promise.resolve(this.msgid);
 var that = this;
 this.msgid = this.toPromiseChat().then(
  promiseSendMessage
 ).then(
  function(msgid){
   if(!msgid)
    delete that.msgid;
   else
    that.msgid = +msgid;
   if("msgid" in that)
    return that.msgid;
   return Promise.reject(that);
  }
 );
 return this.msgid;
};
Gesture.prototype.draw = function draw(cam){
 if(!this.isDone())
  return this.strokes.map(
   function(stroke){
    return stroke.draw(cam);
   }
  );
 if(1 == this.strokes.length)
  return [this.strokes[0].draw(cam)];
 if(2 < this.strokes.length) // TODO: remove this case
  return this.strokes.map(
   function(stroke){
    return stroke.draw(cam);
   }
  );
};
