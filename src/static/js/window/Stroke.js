function Stroke(index, camera, strokeStyle){
 this.points = [];
 if(arguments.length >= 1)
  this.index = index;
 if(arguments.length >= 2)
  this.camera = camera;
 if(arguments.length >= 3)
  this.strokeStyle = strokeStyle;
}

Stroke.prototype.strokeStyle = "#000000";

Stroke.prototype.moveTo = function moveTo(nextTouch, cam){
 this.camera = cam;
 this.ctx = cam.ctx;
 var p = cam.touchToPoint(nextTouch);
 this.x = p.x;
 this.y = p.y;
 this.points.push(p);
 if("previousTouch" in this)
  cam.drawSegment(
   this.previousTouch,
   p,
   "#8080ff",
   2
  );
 this.previousTouch = p;
};

Stroke.prototype.toString = function(){
 if("msgid" in this)
  if(("" + (+(this.msgid))) == ("" + (this.msgid)))
   return "@" + (+this.msgid) + ":stroke";
 return "(stroke " + this.points.join(" ") + ")";
};

Stroke.prototype.done = false;

Stroke.Point = function Point(x, y, t, r){
 this.x = x;
 this.y = y;
 this.t = t;
 this.r = r;
};
Stroke.Point.fromTouch = function fromTouch(touch, ctx){
 var x = touch.clientX;
 var y = touch.clientY;
 var t = new Date();
 var r = Math.max(touch.radiusX, touch.radiusY);
 return new this(x, y, t, r);
};

Stroke.Point.prototype.toString = function(){
 if("msgid" in this)
  if(("" + (+(this.msgid))) == ("" + (this.msgid)))
   return "@" + (+this.msgid) + ":point";
 return "<" + [this.x, this.y].join(", ") + ">(" + this.r + ")@" + this.t;
};


Stroke.Point.promiseFromLispPromise = function promiseFromLispPromise(sp){
 return sp.then(
  function(expr){
   return lispCar(expr).then(
    function(oper){
     var assertion = new AssertEqual("point", oper);
     if(!assertion.satisfiedp())
      return Promise.reject(assertion);
     return arrayFromLispCdr(expr);
    }
   ).then(
    function(xyrt){
     var assurtion = new AssertEqual(4, xyrt.length);
     if(!assertion.satisfiedp())
      return Promise.reject(assertion);
     var x = xyrt[0];
     var y = xyrt[1];
     var r = xyrt[2];
     var t = xyrt[3];
     return new Stroke.Point(+x, +y, new Date(+t), +r);
    }
   );
  }
 );
};
Stroke.Point.prototype.promiseToLisp = function promiseToLisp(){
 return arrayToLispCons(
  "point",
  [
   +(this.x),
   +(this.y),
   +(this.r),
   +(this.t - new Date(0))
  ]
 );
};
Stroke.Point.fromChat = function fromChat(line){
 var author = line[0];
 var body = line[1];
 var prefix = "/lisp (point ";
 if(prefix != body.substring(0, prefix.length)) return;
 var tokens = body.split(" ").filter(I);
 var x = tokens[2];
 var y = tokens[3];
 var r = tokens[4];
 var t = tokens[5].split(")")[0];
 return new Stroke.Point(+x, +y, new Date(+t), +r);
};
Stroke.Point.prototype.send = function promiseSend(){
 if("msgid" in this)
  return Promise.resolve(this.msgid);
 var that = this;
 this.msgid = this.promiseToLisp().then(
  promiseSendLisp
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

function promiseDerefChat(ref, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 if("@" != (""+ref).charAt(0))
  return Promise.reject(["not a reference", ref]);
 ref = ref.split("@")[1].split(")")[0];
 return Promise.resolve(room).then(
  function(lines){
   return lines[+ref];
  }
 );
}

Stroke.promiseFromChat = function promiseFromChat(line, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 var author = line[0];
 var body = line[1];
 var tokens = body.split(" ").filter(I);
 var assertion = {
  expected: "(stroke",
  found: tokens.shift()
 };
 if(assertion.expected != assertion.found)
  return Promise.reject(assertion);
 var result = new this();
 return Promise.all(
  tokens.map(
   function(token){
    return promiseDerefChat(
     token.split(")")[0],
     room
    ).then(
     function(line){
      return Stroke.Point.fromChat(line);
     }
    );
   }
  )
 ).then(
  function(xs){
   return xs.filter(I);
  }
 ).then(
  function(points){
   result.points = points;
   result.done = true;
   return result;
  }
 );
};
Stroke.prototype.toPromiseChat = function toPromiseChat(){
 return Promise.all(
  this.points.map(
   function(point){
    if("msgid" in point)
     return Promise.resolve(point.msgid);
    return point.send();
   }
  )
 ).then(
  function(ptids){
   var tokens = [].concat(
    [
     "stroke"
    ],
    ptids.map(
     function(ptid){
      return "@" + (+ptid);
     }
    )
   );
   return "(" + tokens.join(" ") + ")";
  }
 );
};
Stroke.prototype.send = function send(){
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

Stroke.prototype.end = function end(){
 this.done = true;
 var that = this;
 return this.send();
};
Stroke.prototype.draw = function(camera){
 var that = this;
 var colors = [
  "#ff0000",
  "#ff8000",
  "#ffff00",
  "#80ff00",
  "#00ff00",
  "#00ff80",
  "#00ffff",
  "#0080ff",
  "#0000ff",
  "#8000ff",
  "#ff00ff",
  "#ff0080"
 ];
 var done = this.done;
 var color = this.strokeStyle;
 return this.points.map(
  function(x, i, a){
   return camera.drawSegment(
    a[i?i-1:i],
    x,
    done ? color : colors[i % colors.length]
   );
  }
 );
};
