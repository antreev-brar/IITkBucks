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
