var request = require('request');
const crypto = require("crypto");
const { generateKeyPair } = require('crypto');
const fs = require('fs');
const Input = require ("./classes/Input");
const Output = require ("./classes/Output");
const readlineSync = require('readline-sync');

var tasks = ['Check Balance', 'Generate Key Pair', 'Transfer Coins', 'Add Alias']
var index = readlineSync.keyInSelect(tasks, 'What would you like to do?');

switch(index){
    case 0:checkBalance()
           break;
    case 1:generateKey()
           break;  
    case 2:transferCoins()
           break; 
    case 3:addAlias()
           break;  
     
}
function checkBalance(){
    var url_ = 'http://localhost:8787/getUnusedOutputs';
    console.log("inside checkBalance");
    var options=['alias','publicKey']
    var choice = readlineSync.keyInSelect(options, 'What method do u want to use');

    if(choice == 0){
        var alias = readlineSync.question( 'Add alias ....');
        var Json = {
            "alias":alias
         }
    }
    if(choice == 1){
        var path = readlineSync.question( 'Enter path to public key ...');
        var pubkey =fs.readFileSync(path).toString('utf-8');
        var Json = {
            "publicKey":pubkey
         }
    }
    request.post(
        {
        url:url_,
        json: Json,
         headers: {
                'Content-Type': 'application/json'
            }
        },
    function(error, response, body){

          console.log("error  :" +error);
          console.log("response == "+response);
          console.log("body "+ body)
          var amount = BigInt(0);
          if (response.statusCode== 200){
            var list = body.unusedOutputs;
            for(let i=0;i< list.length;i++){
            amount+=BigInt(list[i].amount);
            }
            console.log("balance..."+ amount);
          }   
    });
}
function generateKey(){
    console.log('inside generateKeyPair');
    generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
      
        }
      }, (err, publicKey, privateKey) => {
        // Handle errors and use the generated key pair.
        if(!err) 
        { 
          // Prints new asymmetric key pair 
          console.log("Public Key is : ", publicKey); 
          fs.writeFile("publicKey.pem" ,publicKey.toString('hex') , (err) => { 
              // In case of a error throw err. 
              if (err) throw err; 
          }) 
          
          console.log(); 
          console.log("Private Key is: ", privateKey); 
          fs.writeFile("privateKey.pem" ,privateKey.toString('hex') , (err) => { 
              // In case of a error throw err. 
              if (err) throw err; 
          }) 
          
        } 
        else
        { 
          // Prints error 
          console.log("Errr is: ", err); 
        } 
      });
}
async function transferCoins(){
    console.log('inside transferCoins');
    let pubKey = fs.readFileSync(readlineSync.question('Enter the path of your public Key:')).toString('utf-8');
    let privKey = fs.readFileSync(readlineSync.question('Enter the path of your private key:')).toString('utf-8');
    let obj = await getUnusedOutputs(pubkey);
    let unusedOutputs = obj.unusedOutputs;
    let balance = BigInt(obj.balance);
    var num = BigInt(readlineSync.question('Enter the num of outputs'));
    let Outputs = []
    for(let i =0;i<num ; i++){
        var options=['alias','publicKey']
        var choice = readlineSync.keyInSelect(options, 'What method do u want to use');
        var pubkey;
        var expenditure = BigInt(0);
        if(choice == 0){
            var alias = readlineSync.question( 'Add alias ....');
            
            await request.post(
                {
                url:'http://localhost:8787/getPublicKey',
                json: {
                    "alias":alias
                 },
                 headers: {
                        'Content-Type': 'application/json'
                    }
                },
            function(error, response, body){
                pubkey =body.publicKey.toString('utf-8');
            });
        }
        if(choice == 1){
            var path = readlineSync.question( 'Enter path to public key ...');
            var pubkey =fs.readFileSync(path).toString('utf-8');
        }
        var money = BigInt(readlineSync.question( 'Amount of Coins u want to transfer ....'));
        expenditure +=money;
        var pubkeylen = pubkey.length
        let output_ = new Output(money , pubkeylen ,pubkey);
        Outputs.push(output_);
    }
    console.log('u r left with :   '+ balance - expenditure)
    let transactionfees = BigInt(readlineSync.question( 'Transaction fees u want to leave  ....'));
    if(transactionfees + expenditure > balance){
        console.log('Cant spend more than u have ');
        console.log('Exiting...')
        return;
    }
    let rem = balance - expenditure - transactionfees ;
    var backoutput = new Output(rem ,privKey.length , privKey );
    Outputs.push(backoutput);
    
    var Inputs = []
    let outputBuffer_ = outputBuffer(num+1,Outputs);
    let hash = crypto.createHash('sha256').update(outputBuffer_).digest('hex');
    var hashbuf = Buffer.from(hash,"hex");
    for(let j =0 ;j< unusedOutputs.length;j++){
        var trans_id = unusedOutputs[i].transactionId;
        var index = unusedOutputs[i].index;

        var buf1 = Buffer.from(trans_id,"hex");
        var buf2 = Buffer.alloc(4);
        buf2.writeInt32BE(index, 0);
        var signbuff  = Buffer.concat([buf1, buf2 , hashbuf]);

        const signer = crypto.createSign('SHA256');
        signer.update(signbuff);
        const signature = signer.sign({key:privkey,padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('hex');
        const signlen = signature.length / 2;

        let input = new Input(trans_id , index , signlen , signature);

        Inputs.push(input);

    }
    console.log("inputarray:  "+Inputs);
    console.log("outputarray:  "+Outputs);

    request.post(
        {
        url:'http://localhost:8787/newTransaction',
        json: {
          "inputs":Inputs,
          "outputs":Outputs
            },
        headers: {
            'Content-Type': 'application/json'
        }
        },
      function(error, response, body){
        console.log("error  :" +error);
        //console.log(response);
        //console.log(JSON.stringify(body));
        console.log(response.statusCode);
      });


}
function addAlias(){
    console.log("inside addAlias");
    var alias = readlineSync.question( 'Add alias ....');
    var path = readlineSync.question( 'Enter path to public key ...');
    var pubkey =fs.readFileSync(path).toString('utf-8');
    //use http for localhost
    var url_ = 'http://localhost:8787/addAlias'
    request.post(
        {
        url:url_,
        json: {
                "alias":alias,
                "publicKey":pubkey
             },
         headers: {
                'Content-Type': 'application/json'
            }
        },
    function(error, response, body){

          console.log("error  :" +error);
          console.log("response == "+response);
          console.log("body "+ body)

          if (response.statusCode== 400){
            console.log("alias already present");
            }
          if (response.statusCode== 200){
            console.log("alias added");
          }   
    });
}

async function getUnusedOutputs(pubKey) {
    let unusedOutputs = [];
    let balance = 0n;
    var url_ = 'http://localhost:8787/getUnusedOutputs';
    await request.post(
        {
        url:url_ ,
        json:  {
            "publicKey":pubKey
         },
         headers: {
                'Content-Type': 'application/json'
            }
        },
    function(error, response, body){

          console.log("error  :" +error);
          console.log("response == "+response);
          console.log("body "+ body)
          var amount = BigInt(0);
          if (response.statusCode== 200){
            var list = body.unusedOutputs;
            for(let i=0;i< list.length;i++){
            amount+=BigInt(list[i].amount);
            }
            console.log("balance..."+ amount);
          }
          return { "balance" : amount, "unusedOutputs" : list };   
    });
    
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
function outputBuffer(o,outputarray){
    var numo = Buffer.alloc(4);
    numo.writeInt32BE(o,0);
    var bufo= Buffer.alloc(0);
    for (var j =0;j<o;j++){
      bufo = transitionToByteArrayOutput(bufo,outputarray[j].coins ,outputarray[j].length_pubkey , outputarray[j].pubkey);
    }
    var finalbuf = Buffer.concat([numo,bufo]);
    return finalbuf
}