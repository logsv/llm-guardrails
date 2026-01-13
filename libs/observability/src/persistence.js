
export const persistenceService = {
  async logRequest(data) {
    // Simple Console Logger for Guardrail Observability
    const timestamp = new Date().toISOString();
    let status = 'PASSED';
    if (data.status === 'error') status = 'ERROR';
    if (data.status === 'blocked') status = 'BLOCKED';
    
    const color = status === 'PASSED' ? '\x1b[32m' : '\x1b[31m'; // Green or Red
    const reset = '\x1b[0m';

    console.log(`\n[${timestamp}] Guardrail Check: ${color}${status}${reset}`);
    
    if (data.guardrail_violations && data.guardrail_violations.length > 0) {
        console.log("Violations:");
        data.guardrail_violations.forEach(v => {
            console.log(`  - [${v.guardrail}] ${v.message}`);
            if (v.value) console.log(`    Value: ${JSON.stringify(v.value)}`);
        });
    } else {
        console.log("  - All checks passed.");
    }
    
    if (data.tokensIn) {
        console.log(`  Usage: ${data.tokensIn} tokens in, ${data.tokensOut} tokens out`);
    }
    console.log(`  Latency: ${data.latencyMs}ms`);
  },
  
  async close() {
    // No-op
  }
};
