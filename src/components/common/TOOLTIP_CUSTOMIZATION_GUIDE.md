# NodeTooltipEnhanced - Customization Guide

## Overview

The `NodeTooltipEnhanced` component is a flexible, extensible tooltip system for Three.js graph visualizations. It supports different layouts and styling based on node types.

## Architecture

### Component Structure

```
NodeTooltipEnhanced (Main Component)
├── getNodeIcon() - Returns appropriate icon for node type
├── getNodeColor() - Returns color scheme for node type
├── getTooltipLayout() - Selects layout component based on node type
└── Layout Components:
    ├── BaseTooltipLayout (Default)
    ├── EntityTooltipLayout
    ├── AgencyTooltipLayout
    ├── CountryTooltipLayout
    ├── LocationTooltipLayout
    ├── AmountTooltipLayout
    ├── RelationshipTooltipLayout
    ├── ActionTooltipLayout
    ├── ResultTooltipLayout
    └── ProcessTooltipLayout
```

## Supported Node Types

Currently configured node types with custom colors and icons:

| Node Type | Icon | Color | Layout Component |
|-----------|------|-------|------------------|
| Entity/Person | User | Blue (#5C9EFF) | EntityTooltipLayout |
| Agency/Organization | Building | Amber (#F59E0B) | AgencyTooltipLayout |
| Country | Flag | Red (#EF4444) | CountryTooltipLayout |
| Location/Place | Map Marker | Green (#10B981) | LocationTooltipLayout |
| Amount/Transaction | Dollar Sign | Purple (#8B5CF6) | AmountTooltipLayout |
| Relationship | Handshake | Pink (#EC4899) | RelationshipTooltipLayout |
| Action | Cog | Teal (#14B8A6) | ActionTooltipLayout |
| Result | Bullseye | Orange (#F97316) | ResultTooltipLayout |
| Description | File | Indigo (#6366F1) | BaseTooltipLayout |
| Region | Globe | Cyan (#06B6D4) | BaseTooltipLayout |
| Process | Layer Group | Lime (#84CC16) | ProcessTooltipLayout |
| Default | Link | Blue (#5C9EFF) | BaseTooltipLayout |

## How to Customize Tooltips for Specific Node Types

### Step 1: Create a Custom Layout Component

Replace the placeholder layout with your custom implementation:

```javascript
// Example: Custom Entity Tooltip
const EntityTooltipLayout = ({ node, color }) => {
  const name = node.name || node.id || 'Unknown';
  const organization = node.properties?.organization || 'N/A';
  const role = node.properties?.role || 'N/A';
  const email = node.properties?.email || '';
  
  return (
    <div 
      className="bg-[#1E1E1E] border-l-4 rounded-lg shadow-2xl overflow-hidden max-w-[400px]"
      style={{ borderLeftColor: color }}
    >
      {/* Header Section */}
      <div className="p-4 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          {/* Profile Image or Icon */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <FaUser style={{ color }} className="text-xl" />
          </div>
          
          {/* Name and Role */}
          <div className="flex-1">
            <h3 className="text-white text-lg font-semibold">{name}</h3>
            <p className="text-[#9CA3AF] text-sm">{role}</p>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="p-4 space-y-2">
        <DetailRow label="Organization" value={organization} />
        <DetailRow label="Email" value={email} />
      </div>

      {/* Footer or Additional Info */}
      <div className="p-3 bg-[#0A0A0A] border-t border-[#2A2A2A]">
        <p className="text-[#707070] text-xs">
          Click to view full details
        </p>
      </div>
    </div>
  );
};
```

### Step 2: Add Custom Node Type Detection

If you need to add a new node type, update the helper functions:

```javascript
// In getNodeIcon()
if (type.includes('newtype')) return FaNewIcon;

// In getNodeColor()
if (type.includes('newtype')) return '#HEXCOLOR';

// In getTooltipLayout()
if (type.includes('newtype')) return NewTypeTooltipLayout;
```

### Step 3: Create Reusable Components

For common UI elements across tooltips:

```javascript
// Detail Row Component
const DetailRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-2 text-sm">
    {Icon && <Icon className="text-[#707070]" />}
    <span className="text-[#707070]">{label}:</span>
    <span className="text-[#B4B4B4] font-medium">{value}</span>
  </div>
);

// Section Header Component
const SectionHeader = ({ title, color }) => (
  <h4 
    className="text-sm font-semibold mb-2 pb-1 border-b"
    style={{ 
      color: color,
      borderBottomColor: `${color}40` 
    }}
  >
    {title}
  </h4>
);

// Badge Component
const Badge = ({ text, color }) => (
  <span 
    className="px-2 py-1 rounded text-xs font-medium"
    style={{ 
      backgroundColor: `${color}20`,
      color: color,
      border: `1px solid ${color}40`
    }}
  >
    {text}
  </span>
);
```

## Example: Advanced Country Tooltip

```javascript
const CountryTooltipLayout = ({ node, color }) => {
  const name = node.name || node.id;
  const region = node.properties?.region || '';
  const capital = node.properties?.capital || '';
  const population = node.properties?.population || '';
  const gdp = node.properties?.gdp || '';
  const flagUrl = node.properties?.flag || '';

  return (
    <div 
      className="bg-[#1E1E1E] border-l-4 rounded-lg shadow-2xl max-w-[400px]"
      style={{ borderLeftColor: color }}
    >
      {/* Flag Header */}
      {flagUrl && (
        <div className="h-24 overflow-hidden">
          <img 
            src={flagUrl} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Country Info */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FaFlag style={{ color }} />
          <h3 className="text-white text-xl font-bold">{name}</h3>
        </div>

        {region && (
          <Badge text={region} color={color} />
        )}

        <div className="mt-4 space-y-2">
          {capital && <DetailRow label="Capital" value={capital} icon={FaMapMarkerAlt} />}
          {population && <DetailRow label="Population" value={population.toLocaleString()} icon={FaUser} />}
          {gdp && <DetailRow label="GDP" value={`$${gdp}`} icon={FaDollarSign} />}
        </div>
      </div>
    </div>
  );
};
```

## Usage in ThreeGraphVisualization

To use the enhanced tooltip:

```javascript
import NodeTooltipEnhanced from '../common/NodeTooltipEnhanced';

// In the return statement:
<NodeTooltipEnhanced node={hoveredNode} position={tooltipPosition} />
```

## Node Data Structure

The tooltip expects nodes to have the following structure:

```javascript
{
  id: "unique-id",
  name: "Display Name",
  node_type: "Entity", // or type, category
  subtype: "Person",   // optional
  description: "Detailed description...",
  image: "https://...", // optional
  properties: {
    // Any additional properties
    key1: "value1",
    key2: "value2"
  }
}
```

### Amount Node Structure

Amount/Transaction nodes have a specific database structure with the following fields:

```javascript
{
  id: "gid",
  gid: 65632206,
  node_type: "Amount",
  section: "USAID Wuhan Full",
  degree: 3,
  
  // Amount-specific fields (from database)
  Amount: 204688.0,                                  // Monetary value
  "Distributor Full Name": "Fogarty International Center", // Source entity
  "Receiver Name": "ECOHEALTH ALLIANCE, INC.",      // Target entity
  Purpose: "The Ecology, Emergence and Pandemic...", // Process/Purpose description
  "Disb Date": "",                                   // Disbursement date
  "End Date": "",                                    // End date
  "Project Number": "",                              // Project identifier
  ID: "",                                            // Transaction ID
  Summary: "-",                                      // Transaction summary
  URL: "https://reporter.nih.gov/..."               // Source URL
}
```

**Important**: The `AmountTooltipLayout` component accesses these fields directly:
- `node.Amount` or `node['Amount']` - for the monetary value
- `node['Distributor Full Name']` - for the source entity
- `node['Receiver Name']` - for the target entity
- `node.Purpose` - for the process/purpose description
- `node.section` - for the entity type/category
- `node.degree` - for the connection count

## Styling Guidelines

### Colors
- Use consistent color schemes for node types
- Background: `#1E1E1E`
- Borders: Use node type color with opacity (e.g., `${color}40`)
- Text: White (`#FFFFFF`), Gray (`#B4B4B4`), Dark Gray (`#707070`)

### Layout
- Max width: `400px`
- Min width: `300px`
- Padding: `16px` (p-4)
- Border radius: `8px` (rounded-lg)
- Left border: `4px` with node type color

### Typography
- Font family: Archivo
- Heading: `text-lg` or `text-xl`, `font-semibold`
- Body: `text-sm`, `leading-relaxed`
- Labels: `text-xs` or `text-sm`, `text-[#707070]`

## Future Enhancements

- [ ] Add animations on hover
- [ ] Include mini-charts for numeric data
- [ ] Add action buttons (edit, delete, etc.)
- [ ] Support for relationship tooltips with source/target info
- [ ] Add "pinned" state for tooltips
- [ ] Include related nodes count/preview
- [ ] Add dark/light theme support
- [ ] Support for custom positioning strategies

## Contributing

When adding a new node type tooltip:

1. Create the layout component
2. Update `getNodeIcon()`, `getNodeColor()`, and `getTooltipLayout()`
3. Test with various data scenarios
4. Document the new type in this guide
5. Add examples to the demo/storybook

