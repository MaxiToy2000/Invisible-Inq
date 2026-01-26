export const loadJsonData = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load data from ${filePath}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading JSON data:', error);
    throw error;
  }
};

export const loadCsvData = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load data from ${filePath}`);
    }

    const text = await response.text();

    if (!text || !text.trim()) {
      console.warn(`CSV file at ${filePath} is empty`);
      return [];
    }

    const rows = text.split(/\r?\n/).filter(row => row.trim());

    if (!rows.length) {
      console.warn(`No valid rows found in CSV file at ${filePath}`);
      return [];
    }

    const headerRow = rows[0];
    if (!headerRow) {
      console.warn(`No header row found in CSV file at ${filePath}`);
      return [];
    }

    const headers = headerRow.split(',').map(header => header.trim());

    return rows.slice(1)
      .filter(row => row.trim())
      .map(row => {
        try {
          const values = row.split(',').map(value => value.trim());
          return headers.reduce((obj, header, index) => {
            if (header) {
              obj[header] = values[index] || '';
            }
            return obj;
          }, {});
        } catch (rowError) {
          console.warn(`Error parsing CSV row: ${row}`, rowError);
          return {};
        }
      })
      .filter(obj => Object.keys(obj).length > 0);
  } catch (error) {
    console.error('Error loading CSV data:', error);
    throw error;
  }
};

export const loadStoryList = async (directoryPath) => {
  try {
    const response = await fetch(`${directoryPath}/index.json`);
    if (!response.ok) {
      throw new Error(`Failed to load story list from ${directoryPath}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading story list:', error);
    throw error;
  }
};

const generateRandomId = () => {
  return `id-${Math.random().toString(36).substring(2, 11)}`;
};

const determineEntityCategory = (node) => {
  // New DB: prefer normalized Neo4j label
  const nodeType = node.node_type || (Array.isArray(node.labels) ? node.labels[0] : null) || node.type;
  if (nodeType) {
    return String(nodeType).toLowerCase().replace(/\s+/g, '_');
  }

  if (node.category) {
    return node.category;
  }

  if (node.type && node.type !== 'Entity') {
    return node.type.toLowerCase();
  }

  const entityName = node['Entity Name'] || node.entity_name || node.relationship_name || node['Relationship NAME'] || node.name || '';

  const entityNameStr = String(entityName || '');

  const nameLower = entityNameStr.toLowerCase();

  if (nameLower.includes('fund') || nameLower.includes('grant') || nameLower.includes('donation') ||
      nameLower.includes('investment') || nameLower.includes('capital')) {
    return 'fund';
  }

  if (nameLower.includes('program') || nameLower.includes('project') || nameLower.includes('initiative') ||
      nameLower.includes('campaign') || nameLower.includes('operation')) {
    return 'program';
  }

  if (nameLower.includes('committee') || nameLower.includes('commission') || nameLower.includes('board')) {
    return 'committee';
  }

  if (nameLower.includes('council') || nameLower.includes('advisory')) {
    return 'council';
  }

  if (nameLower.includes('department') || nameLower.includes('dept') || nameLower.includes('division') ||
      nameLower.includes('bureau') || nameLower.includes('agency') || nameLower.includes('office')) {
    return 'department';
  }

  if (nameLower.includes('foundation') || nameLower.includes('trust') || nameLower.includes('institute') ||
      nameLower.includes('association') || nameLower.includes('society')) {
    return 'foundation';
  }

  if (nameLower.includes('university') || nameLower.includes('college') || nameLower.includes('school') ||
      nameLower.includes('academy') || nameLower.includes('campus')) {
    return 'university';
  }

  if (nameLower.includes('report') || nameLower.includes('publication') || nameLower.includes('journal') ||
      nameLower.includes('paper') || nameLower.includes('article') || nameLower.includes('book')) {
    return 'publication';
  }

  if (nameLower.includes('organization') || nameLower.includes('corporation') || nameLower.includes('company') ||
      nameLower.includes('inc') || nameLower.includes('ltd') || nameLower.includes('llc') ||
      nameLower.includes('group') || nameLower.includes('enterprise')) {
    return 'organization';
  }

  if (nameLower.includes('country') || nameLower.includes('city') || nameLower.includes('state') ||
      nameLower.includes('region') || nameLower.includes('province') || nameLower.includes('territory')) {
    return 'location';
  }

  if (nameLower.includes('conference') || nameLower.includes('meeting') || nameLower.includes('summit') ||
      nameLower.includes('symposium') || nameLower.includes('convention')) {
    return 'event';
  }

  return 'person';
};

