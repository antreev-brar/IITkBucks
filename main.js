var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const crypto = require("crypto");
const _ = require('lodash');
const getRawBody = require('raw-body');
const Transaction = require ("./classes/Transaction");
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");
const BlockHead = require ("./classes/BlockHead");


const { Worker } = require('worker_threads');
var app = express();
app.use (bodyParser.urlencoded({extended : true}));
app.use (bodyParser.json());
let config = JSON.parse(fs.readFileSync('./config.json'));
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const blockReward = BigInt(100000);
var temparray = new Map();
var max_peers_length = 2;
var myurl = config["myurl"];
var potentialPeers=config["potential_peers"];
var pendingTransactions = [];
var block_index=0;
var Target = "0000004000000000000000000000000000000000000000000000000000000000";
var peers = [];
var alias = new Map();
var unusedOuputsPubkey = new Map();
var unused_outputs = new Map();
let worker = new Worker('./worker.js');
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//util functions
function removeTransaction(array, elem) {
    _.remove(array, function(e) {
        return _.isEqual(e, elem);
    })
}

function getPrevHash(index){
    if(index-1 == -1 ){
        var hashprevGenesis = '0000000000000000000000000000000000000000000000000000000000000000'
        return hashprevGenesis;
    }
    else{
        var indexprev = index-1;
        var path = './blocks/'+indexprev+'.dat';
        const data = fs.readFileSync(path);
        let hash = crypto.createHash("sha256").update(data.slice(0, 116)).digest('hex');
        return hash;
    }
}

