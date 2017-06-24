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

Stroke.prototype.typeName = "stroke";

Stroke.prototype.toRefString = StrokePoint.prototype.toRefString;
Stroke.prototype.hasRef = StrokePoint.prototype.hasRef;
Stroke.prototype.toString = function(){
 if(this.hasRef())
   return this.toRefString();
 return "(stroke " + this.points.join(" ") + ")";
};

Stroke.prototype.done = false;

function promiseDerefChat(reference, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 return promiseArgs([reference, room]).then(
  function(args){
   var ref = args[0];
   var lines = args[1];
   if(lines instanceof ChatDb) return lines.promiseDereference(ref).slice(1);
   if("@" != (""+ref).charAt(0))
    return Promise.reject(["not a reference", ref]);
   ref = ref.split("@")[1].split(")")[0];
   return lines[+ref];
  }
 );
}

Stroke.promiseFromChat = function promiseFromChat(line, room){
 if(arguments.length < 2) room = promiseReadChatroom();
 var author = line[0];
 var body = line[1];
 var tokens = body.split(" ").filter(I);
 var assertion = new AssertEqual("/lisp", tokens.shift());
 if(!assertion.satisfiedp()) return Promise.reject(assertion);
 assertion = new AssertEqual("(stroke", tokens.shift());
 if(!assertion.satisfiedp()) return Promise.reject(assertion);
 var result = new this();
 return Promise.all(
  tokens.map(
   function(token){
    return token.split(")")[0];
   }
  ).map(
   function(lineNumber){
    return StrokePoint.promiseFromChatLineNumber(lineNumber, room);
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
   return "/lisp (" + tokens.join(" ") + ")";
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
