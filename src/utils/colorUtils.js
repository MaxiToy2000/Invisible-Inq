export const getNodeTypeColor = (nodeType) => {
  // Normalize the node type for lookup (handle both "Entity" and "entity" and "entity_name" formats)
  const normalizedType = String(nodeType || '')
    .toLowerCase()
    .replace(/[_\s-]+/g, '_')  // Normalize spaces, hyphens, underscores to single underscore
    .trim();

  // Color mappings for all node types from the updated Neo4j database
  // Using normalized keys (lowercase with underscores)
  const colors = {
    // Primary entity types
    'entity': '#4263EB',           // Blue
    'entity_gen': '#5C7CFA',       // Light blue
    'relationship': '#F03E3E',     // Red
    'action': '#FD7E14',           // Orange
    'process': '#20A4F3',          // Cyan
    'result': '#F38181',           // Pink
    'event_attend': '#9775FA',     // Purple
    
    // Financial types
    'funding': '#40C057',          // Green
    'amount': '#61d619',           // Bright green
    'disb_or_trans': '#51CF66',    // Light green
    
    // Organizational types
    'agency': '#7950F2',           // Dark purple
    'recipient': '#4ECDC4',        // Teal
    'dba': '#FF922B',              // Amber
    'organization': '#F03E3E',     // Red
    'department': '#E64980',       // Magenta
    'foundation': '#BE4BDB',       // Purple
    'committee': '#FA5252',        // Light red
    'council': '#FF6B6B',          // Coral
    
    // Location types
    'country': '#9775FA',          // Purple
    'location': '#339AF0',         // Sky blue
    'place_of_performance': '#845EF7',  // Violet
    'region': '#95E1D3',           // Mint
    'usaid_program_region': '#74C0FC',  // Light blue
    
    // Description/Document types
    'description': '#51CF66',      // Green
    'publication': '#FF922B',      // Amber
    'article': '#FFA94D',          // Light orange
    
    // People/Person types
    'person': '#4263EB',           // Blue
    'individual': '#5C7CFA',       // Light blue
    
    // Program/Event types
    'program': '#20A4F3',          // Cyan
    'event': '#7950F2',            // Purple
    'concept': '#FD7E14',          // Orange
    
    // University/Education
    'university': '#9775FA',       // Purple
    'institution': '#845EF7',      // Violet
    
    // Default fallback
    'default': '#495057'           // Dark gray
  };

  return colors[normalizedType] || colors.default;
};

export const getCategoryColor = (category) => {
  // Normalize the category for lookup (handle underscores, spaces, hyphens)
  const normalizedCategory = String(category || '')
    .toLowerCase()
    .replace(/[_\s-]+/g, '_')
    .trim();

  // Category color mappings (aligned with node type colors)
  const colors = {
    // Primary categories
    'entity': '#4263EB',           // Blue
    'entity_gen': '#5C7CFA',       // Light blue
    'relationship': '#F03E3E',     // Red
    'action': '#FD7E14',           // Orange
    'process': '#20A4F3',          // Cyan
    'result': '#F38181',           // Pink
    'event_attend': '#9775FA',     // Purple
    
    // People
    'person': '#4263EB',           // Blue
    'individual': '#5C7CFA',       // Light blue
    
    // Organizations
    'organization': '#F03E3E',     // Red
    'agency': '#7950F2',           // Dark purple
    'committee': '#FA5252',        // Light red
    'council': '#FF6B6B',          // Coral
    'department': '#E64980',       // Magenta
    'foundation': '#BE4BDB',       // Purple
    'university': '#9775FA',       // Purple
    'institution': '#845EF7',      // Violet
    
    // Locations
    'location': '#339AF0',         // Sky blue
    'country': '#9775FA',          // Purple
    'region': '#95E1D3',           // Mint
    'place': '#845EF7',            // Violet
    
    // Financial
    'fund': '#40C057',             // Green
    'funding': '#40C057',          // Green
    'amount': '#61d619',           // Bright green
    'financial': '#51CF66',        // Light green
    
    // Events/Programs
    'event': '#7950F2',            // Purple
    'program': '#20A4F3',          // Cyan
    'concept': '#FD7E14',          // Orange
    
    // Documents/Publications
    'publication': '#FF922B',      // Amber
    'article': '#FFA94D',          // Light orange
    'document': '#FFD43B',         // Yellow
    
    // Default fallback
    'default': '#495057'           // Dark gray
  };

  return colors[normalizedCategory] || colors.default;
};

export const isLightColor = (color) => {
  const hex = color.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

  return brightness > 155;
};