function verify_signature(str,text , pubkey){
    let signatureSignedByPrivateKey = str
    let pem = pubkey
    let publicKey = pem.toString('ascii')
    const verifier = crypto.createVerify('SHA256')
    verifier.update(text, 'ascii')
    const publicKeyBuf =  Buffer.from(publicKey, 'ascii')
    const signatureBuf = Buffer.from(signatureSignedByPrivateKey, 'hex')
    const result = verifier.verify({key:publicKeyBuf, padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, signatureBuf)
    return result;
}

function verifyBlockHeader(blockHeaderBuff, hashedblockhead ,hashedblockbody ){
    console.log("inside verify blockhead...................")
    let blockHeader = Buffer.from(blockHeaderBuff);
    var i = 0;
    var indexBuf = blockHeader.slice(i,i+4);
    var index = indexBuf.readInt32BE(0);
    console.log("index of block ===="+index);
    i = i+4 ;

    var parentHashBuf = blockHeader.slice(i,i+32);
    var parentHash = parentHashBuf.toString('hex');
    console.log("parenthash ===="+parentHash);
    i = i+32 ;

    var HashBuf = blockHeader.slice(i,i+32);
    var Hash = HashBuf.toString('hex');
    console.log("hash of blockbody ===="+Hash);
    i = i+32 ;

    var targetBuf = blockHeader.slice(i,i+32);
    var target = targetBuf.toString('hex');
    console.log("target of blockhead ===="+target);
    i = i+32 ;

    var timestampBuf =blockHeader.slice(i,i+8);
    var timestamp = timestampBuf.readBigUInt64BE(0);
    console.log("timestamp of blockhead ===="+timestamp);
    i = i+8;

    var nonceBuf =blockHeader.slice(i,i+8);
    var nonce = nonceBuf.readBigUInt64BE(0);
    console.log("nonce of blockhead ===="+nonce);
    console.log("hash of blockhead ===="+hashedblockhead);
    
    parent_hash = getPrevHash(index);

    if(fs.existsSync(index+'.dat')) {
        console.log("BLock exists.");
        return false;
    }
    if( hashedblockbody !== Hash) {
        console.log("hash doesnt match");
        return false ;}
    if(parentHash !== parent_hash){
        console.log("parenthash incorrect");
        return false;}
    if(index === 0){
            if(target !== Target){
                console.log("target doesnt match");
                return false;}
    }
   
    if(hashedblockhead >= target){
        console.log("hash greater than target");
        return false ; }
    console.log("block Head verified...................")
    return true ;

}

function transitionToByteArrayInput(buff,_transid , _index , _length_sign , _sign){
    var buf1 = Buffer.from(_transid,"hex");
    var buf2 = Buffer.alloc(4);
    buf2.writeInt32BE(_index, 0);
    var buf3 = Buffer.alloc(4);
    buf3.writeInt32BE(_length_sign, 0);
    var buf4=Buffer.from(_sign , 'hex');
    var buf = Buffer.concat([buff,buf1,buf2,buf3,buf4]);
    return buf ;
}

function transitionToByteArrayOutput(bufff,_coins , _length_pubkey , _pubkey){
    var buf1 = Buffer.alloc(8);
    buf1.writeBigInt64BE(BigInt(_coins), 0);
    var buf2 = Buffer.alloc(4);
    buf2.writeInt32BE(_length_pubkey, 0);
    var buf3=Buffer.from(_pubkey , 'utf-8');
    var buf = Buffer.concat([bufff,buf1,buf2,buf3]);
    return buf ;
}

function inputBuffer(i,inputarray){

    var numi = Buffer.alloc(4)
    numi.writeInt32BE(i,0);
    var bufi = Buffer.alloc(0);
    for (var j =0;j<i;j++){
       bufi = transitionToByteArrayInput(bufi,inputarray[j].transactionId ,inputarray[j].index , inputarray[j].sign_length , inputarray[j].sign);
    }
    return [numi,bufi]
}

function outputBuffer(o,outputarray){

    var numo = Buffer.alloc(4);
    numo.writeInt32BE(o,0);
    var bufo= Buffer.alloc(0);
    for (var j =0;j<o;j++){
      bufo = transitionToByteArrayOutput(bufo,outputarray[j].coins ,outputarray[j].pubkey_len , outputarray[j].pub_key);
    }
  return [numo,bufo]
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// this function gets details about blob
function details(dat){
    console.log("inside deatails...........")
    const transactionID_I = crypto.createHash('sha256').update(Buffer.from(dat)).digest('hex');

    var Inputs = []
    var Outputs = [];

    var i=0;
    var num_inputsBuf = dat.slice(i,i+4);
    var num_inputs = num_inputsBuf.readInt32BE(0);
    i=i+4;
    for(var j=1;j<=num_inputs;j++)
    {
 
        var transid =dat.slice(i,i+32);
        i=i+32;

        var indexBuf =dat.slice(i,i+4);
        var index = indexBuf.readInt32BE(0);
        i=i+4;

        var length_sign_buf = dat.slice(i,i+4);
        var length = length_sign_buf.readInt32BE(0);
        i=i+4;

        var sign_buf = dat.slice(i,i+length);
        i=i+length;

        var In = new Input(transid.toString('hex'), index,length,sign_buf.toString('hex') );
        Inputs.push(In);
    }
 
    //slicing to be used in signature
    output_data_buf = dat.slice(i, dat.length)
    hashed_output_data = crypto.createHash('sha256').update(output_data_buf).digest('hex');

    var num_outputsBuf = dat.slice(i,i+4);
    var num_outputs = num_outputsBuf.readInt32BE(0);
    i=i+4;
    for(var j=1;j<=num_outputs;j++)
    {
        
        var coinsBuf =dat.slice(i,i+8);
        var coins = coinsBuf.readBigUInt64BE(0);
        i=i+8;

        var length_pubkey_buf = dat.slice(i,i+4);
        var length_pubkey = length_pubkey_buf.readInt32BE(0);
        i=i+4;

        var pubkey_buf = dat.slice(i,i+length_pubkey);
        i=i+length_pubkey;

        let Out = new Output(BigInt(coins), length_pubkey, pubkey_buf.toString('utf-8'));
        Outputs.push(Out);
    }
    
    var transactionObject = new Transaction(num_inputs , Inputs , num_outputs , Outputs );
    //console.log(transactionObject);
    return [transactionObject, hashed_output_data];
}

function verify_transaction(trans , hashed_output){
    console.log("INSIDE TRANSACTION VERIFICATION ..............")
    let numInputs = trans.numInputs;
    let inputs = trans.inputs;
    let numOutputs = trans.numOutputs;
    let outputs = trans.outputs;
    let hashed_output_data = hashed_output;
    var flag = true;
    var transactionFees=BigInt(0);
    console.log("num of inputs :::::"+numInputs);
    for (var i = 0 ;i < numInputs ; i++)
    {
        var tuple =[ inputs[i].transactionId, inputs[i].index ].toString();
        if(unused_outputs.has(tuple))
            console.log(i+ " input present");
        else{
            console.log(i+ " input absent from output array");
            flag = false ; 
            break;
        }
    }
    if(flag){
        //checking signature
        for (var i = 0 ;i < numInputs ; i++)
        {
            var buf1 = Buffer.from(inputs[i].transactionId,"hex");
            var buf2 = Buffer.alloc(4);
            buf2.writeInt32BE(inputs[i].index, 0);
            var buf3 = Buffer.from(hashed_output_data,"hex");
            
            var signature_buf = Buffer.concat([buf1,buf2,buf3]);
            signature = inputs[i].sign;
            var pubkey =unused_outputs.get([ inputs[i].transactionId, inputs[i].index ].toString()).pub_key;
            
            if(verify_signature(signature,signature_buf,pubkey)===true)
            {
                console.log(i+" Signature verified!");
            }
            else{
                console.log(i+ " Verification Failed");
                flag=false;
                break;
            }
        }
    }
    if(flag){
        let input_coins = BigInt(0);
        let output_coins = BigInt(0);
        for (var i = 0 ;i < numInputs ; i++)
        {
           input_coins  +=  unused_outputs.get([ inputs[i].transactionId, inputs[i].index ].toString()).coins;
        }
        for (var i = 0 ;i < numOutputs ; i++)
        {
            output_coins  +=  outputs[i].coins;
        }
        if(input_coins>=output_coins)
         {
            console.log("Coins condition verified!");
            transactionFees = input_coins - output_coins;
         }
        else
        {
            console.log("verification failed - input coins are less than output");
            flag=false;
        }
    }
    if(flag){
        return [true,transactionFees];
    }
    else {
        return [false,0];
    }
}

function addValueToList(mapp,key, value) {

    if(mapp.has(key))
    {
    var list = mapp.get(key);
    list.push(value);
    mapp.set(key,list);
    }else{
      var list=[value];
      mapp.set(key,list);  
    }
}
// function to process the block
function process(Block,blocknum){

    console.log('inside process .................');
    let block = Buffer.from(Block);
    let curr  = 116;
    var num_transactions_buf = block.slice(curr , curr+4);
    var num_transactions = num_transactions_buf.readInt32BE(0);
    curr = curr+4;
    for (var i =0 ; i<num_transactions;i++)
    {
        var transaction_size_buf = block.slice(curr , curr+4);
        var transaction_size = transaction_size_buf.readInt32BE(0);
        curr = curr+4;
        var curr_transaction_buf = block.slice(curr , curr+transaction_size);
        curr = curr + transaction_size;
        var transObj_andHash = details(curr_transaction_buf);
        let curr_transaction = transObj_andHash[0];
        ////////////////////////////////////////////////////
        removeTransaction(pendingTransactions, curr_transaction);
        /////////////////////////////////////////////////////
        var transaction_ID = crypto.createHash('sha256').update(curr_transaction_buf).digest('hex');

        for (var j = 0 ;j < curr_transaction.numInputs ; j++)
        {
            var tuple =[ curr_transaction.inputs[j].transactionId, curr_transaction.inputs[j].index ].toString();
            if (unused_outputs.has(tuple))
            {
                unused_outputs.delete(tuple);
            }
        }

        for(var k = 0 ;k < curr_transaction.numOutputs ; k++)
        {
            var tuple =[ transaction_ID, k].toString();
            unused_outputs.set(tuple, curr_transaction.outputs[k]);
        }
    }
    unusedOuputsPubkey.clear()
    for(let [key, value] of unused_outputs)
    {
        var split = key.split(',')
        split[1] = Number(split[1]);
        let ob ={"transactionId":split[0],"index":split[1],'amount':value.coins.toString()}
        addValueToList(unusedOuputsPubkey,value.pub_key.toString('utf-8'),ob);
    }

    fs.writeFile(`blocks/${blocknum}.dat`, block, function (err) {
        if (err) throw err;
        console.log('Saved! ' +blocknum);
      });
}

function verifyBlock(Block)
{
    console.log("inside verify block.....")
    let block = Buffer.from(Block);
    let blockHeaderBuff = block.slice(0,116);
    let blockbody = block.slice(116,block.length);

    const hashedblockhead = crypto.createHash('sha256').update(blockHeaderBuff).digest('hex');
    const hashedblockbody = crypto.createHash('sha256').update(blockbody).digest('hex');

    var flag = true;
    var transactionFees = BigInt(0);
    flag = verifyBlockHeader(blockHeaderBuff,hashedblockhead ,hashedblockbody  );
    if(flag === false)
        {console.log('blockhead not verified');return;}

    let curr  = 116;
    var num_transactions_buf = block.slice(curr , curr+4);
    var num_transactions = num_transactions_buf.readInt32BE(0);
    console.log("num transactions === "+num_transactions);
    curr = curr+4;

    for (var i =0 ; i<num_transactions;i++){ 
        //verify transaction here******************************
        var transaction_size_buf = block.slice(curr , curr+4);
        var transaction_size = transaction_size_buf.readInt32BE(0);
        curr = curr+4;
        var curr_transaction_buf = block.slice(curr , curr+transaction_size);
        curr = curr+transaction_size;
        if(i === 0){
            continue ;
        }
        var transObj_andHash= details(curr_transaction_buf);
        console.log("transaction :::"+ i );
        verifyAndFees = verify_transaction(transObj_andHash[0],transObj_andHash[1]);
        if ( verifyAndFees[0]=== true)
        {
            console.log("Verified transaction   "+i);
            transactionFees += verifyAndFees[1];
        }
        else{
            console.log("Not Verified  transaction  "+i);
            flag = false;
        }
        //*****************************************************
    }
    /////////////////////////////////////////////verifyCoinBase
    var CoinBase_transaction_size_buf = block.slice(120 , 124);
    var CoinBase_transaction_size = CoinBase_transaction_size_buf.readInt32BE(0); 
    var CoinBase_transaction_buf = block.slice(124 , 124 + CoinBase_transaction_size);
    transObj_hash = details(CoinBase_transaction_buf);

    if(transObj_hash[0].outputs[0].coins <= transactionFees + blockReward)
    {
        console.log("COinbase verified too");
    }else{
        flag = false;
    }
    ////////////////////////////////////////////////////////////
    if (flag)
        {return true;}
    else
        {return false;}
}

function fill_peer_list(i){
  
        console.log("inside fillpeers "+ i);
        if(i >= potentialPeers.length)
            {console.log('potential peers exhausted');return;}
        if(peers.length>=max_peers_length)
            {console.log('max peers length reached');return;}

        request.post(
            {
            url:potentialPeers[i]+"/newPeer",
            json: {
                    "url":myurl,
                 },
             headers: {
                    'Content-Type': 'application/json'
                }
            },
        function(error, response, body)
        {
            if(error)
              console.log("error  :" +error);
            else{
              console.log("response == "+response.statusCode);
              console.log("host == "+JSON.stringify(response.request.uri.host));

            if (response.statusCode== 500){
              console.log(`node ${response.request.uri.host} didnt add me as a peer`);
            }
            if(response.statusCode==200){
                if(peers.indexOf(potentialPeers[i])== -1){
                    console.log('node'+potentialPeers[i] +'added me as a peer , i should too');
                    peers.push(potentialPeers[i]);
                }
            }
            console.log('inside function request')
            request(
                {
                    url:potentialPeers[i]+'/getPeers', 
                    headers :{
                        'Content-Type': 'application/json'
                    },
                }, 
                (error, response, body) => {
         
                        if(!error && response.statusCode == 200){    
                            var peerlist =JSON.parse(body);
                            
                            for(var k = 0 ; k<peerlist.peers.length;k++)
                            {
                                if(peerlist.peers[k] == myurl || potentialPeers.indexOf(peerlist.peers[k]) != -1)
                                {
                                    console.log('continues***************************');
                                    continue;
                                }
                                
                                potentialPeers.push(peerlist.peers[k]);
                            }  
                            fill_peer_list(i+1);
                        }
                        else{
                            fill_peer_list(i+1);
                        }              
              });
            } 
        });
}

// uses recursion to get blocks
function getBlocks(blocknum){
    var url_ = 'https://iitkbucks.pclub.in/getBlock/'+blocknum;
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
            if(verifyBlock(body) === false)
            {
                console.log('problem with verification ###################');
            }else{
                console.log(`Block ${blocknum} has beeen verified`);
            }

            process(body , blocknum);
            block_index++;  
            getBlocks(blocknum+1);}
        else if(response.statusCode==404){
              console.log('end reached');
        }else{
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
        console.log(response.statusCode);
        if (error) { return console.log(error); }

                var penTransactions = JSON.parse(body);
                console.log("number of pending transactions................."+penTransactions.length);
                for ( txn in penTransactions)
                {
                    var flag =true;

                    for (let x=0; x < pendingTransactions.length ; x++)
                    {
                        if (pendingTransactions[x] === penTransactions[txn]) 
                        {
                           console.log('already exists');
                           flag = false;
                        }
                    }
                    if(flag){
                            var trans = penTransactions[txn]
                            let inputs = trans.inputs;
                            let numInputs = inputs.length;
                            let outputs = trans.outputs;
                            let numOutputs = outputs.length;
                            let Inputs = [];
                            let Outputs = [];
                    
                            for (let i = 0; i < numInputs; i++) 
                            {
                                let inp = new Input(inputs[i].transactionId, inputs[i].index, (inputs[i].signature.length)/2, inputs[i].signature);
                                Inputs.push(inp);
                            }
                            for (let i = 0; i < numOutputs; i++) 
                            {
                                outputs[i].amount = BigInt(outputs[i].amount);
                                let out = new Output(outputs[i].amount, outputs[i].recipient.length, outputs[i].recipient);
                                Outputs.push(out);
                            }
                            let transaction = new Transaction (numInputs, Inputs, numOutputs, Outputs);
                            pendingTransactions.push(transaction);
                            console.log(transaction);
                    console.log('length of pending transaction is : '+pendingTransactions.length);
                    }
                    
                }        
      });
}

