pragma circom 2.1.8;

include "../pod_input_value.circom";
include "circomlib/circuits/mux1.circom";
include "../common/input_selector.circom";

// Takes two indices into public_statements and returns 1 if they're equal, 0 otherwise
template EqualsOperation(MAX_INPUT_SIGNED_PODS, MAX_SIGNED_POD_VALUES) {
    var TOTAL_STATEMENTS = MAX_INPUT_SIGNED_PODS * MAX_SIGNED_POD_VALUES;
    
    signal input arg0_idx;
    signal input arg1_idx;
    signal input statements[TOTAL_STATEMENTS];
    signal output out;

    // Safe constrained array access using InputSelector
    component selector0 = InputSelector(TOTAL_STATEMENTS);
    component selector1 = InputSelector(TOTAL_STATEMENTS);
    
    selector0.inputs <== statements;
    selector0.selectedIndex <== arg0_idx;
    
    selector1.inputs <== statements;
    selector1.selectedIndex <== arg1_idx;

    // Compare values using circomlib's IsEqual
    component isEqual = IsEqual();
    isEqual.in[0] <== selector0.out;
    isEqual.in[1] <== selector1.out;
    
    out <== isEqual.out;
}