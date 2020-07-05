var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const getRawBody = require('raw-body');
const Transaction = require ("./classes/Transaction");
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");


var app = express();
app.use(bodyParser.json({extended: false }));

var max_peers_length = 3
var potentialPeers=[]
var pendingTransactions = [];
var block_index=2;
var peers =[]

app.use(function (req, res, next) {
    if (req.headers['content-type'] === 'application/octet-stream') {
        getRawBody(req, {
            length: req.headers['content-length'],
            encoding: req.charset
        }, function (err, string) {
            if (err)
                return next(err);
            req.body = string;
            next();
         })
    }
    else {
        next();
    }
});

app.get('/getBlock/:num',(req,res,next)=>{

    console.log(`index demanded is ${req.params.num}`);
    var path = './blocks/'+req.params.num+'.dat';
    if (fs.existsSync(path)) {
         console. log("File exists.");
           //res.statusCode= 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        const data = fs.readFileSync(path);
        console.log(data.length)
        res.send(data);
    }else{
        console.log('file not found')
        res.sendStatus(404);
    }
});

app.get('/getPendingTransactions',(req,res,next)=>{
    let pending_txn = []
    for (var i = 0, len = pendingTransactions.length; i < len; i++) {
        let inputs__ =  pendingTransactions[i].inputs;
        let outputs__ = pendingTransactions[i].outputs;
        let temp = {}
        temp['inputs'] = inputs__;
        temp['outputs'] = outputs__;
        pending_txn.push(temp);
        }
        res.statusCode= 200;
        res.setHeader('Content-Type', 'application/json');
        res.send(pending_txn);
});

app.post('/newPeer',(req,res,next)=>{
    if(peers.indexOf(req.body.url)==-1 ){
        
        if(peers.length < max_peers_length){
            console.log(req.body.url);
            previous_length_peers = peers.length;
            peers.push(req.body.url);
            new_length_peers = peers.length;
            if(new_length_peers == previous_length_peers+1){
                res.send("peer added succesfully");
            }else{
                res.send("something is fishy");
            }
        }else{
            res.statusCode = 500;
            console.log('peer limit exceeded');
            res.send(peers);
        }
    }
    else {
        res.statusCode = 500;
        console.log('node already present');
        res.send(peers);
    }  
});

app.get('/getPeers',(req,res,next)=>{
    res.setHeader('Content-Type', 'application/json');
    let obj = {"peers" : peers};
    obj = JSON.stringify(obj);
    res.send(obj);
});

app.post('/newBlock',(req,res,next)=>{

    var buffer = req.body;

    if(verifyBlock(buffer)=== true)
    {
    killworker(worker);
    block_index++;
    fs.writeFile(`blocks/${block_index}.dat`, buffer, function (err) {
            if (err) throw err;
            console.log('Saved!');
          });

        res.send("block added");
    }
    else{
        console.log('not verified')
    }

});
app.post('/newTransaction',(req,res,next)=>{
        
        _inputs = req.body.inputs;
        _outputs = req.body.outputs;
        _numInputs = _inputs.length;
        _numOutputs = _outputs.length;

        console.log(JSON.stringify(_inputs));
        console.log(JSON.stringify(_outputs));
        console.log(JSON.stringify(_numInputs));
        console.log(JSON.stringify(_numOutputs));
        _transaction = new Transaction(_numInputs , _inputs ,_numOutputs,_outputs);
        pendingTransactions.push(_transaction);
       
       res.send("transaction added to PendingTransaction : Length"+pendingTransactions.length);
});
const port =8787
app.listen(port,function(error){

    if(error){
        console.log("this thing is fucked")
    } else{
        console.log('server listening on port '+port)
    }
});