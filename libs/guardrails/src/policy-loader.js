import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadPolicy(filePath) {
  let policyPath = filePath;

  if (!policyPath) {
    const rootPolicyPath = path.join(process.cwd(), 'guardrails.yml');
    if (fs.existsSync(rootPolicyPath)) {
      console.log(`Loading policy from root: ${rootPolicyPath}`);
      policyPath = rootPolicyPath;
    } else {
      const defaultPolicyPath = path.join(__dirname, '../policies/default-enterprise-guardrails.yml');
      console.log(`Loading default policy: ${defaultPolicyPath}`);
      policyPath = defaultPolicyPath;
    }
  }

  try {
    const fileContents = fs.readFileSync(policyPath, 'utf8');
    const policy = yaml.load(fileContents);
    return policy;
  } catch (e) {
    throw new Error(`Failed to load policy from ${policyPath}: ${e.message}`);
  }
}
