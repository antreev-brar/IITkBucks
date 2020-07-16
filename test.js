var map = new Map();
var n = new Map();;
let obj = {"firstName":10, "lastName":"Doe"}
let obj2 = {"firstName":10, "lastName":"e"}
//let p = JSON.parse(obj);
map.set(["string1","string2"],obj)
map.set(["string3","string2"],obj)
map.set(["string4","string2"],obj2)

console.log(map);
for(let [key, value] of map){
    //var split = i.split(',')
    console.log(key[0])
    let ob ={"transactionId":key[0],"index":key[1],amount:value.firstName}

    addValueToList(n,value.lastName,ob)
}
function addValueToList(mapp,key, value) {
    //if the list is already created for the "key", then uses it
    //else creates new list for the "key" to store multiple values in it.
    if(mapp.has(key)){
    var list = mapp.get(key);
    list.push(value);
    mapp.set(key,list);
    }else{
      var list=[value];
      mapp.set(key,list);  
    }
}
aount=0;
console.log(n.get('Doe').length);
k=n.get('Doe');
for(let i=0;i< k.length;i++){
aount+=k[i].amount;
}console.log(aount);
/** 
var list = n.get('Doe');
var a =[];
a.push({'a':"b"})
list.push(obj)

console.log(list);
n.set('Doe',list)
console.log(n.get('Doe'));*/
