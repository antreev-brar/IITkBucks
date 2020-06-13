var express =require("express");
var bodyParser =require("body-parser");
var app = express();
var fs = require('fs');
app.use(bodyParser.json({extended: false }));
pendingTransactions = [];



app.get('/getBlock/:num',(req,res,next)=>{

    console.log(`index demanded is ${req.params.num}`);
    res.statusCode= 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    const data = fs.readFileSync('./blocks/'+req.params.num+'.dat');
    res.send(data);
})
app.get('/getPendingTransactions',(req,res,next)=>{
    let pending_txn = []
    for (var i = 0, len = pendingTransactions.length; i < len; i++) {
        let inputs__ =  pendingTransactions[i].Inputs;
        let outputs__ = pendingTransactions[i].Outputs;
        let temp = {}
        temp['inputs'] = inputs__;
        temp['outputs'] = outputs__;
        pending_txn.push(temp);
        }
        res.statusCode= 200;
        res.setHeader('Content-Type', 'application/json');
        res.send(pending_txn);
})
const port =8787
app.listen(port,function(error){

    if(error){
        console.log("this thing is fucked")
    } else{
        console.log('server listening on port '+port)
    }
})