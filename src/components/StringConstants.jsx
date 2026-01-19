/**
 * Centralized string constants for the entire application
 * All user-facing text should be defined here and imported where needed
 */

export const StringConstants = {
  // Tab Labels
  TABS: {
    NODE_PROPERTIES: 'Node Properties',
    DATA_VISUALIZATION: 'Data Visualization',
    SCENE_LAYOUT: 'Scene Layout',
  },

  // Right Sidebar
  RIGHT_SIDEBAR: {
    SELECTED_NODE: 'Selected Node',
    SELECT_STORY_ELEMENT: 'Select a story element to view details',
    NODE_PROPERTIES_TITLE: 'Node Properties',
    SORT_BY: 'Sort By',
    ORDER_MAP_BY: 'Order Map By',
    CALENDAR: 'Calendar',
    HIERARCHY_TREE: 'Hierarchy Tree',
    MAP_VIEW: 'Map View',
    CLUSTER_NODES: 'Cluster Nodes',
    TIMELINE: 'Timeline',
    HIERARCHY: 'Hierarchy',
    LINEAR: 'Linear',
    TRUNCATED: 'Truncated',
    FLAT: 'Flat',
    SPHERICAL: 'Spherical',
    X_AXIS: 'X Axis',
    Y_AXIS: 'Y Axis',
    Z_AXIS: 'Z Axis',
    DEFAULT: 'Default',
  },

  // Graph Controls
  GRAPH_CONTROLS: {
    FORCE_STRENGTH: 'Force Strength',
    NODE_SIZE: 'Node Size',
    LABEL_SIZE: 'Label Size',
    EDGE_LENGTH: 'Edge Length',
    EDGE_THICKNESS: 'Edge Thickness',
    ADJUST_FORCE_STRENGTH: 'Adjust force strength',
    ADJUST_NODE_SIZE: 'Adjust node size',
    ADJUST_LABEL_SIZE: 'Adjust label size',
    ADJUST_EDGE_LENGTH: 'Adjust edge length',
    ADJUST_EDGE_THICKNESS: 'Adjust edge thickness',
  },

  // Sort Options
  SORT: {
    TIME: 'Time',
    NEIGHBORS: 'Neighbors',
    HIERARCHY: 'Hierarchy',
    ASCENDING: 'Ascending',
    DESCENDING: 'Descending',
    SORT_BY_CRITERIA: 'Sort by Criteria',
    COUNTING_NEIGHBORS: 'Counting neighbors',
  },

  // HomePage
  HOMEPAGE: {
    SHOWING_NODES: 'Showing {count} of {total} nodes',
    CONNECTED_DATA: 'Connected Data',
    GRAPH_VIEW: 'Graph',
    TABLE_VIEW: 'Table',
    JSON_VIEW: 'JSON',
    VIEW_MODE: 'View Mode',
    CATEGORY_FILTER: 'Category Filter',
  },

  // Error Messages
  ERRORS: {
    FAILED_TO_LOAD_STORIES: 'Failed to load stories',
    ERROR_LOADING_STORIES: 'Error Loading Stories',
    AI_SEARCH_ERROR: 'AI Search Error',
    CONNECTED_DATA_ERROR: 'Connected Data Error',
    DELETE_FAILED: 'Delete Failed',
    FAILED_TO_DELETE_NODE: 'Failed to Delete Node',
    INVALID_NODE_SELECTED: 'Invalid node selected for deletion',
    NODE_ID_MISSING: 'Node ID is missing or invalid',
    FAILED_TO_LOAD_CONNECTED_DATA: 'Failed to load connected data',
    UNEXPECTED_ERROR: 'An unexpected error occurred while deleting the node.',
  },

  // Success Messages
  SUCCESS: {
    NODE_DELETED: 'Node Deleted',
    NODE_DELETED_MESSAGE: 'Node "{name}" and all its relationships have been deleted from Neo4j.',
    MESSAGE_SENT: 'Message Sent',
    THANK_YOU_MESSAGE: "Thank you for your message! We'll get back to you soon.",
  },

  // Common UI
  COMMON: {
    CLOSE: 'Close',
    CLOSE_NOTIFICATION: 'Close notification',
    CLOSE_POPUP: 'Close popup',
    YES: 'Yes',
    NO: 'No',
    SAVE: 'Save',
    CANCEL: 'Cancel',
    DELETE: 'Delete',
    EDIT: 'Edit',
    SEARCH: 'Search',
    FILTER: 'Filter',
    RESET: 'Reset',
    APPLY: 'Apply',
    PREVIOUS: 'Previous',
    NEXT: 'Next',
    LOADING: 'Loading...',
    NO_DATA: 'No data available',
    SELECT_ALL: 'Select All',
    DESELECT_ALL: 'Deselect All',
  },

  // Donation Popup
  DONATION: {
    TITLE: "Your support is crucial!",
    INTRO: "My goals were big — expose the world's best-kept secrets and create the world's most compelling data-driven presentations. In my first few months, I tackled investigations too big for any other format.",
    HIGHLIGHTS: [
      "-The Soros dark money trail",
      "-USAID funding Wuhan Labs and Hunter Biden Ukraine Biolabs",
      "-Planned Parenthood, Military Industrial Complex and the USAID global depopulation engine.",
    ],
    TAGLINE: "You can't find these stories anywhere else!",
    MIDDLE: "I made a promise to share my findings with the public. But when I was locked out of my account by a hosting company, building my own app became a necessity. My goals are now even bigger: Create public intelligence tools that revolutionize how the world understands itself.",
    CLOSING: "I'm pouring everything I have into this and to take it any further I need your help. If you've found value in my work, I humbly request your financial support, in an amount you feel is fair. You'll not only support my past work, but also my future projects. The truth is at our fingertips.",
    QUESTION: 'Can I count on you to take this journey with me?',
    YES_COUNT_ME_IN: 'Yes, count me in!',
    NO_NOT_RIGHT_NOW: 'No, not right now.',
    LEARN_MORE: "I'd like to learn more about your bigger plans.",
  },

  // Contact Page
  CONTACT: {
    TITLE: 'Contact Us',
    DESCRIPTION: "Have questions, feedback, or suggestions about Graph Explorer? We'd love to hear from you! Fill out the form below and we'll get back to you as soon as possible.",
    NAME: 'Name',
    EMAIL: 'Email',
    SUBJECT: 'Subject',
    MESSAGE: 'Message',
    SUBMIT: 'Submit',
    SENDING: 'Sending...',
  },

  // Selection Modes
  SELECTION: {
    INDIVIDUAL: 'Individual',
    BOX: 'Box',
    LASSO: 'Lasso',
  },

  // Map Views
  MAP_VIEWS: {
    FLAT: 'Flat',
    SPHERICAL: 'Spherical',
  },

  // Calendar Modes
  CALENDAR_MODES: {
    LINEAR: 'Linear',
    TRUNCATED: 'Truncated',
  },

  // Cluster Methods
  CLUSTER: {
    NONE: 'None',
    BY_TYPE: 'By Type',
    BY_PROPERTY: 'By Property',
  },

  // Empty States
  EMPTY_STATE: {
    NO_NODES: 'No nodes to display',
    NO_EDGES: 'No edges to display',
    NO_DATA: 'No data available',
    SELECT_NODE: 'Select a node to view details',
  },

  // Tooltips
  TOOLTIPS: {
    GRAPH_VIEW: 'Graph View',
    TABLE_VIEW: 'Table View',
    JSON_VIEW: 'JSON View',
    FORCE_STRENGTH: 'Adjust the force strength between nodes',
    NODE_SIZE: 'Adjust the size of nodes',
    LABEL_SIZE: 'Adjust the size of node labels',
    EDGE_LENGTH: 'Adjust the length of edges',
    EDGE_THICKNESS: 'Adjust the thickness of edges',
    TOGGLE_3D: 'Toggle 3D/2D view',
    INDIVIDUAL_SELECT: 'Individual selection mode',
    BOX_SELECT: 'Box selection mode',
    LASSO_SELECT: 'Lasso selection mode',
  },

  // Aria Labels
  ARIA: {
    CLOSE_NOTIFICATION: 'Close notification',
    CLOSE_POPUP: 'Close popup',
    ADJUST_FORCE_STRENGTH: 'Adjust force strength',
    ADJUST_NODE_SIZE: 'Adjust node size',
    ADJUST_LABEL_SIZE: 'Adjust label size',
    ADJUST_EDGE_LENGTH: 'Adjust edge length',
    ADJUST_EDGE_THICKNESS: 'Adjust edge thickness',
    TOGGLE_3D: 'Toggle 3D view',
    SEARCH_INPUT: 'Search nodes and edges',
  },
};

export default StringConstants;

