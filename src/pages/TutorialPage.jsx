import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

const TutorialPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header showStoryDropdown={false} />

      <main className="flex-1 container mx-auto px-4 pt-6 pb-8 bg-black relative z-10">
        <div className="max-w-3xl mx-auto bg-black">
          <h1 className="text-2xl font-bold text-white mb-4 underline">Tutorial</h1>
          <p className="text-gray-300 mb-8">
            This tutorial section will continue to develop as we grow.
          </p>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">How to Use</h2>
            <ol className="list-decimal pl-6 space-y-2 text-gray-300">
              <li>Select a story from the dropdown menu in the left sidebar.</li>
              <li>Read the section summary on the left sidebar.</li>
              <li>Explore the graph by dragging, zooming, and rotating.</li>
              <li>Click on nodes or edges to view their properties in the right sidebar—including additional data, Wikipedia links, source URLs, images, and more.</li>
              <li>Use the right sidebar tabs for different views and graph layouts.</li>
              <li>Use the Previous/Next buttons to navigate through related chapters and sections.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">What's in the Graph</h2>
            <p className="text-gray-300 mb-4">
              The core of this data is connections between people, organizations, and more. Unlike other graph tools, nodes are connected through connector nodes that describe the nature of each connection. There are three types of nodes:
            </p>

            <h3 className="text-base font-medium text-white mt-4 mb-2">End-Nodes represent the subjects of the data</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-300 mb-4">
              <li>Entity—a specific person, organization, or organism.</li>
              <li>Entity General—unnamed or nonspecific groups.</li>
              <li>Framework—any guiding force that compels action: laws, acts, bills, court orders, even laws of physics.</li>
              <li>Event (Attendable)—press conferences, meetings, conferences, itineraries.</li>
              <li>Event (Historic)—historical events and publicly recognized milestones.</li>
              <li>Data—documents, emails, passwords, reports.</li>
              <li>Result—the outcome of an action or relationship.</li>
              <li>Concept—theory or idea that doesn't fit the above categories.</li>
              <li>Location—currently defined as country-level.</li>
            </ul>

            <h3 className="text-base font-medium text-white mt-4 mb-2">Connector Nodes sit between any two end-nodes and describe how they relate</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-300 mb-4">
              <li>Actions—talk by one entity usually toward or with another.</li>
              <li>Relationships—the category of connection between entities (e.g., "employed by," "partnered with," "married to").</li>
              <li>Exchanges—things transferred between entities—financial, communicative, barter, etc.</li>
              <li>Statements—things said by one party about a subject or topic.</li>
            </ul>
            <p className="text-gray-300 mb-4">
              Clicking a connector node displays a description, cited text from the source, and a URL link to the original material.
            </p>

            <p className="text-gray-300 mb-4">
              Reference Nodes make up the back-end of the database. Most run invisibly; "article" is the only reference node currently visible in the graph.
            </p>

            <p className="text-gray-300 mb-4">
              Edges are the lines connecting nodes, colored as a gradient from one node to another to help visualize direction. Clicking an edge displays a URL to its source.
            </p>

            <p className="text-gray-300 mb-4">
              A list of node categories appears in the upper right of the graph. Toggle these on and off to simplify your view—for example, turn off everything except "Relationship" and "Entity" to see only the relationships between entities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-3">Sidebar Tabs</h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Node Properties—detailed properties of each node, useful for micro-level analysis.</li>
              <li>Data Visualization—a dashboard for macro-level data analysis.</li>
              <li>Scene Layout—visualization options for organising the graph into different formats.</li>
            </ul>
          </section>

          <div className="mt-8">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">
              &larr; Back to Graph Explorer
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-black text-gray-300 py-4 border-t border-[#707070]">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} Graph Explorer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TutorialPage;
