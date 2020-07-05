class BlockHead{
    constructor( index, hashParent ,hashBlockbody, target){
       this.index = index
       this.hashParent = hashParent
       this.hashBlockbody = hashBlockbody
       this.target = target
    }
}
module.exports = BlockHead;