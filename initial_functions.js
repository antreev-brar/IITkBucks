var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const crypto = require("crypto");
const Transaction = require ("./classes/Transaction");
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");
const BlockHead = require ("./classes/BlockHead");
const { Worker } = require('worker_threads');

var app = express();
app.use(bodyParser.json({extended: false }));

var potentialPeers=["http://localhost:8787/newPeer"];
var peers =[]
var max_peers_length = 3
var pendingTransactions = [];
var temparray = {};
unused_outputs = new Map();
var block_index=3;

const worker = new Worker('./worker.js');

//function to remove tranaction
function removeElement(array, elem) {
    var index = array.indexOf(elem);
    if (index > -1) {
        array.splice(index, 1);
    }
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

    //slicing to be used in signature
    output_data_buf = dat.slice(i, dat.length)
    hashed_output_data = crypto.createHash('sha256').update(output_data_buf).digest('hex');


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
    
    var transactionObject = new Transaction(num_inputs , Inputs , num_outputs , Outputs );
    return [transactionObject, hashed_output_data];
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


function verify_transaction(trans , hashed_output){
    let numInputs = trans.numInputs;
    let inputs = trans.inputs;
    let numOutputs = trans.numOutputs;
    let outputs = trans.outputs;
    let hashed_output_data = hashed_output;
    var flag = true;

    for (var i = 0 ;i < numInputs ; i++){
        var tuple =[ inputs[i].transactionID, inputs[i].index ].toString();
        if(unused_outputs.has(tuple)== true){console.log(i+ " input present");}
        else{
            console.log(i+ " input absent from output array");
            flag = false ; 
            break;
         }
    }
    if(flag){
        //checking signature
        for (var i = 0 ;i < numInputs ; i++){
            var buf1 = Buffer.from(inputs[i].transactionID,"hex");
            var buf2 = Buffer.alloc(4);
            buf2.writeInt32BE(inputs[i].index, 0);
            var buf3 = Buffer.from(hashed_output_data,"hex");
            var signature_buf = Buffer.concat([buf1,buf2,buf3]);
            //console.log(signature_buf.length);
            signature = inputs[i].sign;
            var pubkey =unused_outputs.get([ inputs[i].transactionID, inputs[i].index ].toString()).pub_key;
            if(verify_signature(signature,signature_buf,pubkey)===true){
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
        let input_coins = 0;
        let output_coins = 0;
        for (var i = 0 ;i < numInputs ; i++){
           input_coins  +=  unused_outputs.get([ inputs[i].transactionID, inputs[i].index ].toString()).coins;
        }
        for (var i = 0 ;i < numOutputs ; i++){
            output_coins  +=  outputs[i].coins;
         }
         if(input_coins>=output_coins){
            console.log("Coins condition verified!");
        }
        else{
            console.log("verification failed - input coins are less than output");
            flag=false;
        }
    }

    if(flag){
        return true;
    }
    else {
        return false;
    }
    
}
function addValueToList(mapp,key, value) {
    //if the list is already created for the "key", then uses it
    //else creates new list for the "key" to store multiple values in it.
    mapp[key] = mapp[key] || [];
    mapp[key].push(value);
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
        curr = curr + transaction_size;
        var transObj_andHash= details(curr_transaction_buf);
        let curr_transaction = transObj_andHash[0];
        
        removeElement(pendingTransactions, curr_transaction);
        var transaction_ID = crypto.createHash('sha256').update(curr_transaction_buf.slice(0,116)).digest('hex');

        for (var j = 0 ;j < curr_transaction.numInputs ; j++){
            var tuple =[ curr_transaction.inputs[j].transactionID, curr_transaction.inputs[j].index ].toString();
            
            if (unusedOutputs.has(tuple)){
                unused_outputs.delete(tuple);
            }
        }

        for(var k = 0 ;k < curr_transaction.numOutputs ; k++){
            var tuple =[ transaction_ID, k].toString();
            unused_outputs.set(tuple, curr_transaction.outputs[k]);
        }
    }
    unusedOuputsPubkey.clear()
    for(let [key, value] of unused_outputs){
        //var split = i.split(',')
        console.log(key[0])
        let ob ={"transactionId":key[0],"index":key[1],amount:value.coins}
    
        addValueToList(unusedOuputsPubkey,value.publicKey,ob);
    }

    fs.writeFile(`blocks/${blocknum}.dat`, block, function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
}

function verifyBlock(Block){
    let block = Buffer.from(Block);
    let blockHeaderBuff = block.slice(0,116);
    var flag = true ;
    flag = verifyBlockHeader(blockHeaderBuff);
    let curr  = 116;
    var num_transactions_buf = block.slice(curr , curr+4);
    var num_transactions = num_transactions_buf.readInt32BE(0);
    curr = curr+4;
    for (var i =0 ; i<num_transactions;i++){

        var transaction_size_buf = block.slice(curr , curr+4);
        var transaction_size = transaction_size_buf.readInt32BE(0);
        curr = curr+4;
        var curr_transaction_buf = block.slice(curr , curr+transaction_size);
        curr = curr+transaction_size;
        var transObj_andHash= details(curr_transaction_buf);

        // still to implement function to verify 1st tranaction
        if(i === 0){
            continue ;
        }
        //verify transaction here******************************
        if (verify_transaction(transObj_andHash[0],transObj_andHash[1]) === true)
        {console.log("Verified");}
        else
        {console.log("Not Verified");
        flag = false;}
        //*****************************************************

        var transaction_ID = crypto.createHash('sha256').update(curr_transaction_buf.slice(0,116)).digest('hex');
    }

    if (flag){return true;}
    else{return false;}
}
function verifyBlockHeader(blockHeaderBuff){
    let blockHeader = Buffer.from(blockHeaderBuff);
    var i = 0;
    var indexBuf = blockHeader.slice(i,i+4);
    var index = indexBuf.readInt32BE(0);
    i = i+4 ;

    var parentHashBuf = blockHeader.slice(i,i+32);
    var parentHash = parentHashBuf.toString('hex');
    i = i+32 ;

    var HashBuf = blockHeader.slice(i,i+32);
    var Hash = HashBuf.toString('hex');
    i = i+32 ;

    var targetBuf = blockHeader.slice(i,i+32);
    var target = targetBuf.toString('hex');
    i = i+32 ;

    var timestampBuf =blockHeader.slice(i,i+8);
    var timestamp = timestampBuf.readBigUInt64BE(0);
    i = i+8;

    var nonceBuf =blockHeader.slice(i,i+8);
    var nonce = nonceBuf.readBigUInt64BE(0);
    
    const hashed = crypto.createHash('sha256').update(blockHeader).digest('hex');
    parent_hash = getPrevHash(index);

    if( hashed !== Hash) {return false ;}
    if(parentHash !== parent_hash){return false;}
    if(index === 0){
            if(target !== ('0'.repeat(7)+'f'+'0'.repeat(56))){return false;}
    }
   
    if(hashed >= target){return false ; }
    
    return true ;

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
function transitionToByteArrayInput(buff,_transid , _index , _length_sign , _sign){
    var buf1 = Buffer.from(_transid,"hex");
    //console.log(buf1.length)
    var buf2 = Buffer.alloc(4);
    buf2.writeInt32BE(_index, 0);
    //console.log(buf2.length)
    var buf3 = Buffer.alloc(4);
    buf3.writeInt32BE(_length_sign, 0);
    //console.log(buf3.length)
    var buf4=Buffer.from(_sign , 'hex');
    //console.log(buf4.length)
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
       bufi = transitionToByteArrayInput(bufi,inputarray[j].TransID ,inputarray[j].index , inputarray[j].length_sign , inputarray[j].signature);
    }
    return [numi,bufi]
}
function outputBuffer(o,outputarray){
    var numo = Buffer.alloc(4);
    numo.writeInt32BE(o,0);
    var bufo= Buffer.alloc(0);
    for (var j =0;j<o;j++){
      bufo = transitionToByteArrayOutput(bufo,outputarray[j].coins ,outputarray[j].length_pubkey , outputarray[j].pubkey);
    }
  return [numo,bufo]
}

function transactionToBuffer(transaction){
    var i = transaction.numInputs;
    var o = transaction.numOutputs;
    var inputarray = transaction.inputs;
    var outputarray = transaction.output;

    //console.log(inputarray.length)
      var bufferInput =inputBuffer(i,inputarray)
      var bufferOutput =outputBuffer(o,outputarray)
      var trans =new Transaction(bufferInput[0],bufferInput[1],bufferOutput[0],bufferOutput[1]);
    // console.log(bufi.length);
    // console.log(bufi.toString('ascii'));
    // console.log(bufo.length);
    var buf = Buffer.concat([trans.numInputs,trans.inputs ,trans.numOutputs, trans.outputs]);
    // console.log(buf);
    console.log(buf.length);
    hashed = crypto.createHash('sha256').update(bufferOutput).digest('hex');
    console.log(hashed);
    // sending buffer and buffer output for signature verification
    return [buf , hashed] ;
}
// code for worker miner 
let worker = new Worker('./worker.js');
function makeBlock(worker){
    var buffer =  Buffer.alloc(0);
    let size = 0;
    let i = 0 ;
    let fees = 0;
    var blockReward = 0;
    var flag_ = true ;
    while(i<pendingTransactions.length){
            var tempBuffer = transactionToBuffer(pendingTransactions[i]);
            size += tempBuffer[0].length;
            
            var transSize = Buffer.alloc(4);
            transSize.writeInt32BE(tempBuffer[0].length, 0);
            if(size >= 1000000) break ;

            var hashed_output = tempBuffer[1];
            if(verify_transaction(pendingTransactions[i] , hashed_output) === true){
            for (var j = 0 ;j < pendingTransactions[i].numInputs ; j++)
                {
                    var tuple =[ pendingTransactions[i].inputs[j].transactionID, pendingTransactions[i].inputs[j].index ].toString();
                    
                    if(tuple in unused_outputs){
                    fees += unused_outputs[tuple].coins;
                    temparray[tuple] = unused_outputs[tuple];
                    unused_outputs.delete(tuple);
                    }
                }
            for (var j = 0 ;j < pendingTransactions[i].numOutputs ; j++){
                fees -= pendingTransactions[i].outputs[j].coins;
            }  


            }else{
                break;
            }
            i++;

            buffer  = Buffer.concat([buffer ,transSize, tempBuffer]);
    }
    for (let key in temparray) {
        unused_outputs[key] = temparray[key];
        delete temparray[key];
    }


    var out = new Output(fees+coinReward ,pub_keylen , pub_key );

    var nodeTrans = new Transaction(0,[],1,out);
    var nodeTransbuf = transactionToBuffer(nodeTrans);
    var nodeTransbufSize = Buffer.alloc(4);
    nodeTransbufSize.writeInt32BE(nodeTransbuf[0], 0);
    buffer = Buffer.concat([nodeTransbufSize , nodeTransbuf , buffer]);
    var numberTrans = Buffer.alloc(4);
    numberTrans.writeInt32BE(i+1, 0);
    buffer = Buffer.concat([numberTrans , buffer]);

    //make block header
    var index = last_index // function to get last index available to be added later
    var hash = crypto.createHash('sha256').update(buffer).digest('hex');
    var hashParent = getPrevHash(index);
    var target = '000000f'+ '0'.repeat(57);
    var blockhead = new Blockhead(index , hashParent , hash , target);

    worker.postMessage({ header : blockhead});
    worker.on('message', message => {
        console.log("Message received: ", message);
        var blockHead = Buffer.from(message.header);
        var Block  =Buffer.concat([blockHead,buffer]);
        postBlock(block);
    });

}
function postBlock(block){
    console.log(block.length);
    block_index++;
    process(block,block_index);
    sendtoPeers(block);
}
function sendtoPeers(block){
    var i;
        for (i = 0; i < peers.length; i++) { 
            console.log("Antreev-brar Sent "+peers[i]);
            request({
                url: peers[i],
                method: 'POST',
                body: block,
                encoding: null
              }, (error, response, body) => {
                if (error) {
                   console.log('Error sending message: ', error)
                } else {
                  console.log('Response: ', response.body)
                }
              })
            }
}
function sendAliasToPeers(_alias,publicKey){
    var i;
        for (i = 0; i < peers.length; i++) { 
            console.log("Antreev-brar Sent alias to"+peers[i]);
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
                //console.log(response);
                //console.log(JSON.stringify(body));
              });
            }

}
function killworker(worker){
    worker.terminate();
    console.log('worker died :)');

}
////////////////////////


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
