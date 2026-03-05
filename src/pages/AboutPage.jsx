import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';

const AboutPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header showStoryDropdown={false} />

      <main className="flex-1 container mx-auto px-4 pt-6 pb-8 bg-black relative z-10">
        <div className="max-w-3xl mx-auto bg-black">
          <section className="mb-24">
            <h2 className="text-2xl font-semibold mb-4 text-white underline">
              About This App
            </h2>
            <div className="text-gray-300 space-y-4">
              <p>
                Graph Explorer is an interactive web application that organizes, visualizes, and connects
                complex data across people, organizations, money, events, and more. It is designed to
                simplify the process of accessing and creating sophisticated data investigations—bringing
                intelligence-grade research capabilities to the public.
              </p>
              <p style={{ color: '#D4AF37' , fontStyle: 'italic'}}>
                Why? Powerful algorithms, corporations, and governments are tracking your every movement
                and sharing your data. What if you had the same power to track them back?
              </p>
              <p>
                To achieve this, we ingest data from news articles, government databases, court documents,
                police reports, FOIA documents, biographical records, and affiliated websites. An
                AI-driven pipeline extracts structure from these sources—including digitized government
                PDFs—and converts them into connected, searchable nodes and relationships.
              </p>
              <p>
                Users can explore entity properties, trace money flows, navigate relationship networks,
                follow cause-and-effect chains, and view hierarchies, timelines, and geographic data.
                Every node links back to source material.
              </p>
              <p>
                The platform supports both crowd-sourced public research and private investigations. No
                code required.
              </p>
              <p>
                Built for political researchers, journalists, data analysts, and anyone working to
                understand the structures behind power, money, and influence. We intend to price our
                tools at a level that ensures anyone can become an expert researcher.
              </p>
              <p>
                This app is in early development. Follow us as we deploy more ways for you to search,
                view, understand, and create your own investigations. For early access and updates, visit{' '}
                <a
                  href="https://invisibleinq.com"
                  className="underline text-gray-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  invisibleinq.com
                </a>
                .
              </p>
            </div>
          </section>

          <section className="mb-24">
            <h2 className="text-2xl font-semibold mb-4 text-white underline">Data Transparency</h2>
            <div className="text-gray-300 space-y-4">
              <p className="font-semibold" style={{ color: '#D4AF37' , fontStyle: 'italic'}}>
                Your data is yours. We do not sell, share, or provide user data to third parties. Period.
              </p>
              <p>
                We collect only what is necessary to secure the platform, improve the tools, and
                understand basic user demographics and behavior. Nothing more. Our sources are yours.
                Every connection in the graph is cited. Every node links back to its original source
                material. We never hide where our data comes from—if it is in the graph, you can trace
                it.
              </p>
              <p>
                No outside editorial influence. We take no funding that comes with editorial conditions.
                No advertiser, sponsor, or investor has input on what we investigate, publish, or how we
                present it.
              </p>
              <p>
                No censorship. We do not suppress, shift, or selectively omit data to serve a narrative.
                The graph reflects what the sources say. We protect your privacy. Your viewing habits,
                search history, saved investigations, and research activity are private. We do not track
                what you read or investigate for the purpose of profiling, advertising, or disclosure to
                any outside party.
              </p>
              <p>
                Open methodology. As we grow, we are committed to documenting and publishing our
                ingestion methods, data standards, and editorial processes so that our work can be
                scrutinized and verified.
              </p>
            </div>
          </section>

          <section className="mb-24">
            <h2 className="text-2xl font-semibold mb-4 text-white underline">A Message from the Founder</h2>
            <div className="text-gray-300 space-y-4">
              <p>
                My interest in investigative research started in 1998, when the U.S. bombed
                pharmaceutical facilities in Sudan. It raised a simple question: how are decisions like
                this connected to power, money, and institutions? That question never went away.
              </p>
              <p>
                Always interested in investigative stories, I kept searching for deeper connections
                between sources, numbers, names, and events, and I realized my brain and notebook could
                not hold it all. That led me to design an early prototype of a data network tool. But the
                technology was not ready, so I shifted to other projects.
              </p>
              <p>
                Now that technology has matured, I have built a platform to map relational structures in
                a way that is accessible, explainable, and expandable. I have long wondered what it would
                look like if investigative and public data could live inside one connected system—instead
                of being scattered across the internet.
              </p>
              <p style={{ color: '#D4AF37' , fontStyle: 'italic'}}>This is my answer.</p>
              <p>
                If you believe independent infrastructure for deeper insights matters, I am asking for
                your support to take this to the next stage—to build a foundational model for
                investigative research, and to keep it independent. Follow this project and we will keep
                you updated while we grow.
              </p>
              <p>— Andrew Arnold, Founder</p>
            </div>
          </section>

            <Link to="/" className="text-gray-300 hover:text-white transition-colors">
              &larr; Back to Graph Explorer
            </Link>
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
