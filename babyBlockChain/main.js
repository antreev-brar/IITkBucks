
const SHA256 = require('crypto-js/sha256');
class Block{
    constructor(index , timestamp , data , previousHash =''){
      this.index = index ;
      this.timestamp = timestamp;
      this.data = data;
      this.previousHash = previousHash;
      this.hash = this.calculateHash();
      this.nonce = 0;
    }

    calculateHash(){
        return SHA256(this.index + this.previousHash + this.timestamp + this.nonce + JSON.stringify(this.data)).toString();
    }

    mineBLock(difficulty){
        while(this.hash.substring(0,difficulty) !== Array(difficulty + 1).join("0")){
              this.hash = this.calculateHash();
              this.nonce++;
        }
        console.log("Block mined :"+ this.hash);
    }
}


class Blockchain{
    constructor() {
        this.chain=[this.createGenesisBlock()];
        this.difficulty = 5;
  }
    createGenesisBlock(){
        return new Block(0 , "28/04/2020" , "Genesis" , "0");
    }

    getLatestBlock(){
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock){
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.mineBLock(this.difficulty);
        this.chain.push(newBlock);
    }

    isChainValid(){
        for(let i =1 ; i< this.chain.length; i++){
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i-1];

            if(currentBlock.hash !== currentBlock.calculateHash()){
                return false ;
            }

            if(currentBlock.previousHash !== previousBlock.hash){
                return false ; 
            }

            
        }

        return true;
    }
}

let antreev = new Blockchain();

console.log("Mining Block ...")
antreev.addBlock(new Block(1,"29/04/2020" , {amount: 4}));
console.log("Mining Block ...")
antreev.addBlock(new Block(2,"29/04/2020" , {amount: 40}));


//console.log('is blockchain valid : ' +antreev.isChainValid());
//console.log(JSON.stringify(antreev , null , 4));
//antreev.chain[1].data  = {amount : 500};
//console.log('is blockchain valid : ' +antreev.isChainValid());