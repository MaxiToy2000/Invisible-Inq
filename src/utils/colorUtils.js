export const getNodeTypeColor = (nodeType) => {
  const colors = {
    'Entity': '#4263EB',
    'Relationship': '#F03E3E',
    'Funding': '#40C057',
    'Amount': '#61d619',
    'Agency': '#7950F2',
    'Action': '#FD7E14',
    'Country': '#9775FA',
    'DBA': '#FF922B',
    'Description': '#51CF66',
    'Location': '#339AF0',
    'Place Of Performance': '#845EF7',
    'Process': '#20A4F3',
    'Recipient': '#4ECDC4',
    'Region': '#95E1D3',
    'Result': '#F38181',
    'default': '#495057'  
  };

  return colors[nodeType] || colors.default;
};

export const getCategoryColor = (category) => {
  const colors = {
    'person': '#4263EB',
    'organization': '#F03E3E',
    'location': '#40C057',
    'event': '#7950F2',
    'concept': '#FD7E14',
    'fund': '#40C057',
    'program': '#20A4F3',
    'committee': '#F03E3E',
    'council': '#F03E3E',
    'department': '#F03E3E',
    'foundation': '#F03E3E',
    'university': '#9775FA',
    'publication': '#FF922B',
    'default': '#495057'
  };

  return colors[category?.toLowerCase()] || colors.default;
};

export const isLightColor = (color) => {
  const hex = color.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

  return brightness > 155;
};
