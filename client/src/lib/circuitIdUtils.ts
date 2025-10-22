/**
 * Normalizes circuit ID by replacing spaces with proper separators
 * Examples:
 * - "G 1 10" → "G,1-10"
 * - "G     1   10" → "G,1-10"
 * - "BR 21 365 372" → "BR21,365-372"
 * 
 * Pattern: All parts except last two = prefix, last two = start-end
 */
export function normalizeCircuitId(input: string): string {
  if (!input || !input.trim()) return input;
  
  // Split by any amount of whitespace and filter empty strings
  const parts = input.trim().split(/\s+/).filter(p => p.length > 0);
  
  // Need at least 3 parts to normalize
  if (parts.length < 3) return input;
  
  // Last two parts are the fiber range (start and end)
  const end = parts[parts.length - 1];
  const start = parts[parts.length - 2];
  
  // Everything before that is the prefix (joined together)
  const prefix = parts.slice(0, -2).join('');
  
  // Build normalized format: prefix,start-end
  return `${prefix},${start}-${end}`;
}

/**
 * Cleans OCR extracted text according to these rules:
 * 1. Remove all "NC" text
 * 2. Remove everything inside parentheses ()
 * 3. Remove everything inside angle brackets <>
 * 4. Change @ to 0
 * 5. After all operations, keep only valid circuit ID (prefix number-number)
 * 
 * Example:
 * Input: "BR@21,365-372 NC"
 * Output: "BR021,365-372"
 * 
 * Input: "(A,13-36) <A@5BQRT> BR@21,397-420"
 * Output: "BR021,397-420"
 */
export function cleanOcrText(text: string): string {
  if (!text || !text.trim()) return '';
  
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  
  for (let line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;
    
    // 1. Remove everything inside parentheses
    line = line.replace(/\([^)]*\)/g, '');
    
    // 2. Remove everything inside angle brackets
    line = line.replace(/<[^>]*>/g, '');
    
    // 3. Remove all "NC" text (as whole word)
    line = line.replace(/\bNC\b/gi, '');
    
    // 4. Change @ to 0
    line = line.replace(/@/g, '0');
    
    // 5. Extract valid circuit ID pattern: prefix,number-number
    // Pattern: one or more letters/numbers (prefix), comma, number, dash, number
    // This captures the circuit ID and ignores everything after it
    const circuitIdPattern = /([A-Za-z0-9]+),(\d+)-(\d+)/;
    const match = line.match(circuitIdPattern);
    
    if (match) {
      // Found a valid circuit ID - use it and ignore the rest of the line
      const prefix = match[1];
      const start = match[2];
      const end = match[3];
      cleanedLines.push(`${prefix},${start}-${end}`);
    }
  }
  
  return cleanedLines.join('\n');
}
