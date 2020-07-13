var map = new Map();
var n = {};
let obj = {"firstName":"John", "lastName":"Doe"}
let obj2 = {"firstName":"John", "lastName":"e"}
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
    mapp[key] = mapp[key] || [];
    mapp[key].push(value);
}
console.log(n)