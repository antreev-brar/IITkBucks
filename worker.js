var crypto = require("crypto");
const {parentPort } = require('worker_threads');
const now = require('nano-time');



function miner(buf , target){
    var nonce = BigInt(0);
    var timestamp;
    var checkString;
    var bufNonce = Buffer.alloc(8);
    var bufTimestamp = Buffer.alloc(8);
    while(true){
        timestamp = BigInt(now());
        bufTimestamp.writeBigInt64BE(timestamp, 0);
        bufNonce.writeBigInt64BE(nonce, 0);
        var bufCheck = Buffer.concat([buf,bufTimestamp,bufNonce]);
        //console.log(bufCheck.length);
        checkString = crypto.createHash('sha256').update(bufCheck).digest('hex');
        if(checkString<target){
            parentPort.postMessage({header : bufCheck});
            break;
        }else{
            nonce = nonce + 1n ;
        }
    }


}

parentPort.on('message', message => {
    let header = message.header;
  
    var bufIndex = Buffer.alloc(4);
    bufIndex.writeInt32BE(header.index, 0);
    var bufHashParent = Buffer.from(header.hashParent,'hex');
    var bufHashBlockbody = Buffer.from(header.hashBlockbody,'hex');
    var bufTarget = Buffer.from(header.target , 'hex');
    var buf = Buffer.concat([bufIndex,bufHashParent,bufHashBlockbody,bufTarget]);
    
    miner(buf, header.target);
});