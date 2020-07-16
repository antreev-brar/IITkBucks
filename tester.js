var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
const crypto = require("crypto");
function verify_signature(str,text , pubkey){
    let signatureSignedByPrivateKey = str
    let pem = pubkey
    let publicKey = pem.toString('ascii')
    const verifier = crypto.createVerify('SHA256')
    verifier.update(text, 'ascii')
    const publicKeyBuf =  Buffer.from(publicKey, 'ascii')
    const signatureBuf = Buffer.from(signatureSignedByPrivateKey, 'hex')
    const result = verifier.verify({key:publicKeyBuf, padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32}, signatureBuf)
    console.log(result);
    return result;
}
function signature(id){
   
    
    var privkey =fs.readFileSync('private.pem');
    console.log(id); 
    const signer = crypto.createSign('SHA256');
    signer.update(id);
    const signature = signer.sign({key:privkey,padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('hex');
    console.log(signature)
    //console.log("end----")
}
let pubkey = fs.readFileSync('public.pem');
var hex = 'cc7f49ea1a79fea25e82eb187f674b75bfa80e99155d088866f8f32d7ef1212c00000001659509c0d11708c86f2528a2d5fa0202b79f29b6fa550b1a6d7f4893a60c976d';
hex.toString('hex');
var hex_buf = Buffer.from(hex , 'hex');
console.log(hex_buf.length);
var h = '398901b7206040acc3227c7b384a9a477a803e4751192ef3fe55c1a268a603903f6a899608379d3eff08babdc429a40abd14451b7d803464b704b27b97a00ef2127fb050c61c14c33116626f0025dc58fa9248613b14954b5731d02c11f6c74372aaf5d80ad4f34bb5b399317e87818691f497b6ecf0eaff91f66c1bb2fc2a58b4229f188c96f88ba56b86ac51d712dea2edaa38377a929011ef34ebbdfb504f37a2262e87f2d84c759ab3a7bae67b7e5ee6f7c0b52bb2cec49322a1418def8f366fd833579475cee424d9c530c66bec346374cdaacbf27b3e361c051c45319036bfe3b12f8e32c8fcb8a17bde477721fb6373898066bf92d96da1107ef9eb38';
//h.toString('hex');
//console.log(pubkey)
console.log(verify_signature(h,hex_buf,pubkey));
//signature(hex_buf)