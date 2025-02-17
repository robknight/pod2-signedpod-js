pragma circom 2.1.8;

include "./pod_input_value.circom";
include "./operations/equals.circom";
include "circomlib/circuits/comparators.circom";

template MainCircuit(MAX_MERKLE_DEPTH, MAX_INPUT_SIGNED_PODS, MAX_SIGNED_POD_VALUES, MAX_OPERATIONS, MAX_OPERATION_ARGS) {
    var TOTAL_PROOFS = MAX_INPUT_SIGNED_PODS * MAX_SIGNED_POD_VALUES;
    
    // Pod value verification inputs
    signal input inputRoots[MAX_INPUT_SIGNED_PODS];
    signal input inputHashedKeys[TOTAL_PROOFS];
    signal input inputValues[TOTAL_PROOFS];
    signal input inputProofSiblings[TOTAL_PROOFS][MAX_MERKLE_DEPTH];
    signal input inputProofIndices[TOTAL_PROOFS];
    signal input inputProofDepths[TOTAL_PROOFS];
    
    // Operation inputs
    signal input operationCodes[MAX_OPERATIONS];
    signal input operationArgs[MAX_OPERATIONS][MAX_OPERATION_ARGS];
    
    // All statements (both from Pod values and operation outputs)
    signal output public_statements[TOTAL_PROOFS + MAX_OPERATIONS];
    
    // First, verify Pod values
    component podVerifier = PodValueVerifier(MAX_MERKLE_DEPTH, MAX_INPUT_SIGNED_PODS, MAX_SIGNED_POD_VALUES);
    
    // Wire up Pod verification (direct pass-through)
    podVerifier.inputRoots <== inputRoots;
    podVerifier.inputHashedKeys <== inputHashedKeys;
    podVerifier.inputValues <== inputValues;
    podVerifier.inputProofSiblings <== inputProofSiblings;
    podVerifier.inputProofIndices <== inputProofIndices;
    podVerifier.inputProofDepths <== inputProofDepths;
    
    // Copy Pod values to public_statements
    for (var i = 0; i < TOTAL_PROOFS; i++) {
        public_statements[i] <== podVerifier.public_statements[i];
    }
    
    // Process operations
    component equalOps[MAX_OPERATIONS];
    component codeCheck[MAX_OPERATIONS];
    signal isEqualsOp[MAX_OPERATIONS];
    
    for (var i = 0; i < MAX_OPERATIONS; i++) {
        equalOps[i] = EqualsOperation(MAX_INPUT_SIGNED_PODS, MAX_SIGNED_POD_VALUES);
        codeCheck[i] = IsEqual();
        
        // Wire up the operation
        equalOps[i].arg0_idx <== operationArgs[i][0];
        equalOps[i].arg1_idx <== operationArgs[i][1];
        for (var j = 0; j < TOTAL_PROOFS; j++) {
            equalOps[i].statements[j] <== public_statements[j];
        }
        
        codeCheck[i].in[0] <== operationCodes[i];
        codeCheck[i].in[1] <== 3;
        isEqualsOp[i] <== codeCheck[i].out;
        
        // Store operation result (0 if not code 3)
        public_statements[TOTAL_PROOFS + i] <== equalOps[i].out * isEqualsOp[i];
    }
}