export const formatGraphData = (rawData) => {
  const validRawData = rawData || { nodes: [], links: [] };

  const normalizeType = (t) => (t ? String(t).toLowerCase().replace(/\s+/g, '_') : '');

  const nodes = [];

  if (Array.isArray(validRawData.nodes)) {
    validRawData.nodes.forEach((node) => {
      const id = String(
        node.id ??
          node.gid ??
          node.elementId ??
          node.element_id ??
          generateRandomId(),
      );

      const nodeType =
        node.node_type ||
        node.type ||
        (Array.isArray(node.labels) && node.labels.length ? node.labels[0] : '');

      const category = node.category || normalizeType(nodeType) || determineEntityCategory(node);

      const nodeName =
        node.name ||
        node.title ||
        node['Entity Name'] ||
        node.entity_name ||
        node.relationship_name ||
        node['Relationship NAME'] ||
        node.summary ||
        node.Summary ||
        id;
      const nodeNameStr = String(nodeName || '');

      nodes.push({
        ...node,
        id,
        name: nodeNameStr,
        node_type: normalizeType(nodeType) || node.node_type,
        category,
      });
    });
  }

  const nodeMap = {};
  nodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  const links = [];

  if (Array.isArray(validRawData.links)) {
    validRawData.links.forEach((link) => {
      const sourceId = String(link.sourceId ?? link.source ?? link.from_gid ?? '');
      const targetId = String(link.targetId ?? link.target ?? link.to_gid ?? '');

      if (!sourceId || !targetId) {
        console.warn('Skipping link with missing sourceId or targetId:', link);
        return;
      }

      const sourceNode = nodeMap[sourceId];
      const targetNode = nodeMap[targetId];

      if (!sourceNode) {
        console.warn(`Source node with ID "${sourceId}" not found for link:`, link);
        return;
      }

      if (!targetNode) {
        console.warn(`Target node with ID "${targetId}" not found for link:`, link);
        return;
      }

      const sourceName = sourceNode.name || sourceNode['Entity Name'] || sourceNode.entity_name || sourceNode.relationship_name || sourceNode['Relationship NAME'] || sourceId;
      const targetName = targetNode.name || targetNode['Entity Name'] || targetNode.entity_name || targetNode.relationship_name || targetNode['Relationship NAME'] || targetId;

      const newLink = {
        ...link,
        id: link.id || generateRandomId(),
        source: sourceId,
        target: targetId,
        sourceId: sourceId,
        targetId: targetId,
        sourceName: String(sourceName || ''),
        targetName: String(targetName || ''),
        _originalData: { ...link }
      };

      // Provide reasonable defaults from the new DB structure
      if (!newLink.label) {
        newLink.label =
          link.label ||
          link.relationship_summary ||
          link.summary ||
          link['Relationship Summary'] ||
          link.type ||
          '';
      }
      if (!newLink.title) {
        newLink.title =
          link.title ||
          link.article_title ||
          link['Article Title'] ||
          link['Source Title'] ||
          '';
      }
      if (!newLink.url) {
        newLink.url =
          link.url ||
          link.article_url ||
          link['Article URL'] ||
          link['Source URL'] ||
          '';
      }

      links.push(newLink);
    });
  }

  return { nodes, links };
};

export const extractEntityHighlights = (graphData) => {
  if (!graphData || !graphData.nodes) return [];

  return graphData.nodes
    .filter(node => node.highlight === true)
    .map(node => ({
      id: node.id,
      name: String(node.name || node.id || ''),
      category: node.category
    }));
};

export const findNodeById = (graphData, nodeId) => {
  if (!graphData || !graphData.nodes) return null;
  return graphData.nodes.find(node => node.id === nodeId) || null;
};
