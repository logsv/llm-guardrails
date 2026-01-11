import fs from 'fs';
import yaml from 'js-yaml';

export function loadPolicy(filePath) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const policy = yaml.load(fileContents);
    return policy;
  } catch (e) {
    throw new Error(`Failed to load policy from ${filePath}: ${e.message}`);
  }
}