function transactionToBuffer(transaction){
    console.log("inside tranaction to buffer")
    
    var inputarray = transaction.inputs;
    var outputarray = transaction.outputs;
    var i = inputarray.length;
    var o = outputarray.length;

    var bufferInput = inputBuffer(i,inputarray)
    var bufferOutput = outputBuffer(o,outputarray)
    var buf = Buffer.concat([bufferInput[0],bufferInput[1],bufferOutput[0],bufferOutput[1]]);

    var outputBuff = Buffer.concat([bufferOutput[0],bufferOutput[1]]);
    hashed = crypto.createHash('sha256').update(outputBuff).digest('hex');
    return [buf , hashed] ;
}

function makeBlock(worker){
    console.log("inside make block.........");
    var buffer =  Buffer.alloc(0);
    let size = 0;
    let i = 0 ;
    let fees = BigInt(0);

    while(i<pendingTransactions.length)
    {
            var tempBuffer = transactionToBuffer(pendingTransactions[i]);
            size += tempBuffer[0].length;
            console.log("buffer made with size "+size);
            var transSize = Buffer.alloc(4);
            transSize.writeInt32BE(tempBuffer[0].length, 0);
            if(size >= 1000000) break ;
            
            var hashed_output = tempBuffer[1];
            var verify_Fees =verify_transaction(pendingTransactions[i] , hashed_output)
            
            if(verify_Fees[0])
            {
                console.log('*******************tranaction verified')
              for (var j = 0 ;j < pendingTransactions[i].numInputs ; j++)
                {
                    var tuple =[ pendingTransactions[i].inputs[j].transactionId, pendingTransactions[i].inputs[j].index ].toString();
        
                    if(unused_outputs.has(tuple))
                    {
                    fees += unused_outputs.get(tuple).coins;
                    temparray.set(tuple,unused_outputs.get(tuple));
                    unused_outputs.delete(tuple);
                    }
                }
 
               for (var j = 0 ;j < pendingTransactions[i].numOutputs ; j++)
               {
                fees -= pendingTransactions[i].outputs[j].coins;
               }  
               console.log("total txn fees :"+fees);

            }else{
                break;
            }
            i++;   
            buffer  = Buffer.concat([buffer ,transSize, tempBuffer[0]]);     
    }

    for (let [key , value] of temparray) 
    {
        unused_outputs.set(key ,temparray.get(key));
        delete temparray.get(key);
    }
    let pubKey = fs.readFileSync(config['public-key']);

    var out = new Output(fees+ blockReward ,pubKey.length, pubKey );

    var nodeTrans = new Transaction(0,[],1,[out]);
    var nodeTransbuf = transactionToBuffer(nodeTrans);
    var nodeTransbufSize = Buffer.alloc(4);
    nodeTransbufSize.writeInt32BE(nodeTransbuf[0].length, 0);
    buffer = Buffer.concat([nodeTransbufSize , nodeTransbuf[0] , buffer]);

    var numberTrans = Buffer.alloc(4);
    numberTrans.writeInt32BE(i+1, 0);
    buffer = Buffer.concat([numberTrans , buffer]);
    console.log("size of blockbody ===="+buffer.length);
    
    //make block header
    var index = block_index
    var hash = crypto.createHash('sha256').update(buffer).digest('hex');
    var hashParent = getPrevHash(index);
    var target = Target ;
    var blockhead = new BlockHead(index , hashParent , hash , target);

    console.log("block head made **********************")
    console.log(blockhead);
    worker.postMessage({ header : blockhead});
    worker.on('message', message => {
        console.log("Message received: ", message);
        var blockHead = Buffer.from(message.header);
        var Block  =Buffer.concat([blockHead,buffer]);
        postBlock(Block);
    });
}

