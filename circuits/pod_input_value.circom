pragma circom 2.1.8;

include "poseidon.circom";
include "@zk-kit/binary-merkle-root.circom/src/binary-merkle-root.circom";

// Verifies a single value from a Pod and its Merkle proof
template PodValueProofVerifier(MAX_MERKLE_DEPTH) {
    signal input root;              // Pod's Merkle root
    signal input hashedKey;         // Key being proven
    signal input value;             // Value being proven
    signal input proofSiblings[MAX_MERKLE_DEPTH];
    signal input proofIndex;        // Single index for the proof path
    signal input proofDepth;
    
    signal output verified_value;   // The value, only if verification passes

    signal proofIndices[MAX_MERKLE_DEPTH] <== Num2Bits(MAX_MERKLE_DEPTH)(proofIndex);

    // // Compute leaf by hashing key-value pair
    // component leafHasher = Poseidon(2);
    // leafHasher.inputs[0] <== hashedKey;
    // leafHasher.inputs[1] <== value;
    
    // Verify the Merkle proof
    component merkleVerifier = BinaryMerkleRoot(MAX_MERKLE_DEPTH);
    merkleVerifier.leaf <== hashedKey;
    merkleVerifier.depth <== proofDepth;
    merkleVerifier.indices <== proofIndices;
    
    for (var i = 0; i < MAX_MERKLE_DEPTH; i++) {
        merkleVerifier.siblings[i] <== proofSiblings[i];
    }

    // Verify root matches and output value
    merkleVerifier.out === root;
    verified_value <== value;
}

// Main template that processes multiple Pod values
template PodValueVerifier(MAX_MERKLE_DEPTH, MAX_INPUT_SIGNED_PODS, MAX_SIGNED_POD_VALUES) {
    var TOTAL_PROOFS = MAX_INPUT_SIGNED_PODS * MAX_SIGNED_POD_VALUES;
    
    // Input signals
    signal input inputRoots[MAX_INPUT_SIGNED_PODS];
    signal input inputHashedKeys[TOTAL_PROOFS];
    signal input inputValues[TOTAL_PROOFS];
    signal input inputProofSiblings[TOTAL_PROOFS][MAX_MERKLE_DEPTH];
    signal input inputProofIndices[TOTAL_PROOFS];  
    signal input inputProofDepths[TOTAL_PROOFS];

    // Output signals - all values are made public
    signal output public_statements[TOTAL_PROOFS];

    // Create proof verifiers for each value
    component verifiers[TOTAL_PROOFS];
    
    for (var i = 0; i < TOTAL_PROOFS; i++) {
        verifiers[i] = PodValueProofVerifier(MAX_MERKLE_DEPTH);
        
        // Calculate which Pod this proof belongs to
        var podIndex = i \ MAX_SIGNED_POD_VALUES;  // Integer division
        
        // Wire up the verifier
        verifiers[i].root <== inputRoots[podIndex];
        verifiers[i].hashedKey <== inputHashedKeys[i];
        verifiers[i].value <== inputValues[i];
        verifiers[i].proofDepth <== inputProofDepths[i];
        verifiers[i].proofIndex <== inputProofIndices[i];
        
        for (var j = 0; j < MAX_MERKLE_DEPTH; j++) {
            verifiers[i].proofSiblings[j] <== inputProofSiblings[i][j];
        }
        
        // Add verified value to public statements
        public_statements[i] <== verifiers[i].verified_value;
    }
}

