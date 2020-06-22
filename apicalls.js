var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const getRawBody = require('raw-body');

var app = express();
app.use(bodyParser.json({extended: false }));

var max_peers_length = 3
var potentialPeers=[]

pendingTransactions = [];
class Transaction{
    constructor(numInputs,inputs ,numOutputs ,outputs) {
        this.numInputs = numInputs
        this.inputs = inputs;
        this.numOutputs = numOutputs;
        this.outputs = outputs;
    }
}

var block_index=2;
function fill_peer_list(){
    var i=0;
    while (i < 1) { 
    request.post(
        {
        url:peers[i]+'/add',
        json: {
          "key":req.body.key,
          "value":req.body.value
            },
        headers: {
            'Content-Type': 'application/json'
        }
        },
      function(error, response, body){
        console.log("error  :" +error);
        //console.log(response);
        //console.log(JSON.stringify(body));
        console.log(body);
        res.send(body);
      });
      i++;
    }
}
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
    res.statusCode= 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    const data = fs.readFileSync('./blocks/'+req.params.num+'.dat');
    res.send(data);
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
var peers =[]


app.post('/newPeer',(req,res,next)=>{
    if(peers.indexOf(req.body.url)==-1){
        
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
            /**
            let obj = {"url" : "check"};
            obj = JSON.stringify(obj);
            res.send(obj);*/
            res.send(peers);
        }
    }
    else {
        res.statusCode = 500;
        console.log('node already present');
        res.send('node already present');
    }
        
});
app.get('/getPeers',(req,res,next)=>{
    res.setHeader('Content-Type', 'application/json');
    let obj = {"peers" : peers};
    obj = JSON.stringify(obj);
    res.send(obj);
});
app.post('/newBlock',(req,res,next)=>{

    //var data = req.body;
    //var buffer = Buffer.from(data,'binary');
    var buffer = req.body;
    fs.writeFile(`blocks/${block_index}.dat`, buffer, function (err) {
            if (err) throw err;
            console.log('Saved!');
          });
    block_index++;
    res.send("block added");
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
})
const port =8787
app.listen(port,function(error){

    if(error){
        console.log("this thing is fucked")
    } else{
        console.log('server listening on port '+port)
    }
})