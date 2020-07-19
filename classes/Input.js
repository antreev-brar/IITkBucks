class Input {
    constructor (transactionId, index, sign_length, sign) {
        this.transactionId = transactionId;
        this.index = index;
        this.sign_length = sign_length;
        this.sign = sign;
    }
}

module.exports = Input 