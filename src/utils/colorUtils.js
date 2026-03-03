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
    'entity': '#193A5D',           // Blue
    'entity_gen': '#1E2C4C',       // Light blue
    'relationship': '#075876',     // Red
    'action': '#87200B',           // Orange
    'process': '#20A4F3',          // Cyan
    'result': '#F38181',           // Pink
    'event_attend': '#46215C',     // Purple
    'framework': '#51341D', 
    'milestone': '#B82F2F',       // Green
    'incident': '#8C3C1E',         // Green
    'data': '#A138CE',         // Yellow
    'purpose': '#2B4140',       // Orange
    
    // Financial types
    'funding': '#40C057',          // Green
    'amount': '#61d619',           // Bright green
    'disb_or_trans': '#51CF66',    // Light green
    
    // Organizational types
    'agency': '#7950F2',           // Dark purple
    'recipient': '#4ECDC4',        // Teal
    'dba': '#FF922B',              // Amber
    'organization': '#6F6600',     // Red
    'department': '#E64980',       // Magenta
    'foundation': '#BE4BDB',       // Purple
    'committee': '#FA5252',        // Light red
    'council': '#FF6B6B',          // Coral
    'exchange': '#266B07',          // Coral
    
    // Location types
    'country': '#3E4645',          // Purple
    'location': '#6538CE',         // Sky blue
    'place_of_performance': '#845EF7',  // Violet
    'region': '#95E1D3',           // Mint
    'usaid_program_region': '#74C0FC',  // Light blue
    
    // Description/Document types
    'description': '#51CF66',      // Green
    'publication': '#FF922B',      // Amber
    'article': '#4B4338',          // Light orange                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
    
    // People/Person types
    'person': '#4263EB',           // Blue
    'individual': '#5C7CFA',       // Light blue
    
    // Program/Event types
    'program': '#20A4F3',          // Cyan
    'event': '#7950F2',            // Purple
    'concept': '#193D33',          // Orange
    
    // University/Education
    'university': '#9775FA',       // Purple
    'institution': '#845EF7',      // Violet
    
    // Default fallback
    'default': '#495057'
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
    'entity': '#193A5D',           // Blue
    'entity_gen': '#1E2C4C',       // Light blue
    'relationship': '#075876',     // Red
    'action': '#87200B',           // Orange
    'process': '#20A4F3',          // Cyan
    'result': '#F38181',           // Pink
    'event_attend': '#46215C',     // Purple
    'event_historic': '#521D2E',            // Purple
    'framework': '#51341D', 
    'milestone': '#B82F2F',       // Green
    'incident': '#8C3C1E',         // Green
    'data': '#A138CE',         // Yellow
    'purpose': '#2B4140',       // Orange
    
    // Financial types
    'funding': '#40C057',          // Green
    'amount': '#61d619',           // Bright green
    'disb_or_trans': '#51CF66',    // Light green
    
    // Organizational types
    'agency': '#7950F2',           // Dark purple
    'recipient': '#4ECDC4',        // Teal
    'dba': '#FF922B',              // Amber
    'organization': '#6F6600',     // Red
    'department': '#E64980',       // Magenta
    'foundation': '#BE4BDB',       // Purple
    'committee': '#FA5252',        // Light red
    'council': '#FF6B6B',          // Coral
    'exchange': '#266B07',          // Coral
    
    // Location types
    'country': '#3E4645',          // Purple
    'location': '#6538CE',         // Sky blue
    'place_of_performance': '#845EF7',  // Violet
    'region': '#95E1D3',           // Mint
    'usaid_program_region': '#74C0FC',  // Light blue
    
    // Description/Document types
    'description': '#51CF66',      // Green
    'publication': '#FF922B',      // Amber
    'article': '#4B4338',          // Light orange                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
    
    // People/Person types
    'person': '#4263EB',           // Blue
    'individual': '#5C7CFA',       // Light blue
    
    // Program/Event types
    'program': '#20A4F3',          // Cyan
    'event': '#7950F2',            // Purple
    'concept': '#193D33',          // Orange
    
    // University/Education
    'university': '#9775FA',       // Purple
    'institution': '#845EF7',      // Violet
    
    // Default fallback
    'default': '#495057'
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
