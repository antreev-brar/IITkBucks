var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const crypto = require("crypto");
const Transaction = require ("./classes/Transaction");
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");

var app = express();
app.use(bodyParser.json({extended: false }));

var potentialPeers=["http://localhost:8787/newPeer"];
var peers =[]
var max_peers_length = 3
var pendingTransactions = [];
unused_outputs = new Map();
var block_index=3;

//function to remove tranaction
function removeElement(array, elem) {
    var index = array.indexOf(elem);
    if (index > -1) {
        array.splice(index, 1);
    }
}
// this function is also present in verify transaction , that one should be deleted when all files are concatenated , this one has modification like return
function details(dat){
    const transactionID_I = crypto.createHash('sha256').update(Buffer.from(dat)).digest('hex');
    console.log("Transaction ID: "+transactionID_I );
    let Inputs = []
    let Outputs = [];

    var i=0;
    var num_inputsBuf = dat.slice(i,i+4);
    var num_inputs = num_inputsBuf.readInt32BE(0);
    console.log("Number of inputs:"+num_inputs+'\n');
    i=i+4;
    for(var j=1;j<=num_inputs;j++){
        console.log("\t Input "+j+": ");
        var transid =dat.slice(i,i+32);
        console.log("\t\tTransactionID :"+transid.toString('hex'));
        i=i+32;

        var indexBuf =dat.slice(i,i+4);
        var index = indexBuf.readInt32BE(0);
        console.log("\t\tIndex:"+index);
        i=i+4;

        var length_sign_buf = dat.slice(i,i+4);
        var length = length_sign_buf.readInt32BE(0);
        console.log("\t\tLength of Signature:"+length);
        i=i+4;

        var sign_buf = dat.slice(i,i+length);
        console.log("\t\tSignature :"+sign_buf.toString('hex'));
        i=i+length;
        console.log("\n");
        let In = new Input(transid.toString('hex'), index,length,sign_buf.toString('hex') );
        Inputs.push(In);
    }
    console.log("\n");

    var num_outputsBuf = dat.slice(i,i+4);
    var num_outputs = num_outputsBuf.readInt32BE(0);
    console.log("Number of outputs:"+num_outputs+'\n');
    i=i+4;
    for(var j=1;j<=num_outputs;j++){
        console.log("\t Output "+j+": ");
        

        var coinsBuf =dat.slice(i,i+8);
        var coins = coinsBuf.readBigUInt64BE(0);
        console.log("\t\tNumber of coins:"+Number(coins));
        i=i+8;

        var length_pubkey_buf = dat.slice(i,i+4);
        var length_pubkey = length_pubkey_buf.readInt32BE(0);
        console.log("\t\tLength of Public key:"+length_pubkey);
        i=i+4;

        var pubkey_buf = dat.slice(i,i+length_pubkey);
        console.log("\t\tPublic Key :"+pubkey_buf.toString('utf-8'));
        i=i+length_pubkey;
        console.log("\n");

        let Out = new Output(Number(coins), length_pubkey, pubkey_buf.toString('utf-8'));
        Outputs.push(Out);
    }
    console.log("\n");
    var txn = new Transaction(num_inputs,Inputs ,num_outputs ,Outputs) ;
    return txn ;
}

