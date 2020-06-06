
class Transaction{
    constructor(numInputs,inputs ,numOutputs ,outputs) {
        this.numInputs = numInputs
        this.inputs = inputs;
        this.numOutputs = numOutputs;
        this.outputs = outputs;
    }
}

module.exports = Transaction;