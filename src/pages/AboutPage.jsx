import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import EditableContent from '../components/common/EditableContent';

const AboutPage = () => {
  const defaultTitle = 'About Graph Explorer';
  const defaultOverview = `<p class="mb-4 text-gray-300">
Graph Explorer is an interactive web application designed to visualize and explore relational graphs.
It allows users to interact with nodes and edges, view their properties, and navigate through complex
relationship networks.
</p>
<p class="mb-4 text-gray-300">
This tool is particularly useful for researchers, data analysts, and anyone interested in understanding
the connections between different entities in a dataset.
</p>`;

  const defaultFeatures = `<ul class="list-disc pl-6 space-y-2 text-gray-300">
<li>Interactive 2D and 3D graph visualization</li>
<li>Node and edge property inspection</li>
<li>Customizable graph appearance with sliders for force strength, node size, and label size</li>
<li>Story-based navigation through different datasets</li>
<li>Entity highlighting for quick access to important nodes</li>
<li>Responsive design for desktop, tablet, and mobile devices</li>
</ul>`;

  const defaultHowToUse = `<ol class="list-decimal pl-6 space-y-2 text-gray-300">
<li>Select a story from the dropdown menu in the left sidebar</li>
<li>Explore the graph by dragging, zooming, and rotating</li>
<li>Click on nodes or edges to view their properties in the right sidebar</li>
<li>Use the UI controls to adjust the graph appearance</li>
<li>Click on entity highlights to quickly focus on important nodes</li>
<li>Use the Previous/Next buttons to navigate through related stories</li>
</ol>`;

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header
        showStoryDropdown={false}
      />
      <main className="flex-1 container mx-auto px-4 pt-6 pb-8 bg-black relative z-10">
        <div className="max-w-3xl mx-auto bg-black">
          <div className="relative group mb-6">
            <EditableContent
              content={defaultTitle}
              storageKey="about-page-title"
              className="text-3xl font-bold text-white"
              tag="h1"
            />
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">Project Overview</h2>
            <EditableContent
              content={defaultOverview}
              storageKey="about-page-overview"
              className="text-gray-300"
              tag="div"
            />
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">Features</h2>
            <EditableContent
              content={defaultFeatures}
              storageKey="about-page-features"
              className="text-gray-300"
              tag="div"
            />
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">How to Use</h2>
            <EditableContent
              content={defaultHowToUse}
              storageKey="about-page-how-to-use"
              className="text-gray-300"
              tag="div"
            />
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

export default AboutPage;
