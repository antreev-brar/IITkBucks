const crypto = require("crypto");
const readline = require('readline');
const constants = require('constants');
const fs = require('fs');
const Transaction = require ("./classes/Transaction");
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");

const rl =readline.createInterface({
    input:process.stdin,
    output:process.stdout,
});

unused_outputs = new Map();

function details(data){
    //const transactionID_I = crypto.createHash('sha256').update(Buffer.from(dat)).digest('hex');
    //console.log("Transaction ID: "+transactionID_I );
    let Inputs = []
    let Outputs = [];

    var i=0;
    var num_inputsBuf = data.slice(i,i+4);
    var num_inputs = num_inputsBuf.readInt32BE(0);
    //console.log("Number of inputs:"+num_inputs+'\n');
    i=i+4;
    for(var j=1;j<=num_inputs;j++){
        console.log("\t Input "+j+": ");
        var transid =data.slice(i,i+32);
        //console.log("\t\tTransactionID :"+transid.toString('hex'));
        i=i+32;

        var indexBuf =data.slice(i,i+4);
        var index = indexBuf.readInt32BE(0);
        //console.log("\t\tIndex:"+index);
        i=i+4;

        var length_sign_buf = data.slice(i,i+4);
        var length = length_sign_buf.readInt32BE(0);
        //console.log("\t\tLength of Signature:"+length);
        i=i+4;

        var sign_buf = data.slice(i,i+length);
        //console.log("\t\tSignature :"+sign_buf.toString('hex'));
        i=i+length;
        //console.log("\n");
        let In = new Input(transid.toString('hex'), index,length,sign_buf.toString('hex') );
        Inputs.push(In);
    }
    //console.log("\n");
    //slicing to be used in signature
    output_data_buf = data.slice(i, data.length)
    hashed_output_data = crypto.createHash('sha256').update(output_data_buf).digest('hex');


    var num_outputsBuf = data.slice(i,i+4);
    var num_outputs = num_outputsBuf.readInt32BE(0);
    //console.log("Number of outputs:"+num_outputs+'\n');
    i=i+4;
    for(var j=1;j<=num_outputs;j++){
        //console.log("\t Output "+j+": ");
        

        var coinsBuf =data.slice(i,i+8);
        var coins = coinsBuf.readBigUInt64BE(0);
        //console.log("\t\tNumber of coins:"+Number(coins));
        i=i+8;

        var length_pubkey_buf = data.slice(i,i+4);
        var length_pubkey = length_pubkey_buf.readInt32BE(0);
        //console.log("\t\tLength of Public key:"+length_pubkey);
        i=i+4;

        var pubkey_buf = data.slice(i,i+length_pubkey);
        //console.log("\t\tPublic Key :"+pubkey_buf.toString('utf-8'));
        i=i+length_pubkey;
        console.log("\n");

        let Out = new Output(Number(coins), length_pubkey, pubkey_buf.toString('utf-8'));
        Outputs.push(Out);
    }
    //console.log("\n");
    
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
rl.question("Enter the path to the transaction :",(path)=>{
    
    let data=fs.readFileSync(path);
    //console.log(data.length);
    var transObj_andHash = details(data)
    if (verify_transaction(transObj_andHash[0],transObj_andHash[1]) == true){console.log("Verified");}
    else{console.log("Not Verified");}
    rl.close();

});