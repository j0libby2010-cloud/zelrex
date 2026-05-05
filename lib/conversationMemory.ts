/**
 * ZELREX IN-CONVERSATION MEMORY INJECTOR
 * 
 * Problem: Within a long session, if the user says something at message 3 and
 * asks about it at message 50, Claude may lose that detail because it's far
 * back in the conversation history. The session-to-session memory (user_memory
 * table) helps across sessions but not within a single long session.
 * 
 * Solution: mid-conversation, scan what the user has said and re-surface key
 * facts right before Claude generates its response. This acts as a "working
 * memory refresh" for long conversations.
 * 
 * Specifically extracts:
 * - Numbers the user stated (income, goals, rates, deadlines)
 * - Named entities (clients, tools, platforms they're on)
 * - Commitments ("I'll do X by Y")
 * - Constraints ("I can't do X because...")
 */

export interface ConversationFact {
  messageIndex: number;
  category: 'number' | 'entity' | 'commitment' | 'constraint' | 'preference';
  content: string;
  context: string; // Surrounding sentence
}

/**
 * Scan user messages and extract key facts for re-injection.
 */
export function extractConversationFacts(
  messages: Array<{ role: string; content: string | any }>
): ConversationFact[] {
  const facts: ConversationFact[] = [];
  
  messages.forEach((msg, idx) => {
    if (msg.role !== 'user') return;
    const text = typeof msg.content === 'string' ? msg.content : '';
    if (!text || text.length < 10) return;
    
    // Extract dollar amounts
    const moneyMatches = text.matchAll(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:k|K|\s*(?:month|year|week|day|hour|client|project)))?/g);
    for (const m of moneyMatches) {
      const surroundingText = getSurroundingContext(text, m.index || 0, 80);
      facts.push({
        messageIndex: idx,
        category: 'number',
        content: m[0],
        context: surroundingText,
      });
    }
    
    // Extract specific time references
    const timeMatches = text.matchAll(/\b(\d+)\s*(?:hours?|days?|weeks?|months?|years?)\s*(?:a|per|\/)\s*(?:week|month|year|day)\b/gi);
    for (const m of timeMatches) {
      const surroundingText = getSurroundingContext(text, m.index || 0, 80);
      facts.push({
        messageIndex: idx,
        category: 'number',
        content: m[0],
        context: surroundingText,
      });
    }
    
    // Extract commitments
    const commitPatterns = [
      /I(?:'ll| will)\s+[\w\s]{5,80}(?=[.!?,]|$)/gi,
      /I(?:'m| am)\s+going\s+to\s+[\w\s]{5,80}(?=[.!?,]|$)/gi,
      /I plan(?:ned)? to\s+[\w\s]{5,80}(?=[.!?,]|$)/gi,
    ];
    for (const pattern of commitPatterns) {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0].length < 150) {
          facts.push({
            messageIndex: idx,
            category: 'commitment',
            content: m[0].trim(),
            context: m[0].trim(),
          });
        }
      }
    }
    
    // Extract constraints
    const constraintPatterns = [
      /I can't\s+[\w\s]{5,80}(?=[.!?,]|$)/gi,
      /I (?:don't|do not)\s+(?:want|have|know)\s+[\w\s]{5,80}(?=[.!?,]|$)/gi,
      /I'm not (?:able|allowed|willing) to\s+[\w\s]{5,60}(?=[.!?,]|$)/gi,
    ];
    for (const pattern of constraintPatterns) {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        if (m[0].length < 150) {
          facts.push({
            messageIndex: idx,
            category: 'constraint',
            content: m[0].trim(),
            context: m[0].trim(),
          });
        }
      }
    }
    
    // Extract proper nouns that appear to be clients/tools/platforms
    // (Capitalized words that aren't at the start of a sentence)
    const properNounMatches = text.matchAll(/(?<=[a-z]\s+)([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)*)/g);
    const seenNouns = new Set<string>();
    for (const m of properNounMatches) {
      const noun = m[1];
      if (seenNouns.has(noun)) continue;
      seenNouns.add(noun);
      // Filter out common words that happen to be capitalized
      if (/^(?:I|A|An|The|But|And|Or|For|With|About)$/i.test(noun)) continue;
      if (noun.length < 4) continue;
      
      const idx2 = m.index || 0;
      const surroundingText = getSurroundingContext(text, idx2, 100);
      facts.push({
        messageIndex: idx,
        category: 'entity',
        content: noun,
        context: surroundingText,
      });
    }
  });
  
  return facts;
}

function getSurroundingContext(text: string, position: number, windowSize: number): string {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  return text.slice(start, end).trim();
}

/**
 * Given the extracted facts, build a concise "working memory" summary
 * to inject just before Claude responds. This reminds Claude what the user
 * has already said, preventing it from asking questions that were already answered
 * or forgetting commitments the user made.
 */
export function buildWorkingMemoryReminder(
  facts: ConversationFact[],
  currentMessageIndex: number
): string {
  // Only re-surface if conversation is long enough that context might be pressured
  if (currentMessageIndex < 10) return '';
  
  // Deduplicate facts by content similarity
  const uniqueFacts = dedupeByContent(facts);
  
  // Focus on facts stated in the first 70% of the conversation (older ones more at risk of being forgotten)
  const cutoff = Math.floor(currentMessageIndex * 0.7);
  const oldFacts = uniqueFacts.filter(f => f.messageIndex < cutoff);
  
  if (oldFacts.length === 0) return '';
  
  // Group by category
  const numbers = oldFacts.filter(f => f.category === 'number').slice(0, 8);
  const entities = oldFacts.filter(f => f.category === 'entity').slice(0, 6);
  const commitments = oldFacts.filter(f => f.category === 'commitment').slice(0, 4);
  const constraints = oldFacts.filter(f => f.category === 'constraint').slice(0, 4);
  
  let reminder = '\n\n═══════════════════════════════════════════════\nWORKING MEMORY — facts the user has mentioned earlier in THIS conversation:\n';
  
  if (numbers.length > 0) {
    reminder += `\nNumbers stated: ${numbers.map(f => f.content).join(', ')}`;
  }
  if (entities.length > 0) {
    reminder += `\nNamed entities (clients/tools/platforms): ${entities.map(f => f.content).join(', ')}`;
  }
  if (commitments.length > 0) {
    reminder += `\nUser commitments:\n${commitments.map(f => `- ${f.content}`).join('\n')}`;
  }
  if (constraints.length > 0) {
    reminder += `\nUser constraints:\n${constraints.map(f => `- ${f.content}`).join('\n')}`;
  }
  
  reminder += '\n\nUse these facts. Do NOT ask the user to re-state information they already gave you. If you think you may have forgotten something, refer back to this list before asking.\n═══════════════════════════════════════════════\n';
  
  return reminder;
}

function dedupeByContent(facts: ConversationFact[]): ConversationFact[] {
  const seen = new Set<string>();
  const result: ConversationFact[] = [];
  for (const fact of facts) {
    const key = `${fact.category}:${fact.content.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(fact);
  }
  return result;
}