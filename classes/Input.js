class Input {
    constructor (transactionID, index, sign_length, sign) {
        this.transactionID = transactionID;
        this.index = index;
        this.sign_length = sign_length;
        this.sign = sign;
    }
}

module.exports = Input 