// function to process the block
function process(Block,blocknum){
    let block = Buffer.from(Block);
    let curr  = 116;
    var num_transactions_buf = block.slice(curr , curr+4);
    var num_transactions = num_transactions_buf.readInt32BE(0);
    curr = curr+4;
    for (var i =0 ; i<num_transactions;i++){
        var transaction_size_buf = block.slice(curr , curr+4);
        var transaction_size = transaction_size_buf.readInt32BE(0);
        curr = curr+4;
        var curr_transaction_buf = block.slice(curr , curr+transaction_size);
        let curr_transaction = details(curr_transaction_buf);
        removeElement(pendingTransactions, curr_transaction);
        var transaction_ID = crypto.createHash('sha256').update(curr_transaction_buf).digest('hex');

        for (var j = 0 ;j < curr_transaction.numInputs ; j++){
            var tuple =[ curr_transaction.inputs[j].transactionID, curr_transaction.inputs[j].index ].toString();
            unused_outputs.delete(tuple);
        }

        for(var k = 0 ;k < curr_transaction.numOutputs ; k++){
            var tuple =[ transaction_ID, k].toString();
            unused_outputs.set(tuple, curr_transaction.outputs[k]);
        }
    }

    fs.writeFile(`blocks/${blocknum}.dat`, block, function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
}

// there is still a bug that needs to be fixed if i request potentialPeer , for the first time 
// it will add me and wont return its own list 
// if again i send the same request then
// it will return me its list which has my url in it - so appending that list would mean i am adding myself as a peer
function fill_peer_list(i){

        console.log(i);
        if(i >= potentialPeers.length){console.log('potential peers exhausted');return;}
        if(peers.length>=max_peers_length){console.log('max peers length reached');return;}
        request.post(
            {
            url:potentialPeers[i],
            json: {
                    "url":"Antreev's mac",
                 },
             headers: {
                    'Content-Type': 'application/json'
                }
            },
        function(error, response, body){

              console.log("error  :" +error);
              console.log("response == "+response.statusCode);
              console.log("host == "+JSON.stringify(response.request.uri.host));
              if (response.statusCode== 500){

              console.log(`node ${response.request.uri.host} didnt add me as a peer`);
              console.log(JSON.stringify(body));
              list = JSON.parse(JSON.stringify(body));

              for (var j=0;j<list.length;j++){

                    if (potentialPeers.indexOf(list[j])== -1){
                            potentialPeers.push(list[j]);
                            console.log('adding '+list[j]);
                            console.log('potential peer length :'+ potentialPeers.length);
                         }
                    }
              console.log(potentialPeers);
              console.log(list.length);
            }
            if(response.statusCode==200){
                console.log('node'+JSON.stringify(response.request.uri.host) +'added me as a peer , i should too');
                peers.push(response.request.uri.host);
            }
            console.log('inside function request')
            fill_peer_list(i+1);
        });
        console.log(potentialPeers);
    console.log('printing '+potentialPeers);
}

function getBlocks(blocknum){
    var url_ = 'http://localhost:8787/getBlock/'+blocknum;
    request(
        {
            url:url_, 
            headers :{
                'Content-Type': 'application/octet-stream'
            },
            encoding : null
        }, 
            (error, response, body) => {
        if (error) { return console.log(error); }
        
        if(response.statusCode == 200){
            console.log(body.length);
            //res.send(body);
            process(body,blocknum)    // error might occur due to blocknum
            getBlocks(blocknum+1);}
        else if(response.statusCode==404){
              console.log('end reached');
        }else
        {
            console.log('something else is going on');
        }
      });
}

function getPendingTransactions(url_){
    request(
        {
            url:url_, 
            headers :{
                'Content-Type': 'application/json'
            },
        }, 
            (error, response, body) => {
        if (error) { return console.log(error); }
                var penTransactions = JSON.parse(body);
                for ( txn in penTransactions){
                    
                    pendingTransactions.push(penTransactions[txn]);
                    console.log(penTransactions[txn]);
                    console.log('length of pending transaction is : '+pendingTransactions.length);
                }        
      });
}
// all these endpoints were used for testing : 
//--------------------------------------------------------------------------
app.get('/getPendingTransactions',(req,res,next)=>{
    var url_ = 'http://localhost:8787/getPendingTransactions';
    getPendingTransactions(url_);
    res.sendStatus(200);
});
app.get('/getPendingTxnlist',(req, res)=>{
    res.setHeader('Content-Type', 'application/json');
    res.send(pendingTransactions);
});
app.get('/getBlock',(req,res,next)=>{
    getBlocks(0);
    res.sendStatus(200);
});
app.get('/',(req,res,next)=>{
    fill_peer_list(0);
    console.log(potentialPeers+'-------');
    res.send('done');
});
app.get('/getPotentialPeers',(req,res,next)=>{
    //res.send(potentialPeers.length);
    console.log(potentialPeers);
    res.sendStatus(200);
});
//--------------------------------------------------------------------------
const port =8000
app.listen(port,function(error){

    if(error){
        console.log("this thing is fucked")
    } else{
        console.log('server listening on port '+port)
    }
})
