class TextProcessor {
  static clean(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return '';
    }
    
    console.log(`🧹 Cleaning text (${rawText.length} characters)`);
    
    let cleaned = rawText;
    
    // Remove common boilerplate phrases (case-insensitive)
    const boilerplatePatterns = [
      /print\s+recipe/gi,
      /share\s+on\s+facebook/gi,
      /pin\s+to\s+pinterest/gi,
      /tweet\s+this/gi,
      /share\s+on\s+twitter/gi,
      /subscribe\s+to\s+newsletter/gi,
      /sign\s+up\s+for\s+newsletter/gi,
      /advertisement/gi,
      /sponsored\s+content/gi,
      /follow\s+us\s+on/gi,
      /like\s+us\s+on/gi,
      /get\s+our\s+app/gi,
      /download\s+our\s+app/gi,
      /privacy\s+policy/gi,
      /terms\s+of\s+service/gi,
      /cookie\s+policy/gi,
      /all\s+rights\s+reserved/gi,
      /copyright\s+\d{4}/gi,
      /\d{4}\s+copyright/gi,
      /related\s+recipes/gi,
      /more\s+recipes/gi,
      /you\s+might\s+also\s+like/gi,
      /recommended\s+for\s+you/gi,
      /popular\s+recipes/gi,
      /trending\s+now/gi,
      /leave\s+a\s+comment/gi,
      /rate\s+this\s+recipe/gi,
      /save\s+recipe/gi,
      /add\s+to\s+favorites/gi,
      /jump\s+to\s+recipe/gi,
      /print\s+friendly/gi,
      /nutrition\s+facts/gi,
      /calories\s+per\s+serving/gi,
      /prep\s+time:/gi,
      /cook\s+time:/gi,
      /total\s+time:/gi,
      /serves:\s*\d+/gi,
      /difficulty:\s*\w+/gi
    ];
    
    // Remove boilerplate phrases
    boilerplatePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });
    
    // Remove excessive punctuation and special characters
    cleaned = cleaned.replace(/[^\w\s\-.,;:()\[\]]/g, ' ');
    
    // Collapse multiple spaces and normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Split into lines and remove duplicates
    const lines = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 3); // Remove very short lines
    
    // Remove duplicate lines (simple deduplication)
    const uniqueLines = [];
    const seenLines = new Set();
    
    for (const line of lines) {
      const normalizedLine = line.toLowerCase().replace(/\s+/g, ' ');
      if (!seenLines.has(normalizedLine)) {
        seenLines.add(normalizedLine);
        uniqueLines.push(line);
      }
    }
    
    // Join back and final cleanup
    cleaned = uniqueLines.join('\n').trim();
    
    // Remove empty lines and normalize spacing
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    
    console.log(`🧹 Cleaned text: ${cleaned.length} characters (${rawText.length - cleaned.length} removed)`);
    
    return cleaned;
  }
  
  static extractRecipeStructure(text) {
    console.log(`🔍 Extracting recipe structure from text`);
    
    const result = {
      title: '',
      ingredients: [],
      instructions: [],
      notes: ''
    };
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Try to identify sections
    let currentSection = 'unknown';
    let ingredientLines = [];
    let instructionLines = [];
    let titleCandidates = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Identify section headers
      if (line.includes('ingredient') || line.includes('what you need')) {
        currentSection = 'ingredients';
        continue;
      } else if (line.includes('instruction') || line.includes('method') || 
                 line.includes('direction') || line.includes('steps') ||
                 line.includes('how to make')) {
        currentSection = 'instructions';
        continue;
      }
      
      // Collect potential titles (short lines at the beginning)
      if (i < 5 && lines[i].length < 100 && lines[i].length > 5) {
        titleCandidates.push(lines[i]);
      }
      
      // Collect ingredients (lines with measurements/quantities)
      if (currentSection === 'ingredients' || this.looksLikeIngredient(lines[i])) {
        ingredientLines.push(lines[i]);
      }
      
      // Collect instructions (numbered steps or procedural text)
      if (currentSection === 'instructions' || this.looksLikeInstruction(lines[i])) {
        instructionLines.push(lines[i]);
      }
    }
    
    // Set best title candidate
    result.title = titleCandidates.length > 0 ? titleCandidates[0] : 'Extracted Recipe';
    result.ingredients = ingredientLines;
    result.instructions = instructionLines;
    
    console.log(`🔍 Extracted: title="${result.title}", ${result.ingredients.length} ingredients, ${result.instructions.length} instructions`);
    
    return result;
  }
  
  static looksLikeIngredient(line) {
    // Check if line looks like an ingredient (has measurements)
    const measurementPatterns = [
      /\d+\s*(cup|cups|tsp|tbsp|teaspoon|tablespoon|oz|ounce|lb|pound|g|gram|kg|ml|liter)/i,
      /\d+\/\d+/,  // Fractions
      /\d+\s*(to|or|-)\s*\d+/,  // Ranges
      /^\d+\s+/,  // Starts with number
      /\d+\s*(clove|cloves|piece|pieces|slice|slices)/i
    ];
    
    return measurementPatterns.some(pattern => pattern.test(line)) && line.length < 200;
  }
  
  static looksLikeInstruction(line) {
    // Check if line looks like an instruction
    const instructionPatterns = [
      /^\d+\./,  // Numbered steps
      /^step\s+\d+/i,
      /^(heat|cook|add|mix|stir|combine|place|put|set|bake|fry|boil)/i,
      /^(preheat|prepare|wash|chop|dice|slice|mince)/i
    ];
    
    return instructionPatterns.some(pattern => pattern.test(line)) || 
           (line.length > 20 && line.length < 500 && line.includes(' '));
  }
  
  static combineTexts(webText, pdfText, imageText = '') {
    console.log(`🔗 Combining texts: web(${webText.length}), pdf(${pdfText.length}), image(${imageText.length})`);
    
    const combined = [webText, pdfText, imageText]
      .filter(text => text && text.trim())
      .join('\n\n---\n\n');
    
    return this.clean(combined);
  }
}

export default TextProcessor;