function postBlock(block){
    process(block,block_index);
    sendtoPeers(block);
    block_index++;
}

function sendtoPeers(block){
    var i;
        for (i = 0; i < peers.length; i++) 
        { 
            console.log("Antreev-brar Sent "+peers[i]);
            request({
                url: peers[i]+'/newBlock',
                method: 'POST',
                body: block,
                encoding: null
              }, 
              (error, response, body) => {
                if (error) {
                   console.log('Error sending message: in sending to '+peers[i]);
                } else {
                    console.log('sent');
                    console.log('response code :'+response.statusCode);
                }
              });
         }
}

function sendAliasToPeers(_alias,publicKey){
    var i;
        for (i = 0; i < peers.length; i++) 
        { 
            console.log("Antreev-brar Sent alias to"+ peers[i]);
            request.post(
                {
                url:peers[i]+'/addAlias',
                json: {
                  "alias":_alias,
                  "publicKey":publicKey
                    },
                headers: {
                    'Content-Type': 'application/json'
                }
                },
              function(error, response, body){
                console.log("error  :" +error);
              });
            }
}

function killworker(worker){
    worker.terminate();
    console.log('worker died :)');
}

async function start(){
    return new Promise(resolve => {
        fill_peer_list(0)
        getPendingTransactions('https://iitkbucks.pclub.in/getPendingTransactions');
        setTimeout(() => {
          resolve('resolved');
        }, 30000);
      });
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

app.get('/make',(req,res,next)=>{
    makeBlock(worker);
    res.sendStatus(200);
});

app.get('/getunpub',(req, res)=>{
    console.log(unusedOuputsPubkey);
    for(let [key, value] of unusedOuputsPubkey){
        console.log(typeof key);
        console.log(key);
    }
    res.sendStatus(200);
});

app.get('/getBlock/:num',(req,res,next)=>{

    console.log(`index demanded is ${req.params.num}`);
    var path = './blocks/'+req.params.num+'.dat';
    if (fs.existsSync(path)) {
         console. log("File exists.");
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
        let tempinput = [];
        let tempoutput = [];
        for(var i =0 ; i <inputs__.length ; i++){
            tempinput.push({"transactionId" :inputs__[i].transactionId , "index":inputs__[i].index , "signature":inputs__[i].sign});
        }
        for(var i =0 ; i <outputs__.length ; i++){
            tempoutput.push({"recipient" :outputs__[i].pub_key, "amount":outputs__[i].coins.toString()});
        }
        temp['inputs'] = tempinput;
        temp['outputs'] = tempoutput;
        pending_txn.push(temp);
        }
        res.send(pending_txn);
});

app.post('/newPeer',(req,res,next)=>{
    if(peers.indexOf(req.body.url)==-1 ){
        
        if(peers.length < max_peers_length){
            console.log(req.body.url +'wants to add as a  peer');
            previous_length_peers = peers.length;
            peers.push(req.body.url);
            new_length_peers = peers.length;
            if(new_length_peers == previous_length_peers+1){
                res.send("peer added succesfully");
            }else{
                res.send("something is fishy");
            }
        }else{
            console.log('peer limit exceeded');
            res.sendStatus(500);
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
    postBlock(buffer);
    console.log("block added by new block at "+ block_index-1);
    res.sendStatus(200);
    }
    else{
        console.log('Block not verified')
        res.sendStatus(500);
    }
});

app.post('/newTransaction',(req,res,next)=>{
                       
      var trans = req.body;
      let inputs = trans.inputs;
      let numInputs = inputs.length;
      let outputs = trans.outputs;
      let numOutputs = outputs.length;
      let Inputs = [];
      let Outputs = [];
                    
      for (let i = 0; i < numInputs; i++) {
                                let inp = new Input(inputs[i].transactionId, inputs[i].index, (inputs[i].signature.length)/2, inputs[i].signature);
                                Inputs.push(inp);
       }
       for (let i = 0; i < numOutputs; i++) {
                                outputs[i].amount = BigInt(outputs[i].amount);
                                let out = new Output(outputs[i].amount, outputs[i].recipient.length, outputs[i].recipient);
                                Outputs.push(out);
         }
        let transaction = new Transaction (numInputs, Inputs, numOutputs, Outputs);
          
        if (!_.find(pendingTransactions, transaction)){
                            console.log(transaction);
                            pendingTransactions.push(transaction);
                            console.log("transaction added");
        }
        else{
            console.log('txn already present');
        }
       console.log("transaction added to PendingTransaction : Length"+pendingTransactions.length);
       makeBlock(worker);
       res.sendStatus(200);

});

app.post('/addAlias',(req,res,next)=>{
    console.log('adding alias endpoint');
    if(alias.has(req.body.alias)){
        res.sendStatus(400);
    }else{
        alias.set(req.body.alias , req.body.publicKey);
        sendAliasToPeers(req.body.alias , req.body.publicKey);
        res.sendStatus(200);
    }
});

app.post('/getPublicKey',(req,res,next)=>{
    console.log("get public Key endpoint");
    if(alias.has(req.body.alias))
    {

        console.log(alias.get(req.body.alias)); 
        let obj = {"publicKey" : alias.get(req.body.alias)};
        res.send(obj);

    }else{
        res.sendStatus(404);
    }
});

app.post('/getUnusedOutputs',(req,res,next)=>{
    console.log('in get Unused outputs');
  
    if(req.body.hasOwnProperty('alias'))
    {
        console.log('in alias subpart');

        if(alias.has(req.body.alias))
        {
            console.log(' alias list has this alias');
            let pubkey__ = alias.get(req.body.alias);
            pubkey__ = pubkey__.toString('utf-8');

            for(let [key, value] of unusedOuputsPubkey)
            {
                if(key == pubkey__)
                {
                    console.log("match found");
                }
            }

            if(unusedOuputsPubkey.has(pubkey__))
            {   
            console.log('unused outputs has this public key');
            var temp = unusedOuputsPubkey.get(pubkey__);
            let obj = {"unusedOutputs" : temp }
            res.send(JSON.stringify(obj));
            }else{
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(400);
        }

    }else if(req.body.hasOwnProperty('publicKey')){
            console.log('in public key subpart')
            var pubkey__ = req.body.publicKey;
            
            for(let [key, value] of unusedOuputsPubkey)
            {
                if(key == pubkey__)
                {
                    console.log("match found");
                }
            }

            if(unusedOuputsPubkey.has(pubkey__))
            {
                console.log('unused outputs has this public key');
                let obj = {"unusedOutputs" :unusedOuputsPubkey.get(pubkey__) }
                res.send(JSON.stringify(obj));
            } else{
                res.sendStatus(400);
            }
    }else{
        console.log('there isnt any');
        res.sendStatus(400);
    }

});

const port = config['port'];
app.listen(port,async function(error){

    if(error)
    {
        console.log("this thing is fucked")
    }else{

       await start();
       getBlocks(0);
       console.log('server listening on port '+port)
    }
});
