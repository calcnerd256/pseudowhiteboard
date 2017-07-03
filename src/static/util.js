function I(x){return x;}

function K(x){
 function konstant(){
  return x;
 };
 konstant.x = x;
 return konstant;
}

function has(ob, key){
 if("object" != typeof ob) return false;
 return key in ob;
}
